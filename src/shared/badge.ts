import type { Complaint, DomainRecord, DomainStatus } from './types';
import { BADGE_CONFIG } from './constants';

export interface BadgeDescriptor {
  text: string;
  color: string;
}

export const BADGE_EMPTY: BadgeDescriptor = { text: '', color: '' };

export function computeDomainStatus(
  complaints: Complaint[],
  newCount: number,
  pending = false,
): DomainStatus {
  if (pending) return 'pending';
  if (newCount > 0) return 'has_new';
  if (complaints.length > 0) return 'has_complaints';
  return 'clean';
}

export function computeBadge(record: DomainRecord | null): BadgeDescriptor {
  if (!record) return BADGE_EMPTY;
  return BADGE_CONFIG[record.status] ?? BADGE_CONFIG.unknown;
}
