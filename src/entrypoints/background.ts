import { defineBackground } from 'wxt/sandbox';
import { browser } from 'wxt/browser';
import type {
  Complaint,
  DomainRecord,
  QueueItem,
  QueuePriority,
  SenderMonthlyCount,
  SenderProfile,
} from '@shared/types';
import type {
  DomainActionResponse,
  QueueStatusResponse,
  RequestMessage,
  SenderProfileResponse,
  SourceStatusResponse,
  VerifyTokenResponse,
} from '@shared/messaging/protocol';
import {
  ALARM_NAME,
  BADGE_PAUSE,
  BADGE_QUEUE_COLOR,
  GTR_THROTTLE_MS,
  LUMEN_THROTTLE_MS,
  GTR_BUDGET,
  LUMEN_BUDGET,
  RETRY,
  SENDER_TOP_LIMIT,
} from '@shared/constants';
import { extractDomain } from '@shared/domain-utils';
import {
  dismissComplaint,
  getCheckInterval,
  getDomain,
  getDomains,
  getExcludedDomains,
  getLumenApiToken,
  getLumenEnabled,
  getNotifyOnNew,
  getPauseUntil,
  getSenderProfile,
  getSourceStatus,
  isSenderProfileStale,
  resetSourceUsageIfNewDay,
  getWatchlistDomains,
  incrementSourceUsage,
  incrementSourceUsageBy,
  isPaused,
  markDomainPending,
  markDomainSeen,
  removeDomain,
  saveComplaintNote,
  saveDomain,
  saveLumenApiToken,
  saveLumenEnabled,
  saveSenderProfile,
  saveSourceStatus,
  setPauseUntil,
} from '@shared/db';
import { BADGE_EMPTY, computeBadge, computeDomainStatus } from '@shared/badge';
import { createWatchlistAlarm } from '@shared/alarm';
import { canEnqueue, dequeue, enqueue, isInCooldown, itemKey } from '@shared/queue';
import {
  GtrParseError,
  GtrRateLimitedError,
  isGtrRateLimited,
  searchGtrComplaintsByDomain,
} from '@shared/gtr-client';
import {
  fetchLumenSenderProfile,
  isLumenAuthError,
  isLumenNotImplementedError,
  searchLumenComplaintsByDomain,
  verifyLumenToken,
} from '@shared/lumen-client';
import { checkSourceHealthBatch } from '@shared/source-health';

function complaintKey(complaint: Complaint): string {
  return `${complaint.source}:${complaint.id}`;
}

function sortComplaints(complaints: Complaint[]): Complaint[] {
  return [...complaints].sort((a, b) => (
    b.date - a.date
    || a.source.localeCompare(b.source)
    || a.id.localeCompare(b.id)
  ));
}

function mergeComplaints(previous: Complaint[], incoming: Complaint[]): {
  complaints: Complaint[];
  newCountDelta: number;
} {
  const prevMap = new Map(previous.map((complaint) => [complaintKey(complaint), complaint]));
  const resultMap = new Map<string, Complaint>(prevMap);
  let newCountDelta = 0;

  for (const complaint of incoming) {
    const key = complaintKey(complaint);
    const prev = prevMap.get(key);
    if (!prev) newCountDelta += 1;
    resultMap.set(key, {
      ...complaint,
      dismissed_by_user: prev?.dismissed_by_user ?? complaint.dismissed_by_user,
      notes: prev?.notes ?? complaint.notes,
    });
  }

  return { complaints: sortComplaints([...resultMap.values()]), newCountDelta };
}

function baseRecord(domain: string, existing?: DomainRecord, watchlist = false): DomainRecord {
  return {
    domain,
    watchlist: existing?.watchlist ?? watchlist,
    added_at: existing?.added_at ?? Date.now(),
    last_checked: existing?.last_checked ?? 0,
    complaints: existing?.complaints ?? [],
    last_seen_complaint_id: existing?.last_seen_complaint_id ?? null,
    new_count: existing?.new_count ?? 0,
    status: existing?.status ?? 'unknown',
  };
}

function emptySenderProfile(senderName: string): SenderProfile {
  return {
    sender_name: senderName,
    source: 'gtr',
    fetched_at: 0,
    status: 'loading',
    error: null,
    total_notices: 0,
    sampled_notices: 0,
    first_activity: null,
    last_activity: null,
    monthly_counts: [],
    cross_watchlist: [],
    top_principals: [],
    top_recipients: [],
    top_target_hosts: [],
    top_source_urls: [],
    jurisdictions: [],
    source_health: [],
  };
}

