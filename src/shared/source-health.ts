import type { SourceHealth } from './types';

interface WaybackResponse {
  archived_snapshots?: {
    closest?: {
      available?: boolean;
      url?: string;
      timestamp?: string;
    };
  };
}

function parseWaybackTimestamp(timestamp: string | undefined): number | null {
  if (!timestamp || timestamp.length < 14) return null;
  const y = Number(timestamp.slice(0, 4));
  const m = Number(timestamp.slice(4, 6));
  const d = Number(timestamp.slice(6, 8));
  const h = Number(timestamp.slice(8, 10));
  const mi = Number(timestamp.slice(10, 12));
  const s = Number(timestamp.slice(12, 14));
  const ts = Date.UTC(y, m - 1, d, h, mi, s);
  return Number.isFinite(ts) ? ts : null;
}

async function checkHttp(url: string, signal: AbortSignal): Promise<number | null> {
  try {
    const response = await fetch(url, { method: 'HEAD', signal, redirect: 'follow', mode: 'cors' });
    return response.status;
  } catch {
    return null;
  }
}

async function checkArchive(url: string, signal: AbortSignal): Promise<{ timestamp: number | null; snapshotUrl: string | null }> {
  try {
    const response = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
      { method: 'GET', signal, mode: 'cors' },
    );
    if (!response.ok) return { timestamp: null, snapshotUrl: null };
    const data = (await response.json()) as WaybackResponse;
    const closest = data.archived_snapshots?.closest;
    if (!closest?.available) return { timestamp: null, snapshotUrl: null };
    return {
      timestamp: parseWaybackTimestamp(closest.timestamp),
      snapshotUrl: closest.url ?? null,
    };
  } catch {
    return { timestamp: null, snapshotUrl: null };
  }
}

export async function checkSourceHealth(url: string, timeoutMs = 10_000): Promise<SourceHealth> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const [httpStatus, archive] = await Promise.all([
      checkHttp(url, controller.signal),
      checkArchive(url, controller.signal),
    ]);
    return {
      url,
      checked_at: Date.now(),
      http_status: httpStatus,
      archive_last_snapshot: archive.timestamp,
      archive_snapshot_url: archive.snapshotUrl,
      error: null,
    };
  } catch (error) {
    return {
      url,
      checked_at: Date.now(),
      http_status: null,
      archive_last_snapshot: null,
      archive_snapshot_url: null,
      error: error instanceof Error ? error.message : 'unknown',
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkSourceHealthBatch(urls: string[]): Promise<SourceHealth[]> {
  const results: SourceHealth[] = [];
  for (const url of urls) {
    results.push(await checkSourceHealth(url));
  }
  return results;
}
