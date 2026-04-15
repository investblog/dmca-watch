import type {
  ApiUsage,
  CheckInterval,
  Complaint,
  DomainRecord,
  SenderProfile,
  SourceStatus,
  SourceUsageMap,
  ThemePreference,
  ComplaintSource,
} from './types';
import { DEFAULT_EXCLUDED_DOMAINS, SENDER_PROFILE_TTL_MS, STORAGE_KEYS } from './constants';
import { computeDomainStatus } from './badge';

const DEFAULT_CHECK_INTERVAL: CheckInterval = 24;

let domainLock: Promise<void> = Promise.resolve();
let usageLock: Promise<void> = Promise.resolve();
let senderLock: Promise<void> = Promise.resolve();

function withDomainLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = domainLock;
  let release!: () => void;
  domainLock = new Promise<void>((resolve) => { release = resolve; });
  return prev.then(fn).finally(release);
}

function withUsageLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = usageLock;
  let release!: () => void;
  usageLock = new Promise<void>((resolve) => { release = resolve; });
  return prev.then(fn).finally(release);
}

function withSenderLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = senderLock;
  let release!: () => void;
  senderLock = new Promise<void>((resolve) => { release = resolve; });
  return prev.then(fn).finally(release);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultSourceUsage(date = todayUtc()): SourceUsageMap {
  const entry: ApiUsage = { count: 0, date };
  return {
    gtr: { ...entry },
    lumen: { ...entry },
  };
}

function buildRecord(domain: string, prev?: DomainRecord, watchlist = false): DomainRecord {
  return {
    domain,
    watchlist: prev?.watchlist ?? watchlist,
    added_at: prev?.added_at ?? Date.now(),
    last_checked: prev?.last_checked ?? 0,
    complaints: prev?.complaints ?? [],
    last_seen_complaint_id: prev?.last_seen_complaint_id ?? null,
    new_count: prev?.new_count ?? 0,
    status: prev?.status ?? 'unknown',
  };
}

export async function getDomains(): Promise<Record<string, DomainRecord>> {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_KEYS.DOMAINS]: {} }, (data) => {
      resolve((data[STORAGE_KEYS.DOMAINS] || {}) as Record<string, DomainRecord>);
    });
  });
}

export async function getDomain(domain: string): Promise<DomainRecord | undefined> {
  const domains = await getDomains();
  return domains[domain];
}

export function saveDomain(record: DomainRecord): Promise<void> {
  return withDomainLock(async () => {
    const domains = await getDomains();
    domains[record.domain] = record;
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.DOMAINS]: domains }, resolve);
    });
  });
}

export function removeDomain(domain: string): Promise<void> {
  return withDomainLock(async () => {
    const domains = await getDomains();
    delete domains[domain];
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.DOMAINS]: domains }, resolve);
    });
  });
}

export function saveBulkDomains(domainsToSave: string[], now: number): Promise<void> {
  return withDomainLock(async () => {
    const domains = await getDomains();
    for (const domain of domainsToSave) {
      const prev = domains[domain];
      domains[domain] = {
        ...buildRecord(domain, prev, true),
        watchlist: true,
        added_at: prev?.added_at ?? now,
      };
    }
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.DOMAINS]: domains }, resolve);
    });
  });
}

export async function getWatchlistDomains(): Promise<DomainRecord[]> {
  const domains = await getDomains();
  return Object.values(domains).filter((record) => record.watchlist);
}

function mergeImportedComplaints(
  existing: Complaint[] | undefined,
  incoming: Complaint[] | undefined,
): Complaint[] {
  const incomingList = incoming ?? [];
  if (!existing?.length) return incomingList;
  const existingByKey = new Map(existing.map((complaint) => [`${complaint.source}:${complaint.id}`, complaint]));
  return incomingList.map((complaint) => {
    const key = `${complaint.source}:${complaint.id}`;
    const prior = existingByKey.get(key);
    if (!prior) return complaint;
    return {
      ...complaint,
      dismissed_by_user: prior.dismissed_by_user || complaint.dismissed_by_user,
      notes: prior.notes ?? complaint.notes,
    };
  });
}