async function buildLocalSenderProfile(senderName: string): Promise<SenderProfile> {
  const records = await getDomains();
  const crossWatchlist: Array<{ domain: string; count: number; last_activity: number }> = [];
  const monthlyMap = new Map<string, number>();

  let first: number | null = null;
  let last: number | null = null;
  let total = 0;

  for (const record of Object.values(records)) {
    if (!record.watchlist) continue;
    let countInDomain = 0;
    let lastInDomain = 0;
    for (const complaint of record.complaints) {
      if (complaint.sender !== senderName && complaint.principal !== senderName) continue;
      countInDomain += 1;
      total += 1;
      if (complaint.date > lastInDomain) lastInDomain = complaint.date;
      if (first === null || complaint.date < first) first = complaint.date;
      if (last === null || complaint.date > last) last = complaint.date;
      const month = new Date(complaint.date).toISOString().slice(0, 7);
      monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + 1);
    }
    if (countInDomain > 0) {
      crossWatchlist.push({ domain: record.domain, count: countInDomain, last_activity: lastInDomain });
    }
  }

  crossWatchlist.sort((a, b) => b.count - a.count || b.last_activity - a.last_activity);

  const monthlyCounts: SenderMonthlyCount[] = [...monthlyMap.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    sender_name: senderName,
    source: 'gtr',
    fetched_at: Date.now(),
    status: 'fresh',
    error: null,
    total_notices: total,
    sampled_notices: total,
    first_activity: first,
    last_activity: last,
    monthly_counts: monthlyCounts,
    cross_watchlist: crossWatchlist,
    top_principals: [],
    top_recipients: [],
    top_target_hosts: [],
    top_source_urls: [],
    jurisdictions: [],
    source_health: [],
  };
}

