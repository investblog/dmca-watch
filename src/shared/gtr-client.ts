import type { Complaint, SenderAggregateEntry, SenderMonthlyCount } from './types';
import { GTR_API_BASE, GTR_REQUESTS_PAGE_SIZE, GTR_WEB_BASE } from './constants';

export class GtrNetworkError extends Error {
  constructor(message = 'GTR network error') {
    super(message);
    this.name = 'GtrNetworkError';
  }
}

export class GtrRateLimitedError extends Error {
  constructor(message = 'GTR rate limited (HTTP 429)') {
    super(message);
    this.name = 'GtrRateLimitedError';
  }
}

export class GtrServerError extends Error {
  readonly httpStatus: number;
  constructor(httpStatus: number, message = `GTR server error ${httpStatus}`) {
    super(message);
    this.name = 'GtrServerError';
    this.httpStatus = httpStatus;
  }
}

export class GtrParseError extends Error {
  constructor(message = 'GTR response shape is not what we expected') {
    super(message);
    this.name = 'GtrParseError';
  }
}

export function isGtrRateLimited(error: unknown): error is GtrRateLimitedError {
  return error instanceof GtrRateLimitedError;
}

export function isGtrParseError(error: unknown): error is GtrParseError {
  return error instanceof GtrParseError;
}

export function isGtrNetworkError(error: unknown): error is GtrNetworkError {
  return error instanceof GtrNetworkError;
}

const ANTI_XSSI_PREFIX = ")]}'";

function stripAntiXssi(text: string): string {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith(ANTI_XSSI_PREFIX)) return trimmed;
  const newline = trimmed.indexOf('\n');
  return newline < 0 ? trimmed.slice(ANTI_XSSI_PREFIX.length) : trimmed.slice(newline + 1);
}

async function gtrFetchJson<T = unknown>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { method: 'GET', credentials: 'omit', mode: 'cors' });
  } catch (error) {
    throw new GtrNetworkError(error instanceof Error ? error.message : 'network failure');
  }

  if (response.status === 429) throw new GtrRateLimitedError();
  if (response.status >= 500) throw new GtrServerError(response.status);
  if (!response.ok) throw new GtrServerError(response.status);

  const text = await response.text();
  const stripped = stripAntiXssi(text);
  try {
    return JSON.parse(stripped) as T;
  } catch {
    throw new GtrParseError();
  }
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function unwrapResponse(raw: unknown): unknown[] {
  const outer = asArray(raw);
  const wrapper = asArray(outer[0]);
  return asArray(wrapper[1]);
}

function parseRequestEntry(entry: unknown, domain: string): Complaint | null {
  const arr = asArray(entry);
  if (arr.length < 7) return null;

  const id = asString(arr[0]);
  if (!id) return null;

  const reporterArr = asArray(arr[2]);
  const ownerArr = asArray(arr[5]);

  const reporterId = asString(reporterArr[1]);
  const reporterName = asString(reporterArr[2], 'Unknown reporter');
  const ownerId = asString(ownerArr[1]);
  const ownerName = asString(ownerArr[2]);

  const sourceUrl = ownerId
    ? `${GTR_WEB_BASE}/owners/?id=${encodeURIComponent(ownerId)}`
    : reporterId
      ? `${GTR_WEB_BASE}/reporters/?id=${encodeURIComponent(reporterId)}`
      : `${GTR_WEB_BASE}/domains/${encodeURIComponent(domain)}`;

  return {
    id,
    source: 'gtr',
    date: asNumber(arr[1]),
    sender: reporterName,
    principal: ownerName || null,
    urls_total: asNumber(arr[3]),
    urls_removed: asNumber(arr[6]),
    targeted_urls: [],
    jurisdiction: 'DMCA',
    source_url: sourceUrl,
    dismissed_by_user: false,
    notes: null,
  };
}

export async function verifyGtrReachable(): Promise<boolean> {
  try {
    await gtrFetchJson(`${GTR_API_BASE}/overview/summary`);
    return true;
  } catch {
    return false;
  }
}

export const GTR_MAX_PAGES_PER_FETCH = 10;
const GTR_INTRA_FETCH_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface GtrPage {
  complaints: Complaint[];
  nextCursor: string | null;
}

export async function fetchGtrComplaintsPage(
  domain: string,
  cursor: string | null = null,
): Promise<GtrPage> {
  const encodedDomain = encodeURIComponent(domain);
  const url = cursor
    ? `${GTR_API_BASE}/requests/summary/page?size=${GTR_REQUESTS_PAGE_SIZE}&domain=${encodedDomain}&p=${encodeURIComponent(cursor)}`
    : `${GTR_API_BASE}/requests/summary?size=${GTR_REQUESTS_PAGE_SIZE}&domain=${encodedDomain}`;
  const raw = await gtrFetchJson(url);
  const outer = asArray(raw);
  const wrapper = asArray(outer[0]);
  const entries = asArray(wrapper[1]);
  const paginationMeta = asArray(wrapper[2]);

  const complaints: Complaint[] = [];
  for (const entry of entries) {
    const complaint = parseRequestEntry(entry, domain);
    if (complaint) complaints.push(complaint);
  }

  // Pagination meta shape (verified live 2026-04-15):
  //   [0] = previous page cursor (null on page 1)
  //   [1] = next page cursor
  //   [2] = last page cursor
  //   [3] = current page number (1-indexed)
  //   [4] = total page count
  // Next-page fetches go to `/requests/summary/page?p=<cursor>` (NOT `/requests/summary?start=...`).
  let nextCursor: string | null = asString(paginationMeta[1]) || null;
  const currentPage = asNumber(paginationMeta[3]);
  const totalPages = asNumber(paginationMeta[4]);

  if (complaints.length < GTR_REQUESTS_PAGE_SIZE) nextCursor = null;
  if (totalPages > 0 && currentPage > 0 && currentPage >= totalPages) nextCursor = null;
  if (nextCursor && cursor && nextCursor === cursor) nextCursor = null;

  return { complaints, nextCursor };
}