export function importDomains(records: DomainRecord[]): Promise<{ added: number; updated: number }> {
  return withDomainLock(async () => {
    const current = await getDomains();
    let added = 0;
    let updated = 0;

    for (const record of records) {
      const prior = current[record.domain];
      if (prior) updated += 1;
      else added += 1;
      const base = buildRecord(record.domain, prior, record.watchlist);
      current[record.domain] = {
        ...base,
        ...record,
        complaints: mergeImportedComplaints(prior?.complaints, record.complaints),
        watchlist: record.watchlist || prior?.watchlist || false,
      };
    }

    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.DOMAINS]: current }, resolve);
    });

    return { added, updated };
  });
}

export async function markDomainPending(domain: string, watchlist = false): Promise<void> {
  const prev = await getDomain(domain);
  await saveDomain({
    ...buildRecord(domain, prev, watchlist),
    watchlist: prev?.watchlist ?? watchlist,
    status: 'pending',
  });
}

function updateComplaint(
  complaints: Complaint[],
  complaintId: string,
  updater: (complaint: Complaint) => Complaint,
): Complaint[] {
  return complaints.map((complaint) => (
    complaint.id === complaintId ? updater(complaint) : complaint
  ));
}

export async function dismissComplaint(domain: string, complaintId: string): Promise<void> {
  const record = await getDomain(domain);
  if (!record) return;
  const complaints = updateComplaint(record.complaints, complaintId, (complaint) => ({
    ...complaint,
    dismissed_by_user: true,
  }));
  await saveDomain({
    ...record,
    complaints,
    status: computeDomainStatus(complaints, record.new_count),
  });
}

export async function saveComplaintNote(
  domain: string,
  complaintId: string,
  notes: string | null,
): Promise<void> {
  const record = await getDomain(domain);
  if (!record) return;
  await saveDomain({
    ...record,
    complaints: updateComplaint(record.complaints, complaintId, (complaint) => ({
      ...complaint,
      notes,
    })),
  });
}

export async function markDomainSeen(domain: string): Promise<void> {
  const record = await getDomain(domain);
  if (!record) return;
  const latestId = record.complaints[0]?.id ?? null;
  await saveDomain({
    ...record,
    last_seen_complaint_id: latestId,
    new_count: 0,
    status: computeDomainStatus(record.complaints, 0),
  });
}

export async function getSenderProfiles(): Promise<Record<string, SenderProfile>> {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_KEYS.SENDER_PROFILES]: {} }, (data) => {
      resolve((data[STORAGE_KEYS.SENDER_PROFILES] || {}) as Record<string, SenderProfile>);
    });
  });
}

export async function getSenderProfile(senderName: string): Promise<SenderProfile | undefined> {
  const all = await getSenderProfiles();
  return all[senderName];
}

export function saveSenderProfile(profile: SenderProfile): Promise<void> {
  return withSenderLock(async () => {
    const all = await getSenderProfiles();
    all[profile.sender_name] = profile;
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.SENDER_PROFILES]: all }, resolve);
    });
  });
}

export function removeSenderProfile(senderName: string): Promise<void> {
  return withSenderLock(async () => {
    const all = await getSenderProfiles();
    delete all[senderName];
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.SENDER_PROFILES]: all }, resolve);
    });
  });
}

export function isSenderProfileStale(profile: SenderProfile | undefined): boolean {
  if (!profile) return true;
  if (profile.status === 'loading' || profile.status === 'error') return false;
  return Date.now() - profile.fetched_at > SENDER_PROFILE_TTL_MS;
}

export async function getSourceUsage(): Promise<SourceUsageMap> {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_KEYS.SOURCE_USAGE]: defaultSourceUsage() }, (data) => {
      resolve(data[STORAGE_KEYS.SOURCE_USAGE] as SourceUsageMap);
    });
  });
}

export async function resetSourceUsageIfNewDay(): Promise<SourceUsageMap> {
  const usage = await getSourceUsage();
  const today = todayUtc();
  const needsReset = Object.values(usage).some((entry) => entry.date !== today);

  if (!needsReset) return usage;

  const fresh = defaultSourceUsage(today);
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.SOURCE_USAGE]: fresh }, resolve);
  });
  return fresh;
}