export default defineBackground(() => {
  const actionApi: typeof browser.action =
    (browser as unknown as { action?: typeof browser.action; browserAction?: typeof browser.action }).action
    || (browser as unknown as { browserAction?: typeof browser.action }).browserAction!;

  const queue: QueueItem[] = [];
  const retryCount = new Map<string, number>();
  let processing: QueueItem | null = null;
  let queueTimer: ReturnType<typeof setTimeout> | null = null;
  let pauseResumeTimer: ReturnType<typeof setTimeout> | null = null;

  function processingLabel(item: QueueItem | null): string | null {
    if (!item) return null;
    return item.kind === 'domain' ? item.domain : `@${item.sender_name}`;
  }

  async function markSenderLoading(senderName: string): Promise<void> {
    const prev = await getSenderProfile(senderName);
    await saveSenderProfile({
      ...(prev ?? emptySenderProfile(senderName)),
      sender_name: senderName,
      status: 'loading',
      error: null,
    });
  }

  async function markSenderError(senderName: string, errorMessage: string): Promise<void> {
    const prev = await getSenderProfile(senderName);
    await saveSenderProfile({
      ...(prev ?? emptySenderProfile(senderName)),
      sender_name: senderName,
      status: 'error',
      error: errorMessage,
    });
  }

  function setGlobalBadge(text: string, color: string): void {
    try {
      void actionApi.setBadgeText({ text });
      if (text) void actionApi.setBadgeBackgroundColor({ color });
    } catch {
      /* ignore */
    }
  }

  function clearGlobalBadge(): void {
    try {
      void actionApi.setBadgeText({ text: '' });
    } catch {
      /* ignore */
    }
  }

  function applyTabBadge(tabId: number, text: string, color: string): void {
    try {
      void actionApi.setBadgeText({ tabId, text });
      if (text) void actionApi.setBadgeBackgroundColor({ tabId, color });
    } catch {
      /* ignore */
    }
  }

  function queueSize(): number {
    return queue.length + (processing ? 1 : 0);
  }

  function updateQueueOverlay(): void {
    if (queueSize() > 0) {
      setGlobalBadge(String(queueSize()), BADGE_QUEUE_COLOR);
      return;
    }
    clearGlobalBadge();
  }

  async function refreshActiveBadge(): Promise<void> {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) await updateBadgeForTab(tab.id);
    } catch {
      /* ignore */
    }
  }

  async function updateBadgeForTab(tabId: number): Promise<void> {
    if (await isPaused()) {
      setGlobalBadge(BADGE_PAUSE.text, BADGE_PAUSE.color);
      return;
    }

    if (queueSize() > 0) {
      updateQueueOverlay();
      return;
    }

    let url: string | undefined;
    try {
      const tab = await browser.tabs.get(tabId);
      url = tab.url;
    } catch {
      return;
    }

    if (!url) {
      applyTabBadge(tabId, BADGE_EMPTY.text, BADGE_EMPTY.color);
      return;
    }

    const domain = extractDomain(url);
    if (!domain) {
      applyTabBadge(tabId, BADGE_EMPTY.text, BADGE_EMPTY.color);
      return;
    }

    const excluded = await getExcludedDomains();
    if (excluded.includes(domain)) {
      applyTabBadge(tabId, BADGE_EMPTY.text, BADGE_EMPTY.color);
      return;
    }

    const record = await getDomain(domain);
    const badge = computeBadge(record ?? null);
    applyTabBadge(tabId, badge.text, badge.color);
  }

  function scheduleAutoResume(until: number): void {
    if (pauseResumeTimer) clearTimeout(pauseResumeTimer);
    pauseResumeTimer = setTimeout(() => {
      pauseResumeTimer = null;
      void doResume();
    }, Math.max(0, until - Date.now()));
  }

  async function doPause(hours: number): Promise<void> {
    const until = Date.now() + (hours * 60 * 60 * 1000);
    await setPauseUntil(until);
    setGlobalBadge(BADGE_PAUSE.text, BADGE_PAUSE.color);
    if (queueTimer) {
      clearTimeout(queueTimer);
      queueTimer = null;
    }
    scheduleAutoResume(until);
  }

  async function doResume(): Promise<void> {
    await setPauseUntil(null);
    if (pauseResumeTimer) {
      clearTimeout(pauseResumeTimer);
      pauseResumeTimer = null;
    }
    clearGlobalBadge();
    await tickWatchlist();
    scheduleProcessQueue();
    await refreshActiveBadge();
  }

  async function initPause(): Promise<void> {
    const until = await getPauseUntil();
    if (until && until > Date.now()) {
      setGlobalBadge(BADGE_PAUSE.text, BADGE_PAUSE.color);
      scheduleAutoResume(until);
      return;
    }
    if (until) await setPauseUntil(null);
  }

  async function requestDomainCheck(domain: string, priority: QueuePriority, watchlist = false): Promise<boolean> {
    if (await isPaused()) return false;

    const usage = await resetSourceUsageIfNewDay();
    if (!canEnqueue(priority, usage.gtr, GTR_BUDGET)) return false;

    const existing = await getDomain(domain);
    if (isInCooldown(existing)) return false;

    const inserted = enqueue(queue, { kind: 'domain', domain, priority });
    if (!inserted) return false;

    await markDomainPending(domain, existing?.watchlist ?? watchlist);
    updateQueueOverlay();
    scheduleProcessQueue();
    void refreshActiveBadge();
    return true;
  }

  async function requestLumenSenderLookup(senderName: string, priority: QueuePriority = 'normal'): Promise<boolean> {
    if (await isPaused()) return false;

    const lumenEnabled = await getLumenEnabled();
    if (!lumenEnabled) return false;

    const token = await getLumenApiToken();
    if (!token) return false;

    const usage = await resetSourceUsageIfNewDay();
    if (!canEnqueue(priority, usage.lumen, LUMEN_BUDGET)) return false;

    const inserted = enqueue(queue, { kind: 'sender', sender_name: senderName, priority });
    if (!inserted) return false;

    updateQueueOverlay();
    scheduleProcessQueue();
    return true;
  }

  async function notifyNewComplaints(domain: string, count: number): Promise<void> {
    if (!(await getNotifyOnNew()) || count <= 0) return;

    try {
      chrome.notifications.create(`dmca-${domain}-${Date.now()}`, {
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icons/icon-128.png'),
        title: 'DMCA Watch',
        message: `${count} new complaint${count === 1 ? '' : 's'} detected for ${domain}`,
      }, () => {
        void chrome.runtime.lastError;
      });
    } catch {
      /* ignore */
    }
  }

  async function persistCheckSuccess(domain: string, incomingComplaints: Complaint[]): Promise<void> {
    const existing = await getDomain(domain);
    const base = baseRecord(domain, existing);
    const { complaints, newCountDelta } = mergeComplaints(existing?.complaints ?? [], incomingComplaints);
    const nextNewCount = (existing?.new_count ?? 0) + newCountDelta;
    const status = computeDomainStatus(complaints, nextNewCount);

    await saveDomain({
      ...base,
      complaints,
      last_checked: Date.now(),
      new_count: nextNewCount,
      status,
    });

    if (newCountDelta > 0) await notifyNewComplaints(domain, newCountDelta);
  }

  async function revertPendingState(domain: string): Promise<void> {
    const existing = await getDomain(domain);
    if (!existing) return;
    await saveDomain({
      ...existing,
      status: computeDomainStatus(existing.complaints, existing.new_count),
    });
  }

  function scheduleNext(delay: number): void {
    if (queueTimer) clearTimeout(queueTimer);
    queueTimer = setTimeout(() => {
      queueTimer = null;
      void processQueue();
    }, delay);
  }

  async function fetchComplaintsForDomain(domain: string): Promise<Complaint[]> {
    const existing = await getDomain(domain);
    const knownKeys = new Set((existing?.complaints ?? []).map((c) => complaintKey(c)));

    const { complaints: gtrComplaints, pagesFetched } = await searchGtrComplaintsByDomain(domain, { knownKeys });
    if (pagesFetched > 0) await incrementSourceUsageBy('gtr', pagesFetched);

    const lumenEnabled = await getLumenEnabled();
    if (!lumenEnabled) return gtrComplaints;

    const token = await getLumenApiToken();
    if (!token) return gtrComplaints;

    try {
      const lumenComplaints = await searchLumenComplaintsByDomain(domain, token);
      await incrementSourceUsage('lumen');
      return [...gtrComplaints, ...lumenComplaints];
    } catch (error) {
      if (isLumenAuthError(error)) {
        await saveSourceStatus('invalid');
      } else if (!isLumenNotImplementedError(error)) {
        console.warn(`DMCA Watch Lumen enrichment failed for ${domain}:`, error);
      }
      return gtrComplaints;
    }
  }

  async function processDomainItem(domain: string, key: string): Promise<void> {
    try {
      const complaints = await fetchComplaintsForDomain(domain);
      await persistCheckSuccess(domain, complaints);
      retryCount.delete(key);
    } catch (error) {
      console.warn(`DMCA Watch GTR check failed for ${domain}:`, error);

      const attempts = (retryCount.get(key) ?? 0) + 1;
      const transient = isGtrRateLimited(error) || error instanceof GtrRateLimitedError
        || (!(error instanceof GtrParseError));
      if (transient && attempts < RETRY.MAX_ATTEMPTS) {
        retryCount.set(key, attempts);
        enqueue(queue, { kind: 'domain', domain, priority: 'normal' });
        processing = null;
        updateQueueOverlay();
        const delay = isGtrRateLimited(error) ? RETRY.RATE_LIMIT_DELAY_MS : RETRY.NETWORK_DELAY_MS;
        scheduleNext(delay);
        return;
      }

      retryCount.delete(key);
      await revertPendingState(domain);
    }
  }

  async function processSenderItem(senderName: string, key: string): Promise<void> {
    const lumenEnabled = await getLumenEnabled();
    if (!lumenEnabled) {
      retryCount.delete(key);
      return;
    }

    const token = await getLumenApiToken();
    if (!token) {
      retryCount.delete(key);
      return;
    }

    try {
      const aggregates = await fetchLumenSenderProfile(senderName, token);
      await incrementSourceUsage('lumen');
      const prev = await getSenderProfile(senderName);
      const base = prev ?? (await buildLocalSenderProfile(senderName));
      await saveSenderProfile({
        ...base,
        ...aggregates,
        sender_name: senderName,
        source: 'lumen',
        fetched_at: Date.now(),
        status: 'fresh',
        error: null,
        source_health: prev?.source_health ?? [],
      });
      retryCount.delete(key);
    } catch (error) {
      if (isLumenAuthError(error)) await saveSourceStatus('invalid');
      if (isLumenNotImplementedError(error)) {
        retryCount.delete(key);
        return;
      }
      const attempts = (retryCount.get(key) ?? 0) + 1;
      if (attempts < RETRY.MAX_ATTEMPTS) {
        retryCount.set(key, attempts);
        enqueue(queue, { kind: 'sender', sender_name: senderName, priority: 'normal' });
        processing = null;
        updateQueueOverlay();
        scheduleNext(RETRY.NETWORK_DELAY_MS);
        return;
      }
      retryCount.delete(key);
      await markSenderError(senderName, error instanceof Error ? error.message : 'unknown');
    }
  }

  async function processQueue(): Promise<void> {
    if (processing || queueTimer || await isPaused()) return;

    const item = dequeue(queue);
    if (!item) {
      updateQueueOverlay();
      await refreshActiveBadge();
      return;
    }

    processing = item;
    updateQueueOverlay();

    const key = itemKey(item);

    if (item.kind === 'domain') {
      await processDomainItem(item.domain, key);
    } else {
      await processSenderItem(item.sender_name, key);
    }

    processing = null;
    updateQueueOverlay();
    await refreshActiveBadge();
    scheduleNext(item.kind === 'domain' ? GTR_THROTTLE_MS : LUMEN_THROTTLE_MS);
  }

  function scheduleProcessQueue(): void {
    if (processing || queueTimer) return;
    void processQueue();
  }

  async function tickWatchlist(): Promise<void> {
    const intervalHours = await getCheckInterval();
    const now = Date.now();
    const records = await getWatchlistDomains();

    for (const record of records) {
      const due = record.last_checked === 0
        || (now - record.last_checked) >= intervalHours * 60 * 60 * 1000;
      if (!due) continue;
      await requestDomainCheck(record.domain, 'normal', true);
    }
  }

  async function runSenderSourceHealth(senderName: string): Promise<boolean> {
    if (await isPaused()) return false;
    const profile = await getSenderProfile(senderName);
    if (!profile || profile.status !== 'fresh') return false;
    const urls = profile.top_source_urls.slice(0, SENDER_TOP_LIMIT).map((entry) => entry.name);
    if (!urls.length) return false;
    const health = await checkSourceHealthBatch(urls);
    const fresh = await getSenderProfile(senderName);
    if (!fresh) return false;
    await saveSenderProfile({ ...fresh, source_health: health });
    return true;
  }

  function respondAsync<T>(sendResponse: (response: T) => void, task: () => Promise<T>): true {
    void task().then(sendResponse).catch((error) => {
      console.warn('Background message handler failed:', error);
    });
    return true;
  }

  browser.tabs.onActivated.addListener(({ tabId }) => {
    void updateBadgeForTab(tabId);
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
      void updateBadgeForTab(tabId);
    }
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) void tickWatchlist();
  });

  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') {
      void browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') }).catch(() => {});
    }
    void createWatchlistAlarm();
  });

  browser.runtime.onStartup.addListener(() => {
    void createWatchlistAlarm();
    void initPause();
  });

  if (!import.meta.env.FIREFOX && actionApi?.onClicked) {
    actionApi.onClicked.addListener((tab) => {
      try {
        const sidePanel = (browser as unknown as { sidePanel?: { open: (opts: { tabId: number }) => Promise<void> } }).sidePanel;
        if (sidePanel?.open && tab?.id) {
          void sidePanel.open({ tabId: tab.id }).catch(() => {});
        }
      } catch {
        /* ignore */
      }
    });
  }

  browser.runtime.onMessage.addListener(
    ((message: RequestMessage, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
      switch (message.type) {
        case 'CHECK_DOMAIN':
          return respondAsync(sendResponse, async (): Promise<DomainActionResponse> => {
            const ok = await requestDomainCheck(message.domain, 'high');
            return { ok, error: ok ? undefined : 'queue_blocked' };
          });

        case 'ADD_DOMAIN':
          return respondAsync(sendResponse, async (): Promise<DomainActionResponse> => {
            const existing = await getDomain(message.domain);
            await saveDomain({ ...baseRecord(message.domain, existing, true), watchlist: true });
            const queued = await requestDomainCheck(message.domain, 'high', true);
            return { ok: true, error: queued ? undefined : 'check_deferred' };
          });

        case 'REMOVE_DOMAIN':
          return respondAsync(sendResponse, async (): Promise<DomainActionResponse> => {
            await removeDomain(message.domain);
            await refreshActiveBadge();
            return { ok: true };
          });

        case 'CHECK_ALL':
          return respondAsync(sendResponse, async (): Promise<DomainActionResponse> => {
            const watchlist = await getWatchlistDomains();
            for (const record of watchlist) {
              await requestDomainCheck(record.domain, 'high', true);
            }
            return { ok: true };
          });

        case 'GET_SENDER_PROFILE':
          return respondAsync(sendResponse, async (): Promise<SenderProfileResponse> => {
            const existing = await getSenderProfile(message.sender_name);
            const lumenEnabled = await getLumenEnabled();
            const needsRefresh = Boolean(message.forceRefresh)
              || !existing
              || existing.status === 'error'
              || isSenderProfileStale(existing);

            let profile: SenderProfile;
            if (needsRefresh) {
              profile = await buildLocalSenderProfile(message.sender_name);
              await saveSenderProfile(profile);
            } else {
              profile = existing;
            }

            let queued = false;
            if (lumenEnabled && (needsRefresh || profile.source !== 'lumen')) {
              await markSenderLoading(message.sender_name);
              queued = await requestLumenSenderLookup(message.sender_name, 'high');
            }

            const latest = await getSenderProfile(message.sender_name);
            return { profile: latest ?? profile, queued };
          });

        case 'CHECK_SENDER_SOURCE_HEALTH':
          return respondAsync(sendResponse, async (): Promise<DomainActionResponse> => {
            const ok = await runSenderSourceHealth(message.sender_name);
            return { ok, error: ok ? undefined : 'not_ready' };
          });

        case 'DISMISS_COMPLAINT':
          return respondAsync(sendResponse, async (): Promise<DomainActionResponse> => {
            await dismissComplaint(message.domain, message.complaintId);
            return { ok: true };
          });

        case 'MARK_DOMAIN_SEEN':
          return respondAsync(sendResponse, async (): Promise<DomainActionResponse> => {
            await markDomainSeen(message.domain);
            return { ok: true };
          });

        case 'SAVE_COMPLAINT_NOTE':
          return respondAsync(sendResponse, async (): Promise<DomainActionResponse> => {
            await saveComplaintNote(message.domain, message.complaintId, message.notes);
            return { ok: true };
          });

        case 'VERIFY_LUMEN_TOKEN':
          return respondAsync(sendResponse, async (): Promise<VerifyTokenResponse> => {
            await saveLumenApiToken(message.token);
            try {
              const result = await verifyLumenToken(message.token);
              await saveSourceStatus(result.status);
              return result;
            } catch (error) {
              if (isLumenNotImplementedError(error)) {
                const current = await getSourceStatus();
                if (current !== 'configured') {
                  await saveSourceStatus(message.token.trim() ? 'unverified' : 'not_configured');
                }
                return { ok: false, status: await getSourceStatus(), error: 'verification_unavailable' };
              }
              await saveSourceStatus('invalid');
              return { ok: false, status: 'invalid', error: error instanceof Error ? error.message : 'verification_failed' };
            }
          });

        case 'SET_LUMEN_ENABLED':
          return respondAsync(sendResponse, async (): Promise<DomainActionResponse> => {
            await saveLumenEnabled(message.enabled);
            if (!message.enabled) {
              await saveSourceStatus('not_configured');
            }
            return { ok: true };
          });

        case 'GET_QUEUE_STATUS':
          sendResponse({ length: queue.length, processing: processingLabel(processing) } satisfies QueueStatusResponse);
          return;

        case 'GET_SOURCE_STATUS':
          return respondAsync(sendResponse, async (): Promise<SourceStatusResponse> => ({
            status: await getSourceStatus(),
          }));

        case 'PAUSE':
          return respondAsync(sendResponse, async (): Promise<DomainActionResponse> => {
            await doPause(message.hours);
            return { ok: true };
          });

        case 'RESUME':
          return respondAsync(sendResponse, async (): Promise<DomainActionResponse> => {
            await doResume();
            return { ok: true };
          });

        case 'OPEN_SIDEPANEL':
          if (import.meta.env.FIREFOX) {
            try {
              (browser as unknown as { sidebarAction?: { open: () => void } }).sidebarAction?.open?.();
            } catch {
              /* ignore */
            }
            return;
          }

          try {
            const sidePanel = (browser as unknown as { sidePanel?: { open: (opts: { tabId: number }) => Promise<void> } }).sidePanel;
            if (sidePanel?.open) {
              if (sender.tab?.id) {
                void sidePanel.open({ tabId: sender.tab.id }).catch(() => {});
              } else {
                void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
                  if (tab?.id) void sidePanel.open({ tabId: tab.id }).catch(() => {});
                }).catch(() => {});
              }
            }
          } catch {
            /* ignore */
          }
          return;
      }
    }) as (...args: unknown[]) => void,
  );

  void createWatchlistAlarm();
  void initPause();
  void refreshActiveBadge();
});