export interface FetchGtrOptions {
  maxPages?: number;
  knownKeys?: ReadonlySet<string>;
}

export type GtrStopReason = 'overlap' | 'end-of-list' | 'max-pages';

export interface GtrFetchResult {
  complaints: Complaint[];
  pagesFetched: number;
  stoppedBy: GtrStopReason;
}

export async function searchGtrComplaintsByDomain(
  domain: string,
  options: FetchGtrOptions = {},
): Promise<GtrFetchResult> {
  const maxPages = options.maxPages ?? GTR_MAX_PAGES_PER_FETCH;
  const knownKeys = options.knownKeys ?? new Set<string>();
  const isRefresh = knownKeys.size > 0;

  const accumulated: Complaint[] = [];
  let cursor: string | null = null;
  let pagesFetched = 0;
  let stoppedBy: GtrStopReason = 'max-pages';

  for (let pageIdx = 0; pageIdx < maxPages; pageIdx++) {
    if (pageIdx > 0) await sleep(GTR_INTRA_FETCH_DELAY_MS);

    const page = await fetchGtrComplaintsPage(domain, cursor);
    pagesFetched += 1;
    accumulated.push(...page.complaints);

    if (isRefresh) {
      const overlap = page.complaints.some((c) => knownKeys.has(`gtr:${c.id}`));
      if (overlap) {
        stoppedBy = 'overlap';
        break;
      }
    }

    if (!page.nextCursor) {
      stoppedBy = 'end-of-list';
      break;
    }
    cursor = page.nextCursor;
  }

  return { complaints: accumulated, pagesFetched, stoppedBy };
}

export interface GtrDomainAggregates {
  top_reporters: SenderAggregateEntry[];
  top_reporters_last_activity: Record<string, number>;
  top_owners: SenderAggregateEntry[];
  top_owners_last_activity: Record<string, number>;
  monthly_counts: SenderMonthlyCount[];
}

interface AggregateRow {
  name: string;
  count: number;
  last_activity: number;
}

function parseSummaryEntries(raw: unknown): AggregateRow[] {
  const rows: AggregateRow[] = [];
  for (const entry of unwrapResponse(raw)) {
    const entryArr = asArray(entry);
    const named = asArray(entryArr[0]);
    const name = asString(named[2]);
    if (!name) continue;
    rows.push({
      name,
      count: asNumber(entryArr[1]),
      last_activity: asNumber(entryArr[2]),
    });
  }
  return rows;
}

function parseUrlsRemovedTimeseries(raw: unknown): SenderMonthlyCount[] {
  const byMonth = new Map<string, number>();
  for (const entry of unwrapResponse(raw)) {
    const entryArr = asArray(entry);
    const ts = asNumber(entryArr[0]);
    if (!ts) continue;
    const countOuter = asArray(asArray(entryArr[1])[0]);
    const count = asNumber(countOuter[0]);
    const month = new Date(ts).toISOString().slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + count);
  }
  return [...byMonth.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export async function fetchGtrDomainAggregates(
  domain: string,
  topLimit: number,
): Promise<GtrDomainAggregates> {
  const [reportersRaw, ownersRaw, urlsRemovedRaw] = await Promise.all([
    gtrFetchJson(`${GTR_API_BASE}/reporters/summary?size=${topLimit}&domain=${encodeURIComponent(domain)}`),
    gtrFetchJson(`${GTR_API_BASE}/owners/summary?size=${topLimit}&domain=${encodeURIComponent(domain)}`),
    gtrFetchJson(`${GTR_API_BASE}/overview/urlsremoved?domain=${encodeURIComponent(domain)}`),
  ]);

  const reporters = parseSummaryEntries(reportersRaw);
  const owners = parseSummaryEntries(ownersRaw);

  const reportersLast: Record<string, number> = {};
  for (const entry of reporters) reportersLast[entry.name] = entry.last_activity;
  const ownersLast: Record<string, number> = {};
  for (const entry of owners) ownersLast[entry.name] = entry.last_activity;

  return {
    top_reporters: reporters.map(({ name, count }) => ({ name, count })),
    top_reporters_last_activity: reportersLast,
    top_owners: owners.map(({ name, count }) => ({ name, count })),
    top_owners_last_activity: ownersLast,
    monthly_counts: parseUrlsRemovedTimeseries(urlsRemovedRaw),
  };
}