export function incrementSourceUsage(source: ComplaintSource): Promise<SourceUsageMap> {
  return incrementSourceUsageBy(source, 1);
}

export function incrementSourceUsageBy(source: ComplaintSource, n: number): Promise<SourceUsageMap> {
  return withUsageLock(async () => {
    const usage = await resetSourceUsageIfNewDay();
    usage[source].count += Math.max(0, n);
    usage[source].date = todayUtc();
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.SOURCE_USAGE]: usage }, resolve);
    });
    return usage;
  });
}

export async function getLumenApiToken(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ [STORAGE_KEYS.LUMEN_API_TOKEN]: '' }, (data) => {
      resolve(data[STORAGE_KEYS.LUMEN_API_TOKEN] as string);
    });
  });
}

export async function saveLumenApiToken(token: string): Promise<void> {
  const trimmed = token.trim();
  await new Promise<void>((resolve) => {
    chrome.storage.sync.set({
      [STORAGE_KEYS.LUMEN_API_TOKEN]: trimmed,
    }, resolve);
  });
}

export async function getLumenEnabled(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ [STORAGE_KEYS.LUMEN_ENABLED]: false }, (data) => {
      resolve(Boolean(data[STORAGE_KEYS.LUMEN_ENABLED]));
    });
  });
}

export async function saveLumenEnabled(enabled: boolean): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEYS.LUMEN_ENABLED]: enabled }, resolve);
  });
}

export async function getSourceStatus(): Promise<SourceStatus> {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      [STORAGE_KEYS.SOURCE_STATUS]: 'not_configured',
    }, (data) => {
      resolve((data[STORAGE_KEYS.SOURCE_STATUS] as SourceStatus) ?? 'not_configured');
    });
  });
}

export async function saveSourceStatus(status: SourceStatus): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEYS.SOURCE_STATUS]: status }, resolve);
  });
}

export async function getCheckInterval(): Promise<CheckInterval> {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ [STORAGE_KEYS.CHECK_INTERVAL]: DEFAULT_CHECK_INTERVAL }, (data) => {
      resolve(data[STORAGE_KEYS.CHECK_INTERVAL] as CheckInterval);
    });
  });
}

export async function saveCheckInterval(hours: CheckInterval): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEYS.CHECK_INTERVAL]: hours }, resolve);
  });
}

export async function getThemePreference(): Promise<ThemePreference> {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ [STORAGE_KEYS.THEME]: 'auto' }, (data) => {
      resolve(data[STORAGE_KEYS.THEME] as ThemePreference);
    });
  });
}

export async function saveThemePreference(pref: ThemePreference): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEYS.THEME]: pref }, resolve);
  });
}

export async function getExcludedDomains(): Promise<string[]> {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ [STORAGE_KEYS.EXCLUDED_DOMAINS]: DEFAULT_EXCLUDED_DOMAINS }, (data) => {
      const value = data[STORAGE_KEYS.EXCLUDED_DOMAINS];
      resolve(Array.isArray(value) ? value as string[] : DEFAULT_EXCLUDED_DOMAINS);
    });
  });
}

export async function saveExcludedDomains(domains: string[]): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEYS.EXCLUDED_DOMAINS]: domains }, resolve);
  });
}

export async function getNotifyOnNew(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ [STORAGE_KEYS.NOTIFY_ON_NEW]: true }, (data) => {
      resolve(Boolean(data[STORAGE_KEYS.NOTIFY_ON_NEW]));
    });
  });
}

export async function saveNotifyOnNew(value: boolean): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEYS.NOTIFY_ON_NEW]: value }, resolve);
  });
}

export async function getPauseUntil(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ [STORAGE_KEYS.PAUSE_UNTIL]: null }, (data) => {
      resolve(data[STORAGE_KEYS.PAUSE_UNTIL] as number | null);
    });
  });
}

export async function setPauseUntil(ts: number | null): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEYS.PAUSE_UNTIL]: ts }, resolve);
  });
}

export async function isPaused(): Promise<boolean> {
  const until = await getPauseUntil();
  return until !== null && until > Date.now();
}
