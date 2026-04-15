import type { QueueItem, QueuePriority, DomainRecord, ApiUsage } from './types';
import { ADHOC_COOLDOWN_MS } from './constants';

export interface BudgetLimits {
  readonly WATCHLIST_RESERVE: number;
  readonly AD_HOC_LIMIT: number;
  readonly HARD_CAP: number;
  readonly DAILY_MAX: number;
}

const PRIORITY_ORDER: Record<QueuePriority, number> = { high: 0, normal: 1, low: 2 };

export function itemKey(item: QueueItem): string {
  return item.kind === 'domain' ? `d:${item.domain}` : `s:${item.sender_name}`;
}

export function enqueue(queue: QueueItem[], item: QueueItem): boolean {
  const key = itemKey(item);
  if (queue.some((existing) => itemKey(existing) === key)) return false;

  const insertIdx = queue.findIndex((existing) => PRIORITY_ORDER[existing.priority] > PRIORITY_ORDER[item.priority]);
  if (insertIdx === -1) {
    queue.push(item);
  } else {
    queue.splice(insertIdx, 0, item);
  }
  return true;
}

export function enqueueDomain(queue: QueueItem[], domain: string, priority: QueuePriority): boolean {
  return enqueue(queue, { kind: 'domain', domain, priority });
}

export function enqueueSender(queue: QueueItem[], sender_name: string, priority: QueuePriority): boolean {
  return enqueue(queue, { kind: 'sender', sender_name, priority });
}

export function dequeue(queue: QueueItem[]): QueueItem | undefined {
  return queue.shift();
}

export function isQueued(queue: QueueItem[], item: QueueItem): boolean {
  const key = itemKey(item);
  return queue.some((existing) => itemKey(existing) === key);
}

export function canEnqueue(priority: QueuePriority, usage: ApiUsage, budget: BudgetLimits): boolean {
  if (priority === 'high') return true;
  if (priority === 'low' && usage.count >= budget.WATCHLIST_RESERVE) return false;
  if (priority === 'normal' && usage.count >= budget.HARD_CAP) return false;
  return true;
}

export function isInCooldown(record: DomainRecord | undefined): boolean {
  if (!record) return false;
  if (record.watchlist) return false;
  return record.last_checked > 0 && (Date.now() - record.last_checked) < ADHOC_COOLDOWN_MS;
}
