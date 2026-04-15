export type ComplaintSource = 'gtr' | 'lumen';

export type DomainStatus = 'clean' | 'has_complaints' | 'has_new' | 'pending' | 'unknown';

export type QueuePriority = 'high' | 'normal' | 'low';

export type SenderProfileStatus = 'fresh' | 'loading' | 'error' | 'stale';

export type Theme = 'dark' | 'light';
export type ThemePreference = Theme | 'auto';
export type CheckInterval = 12 | 24 | 72 | 168;

export type LumenStatus = 'configured' | 'unverified' | 'invalid' | 'not_configured';
export type SourceStatus = LumenStatus;

export interface Complaint {
  id: string;
  source: ComplaintSource;
  date: number;
  sender: string;
  principal: string | null;
  urls_total: number;
  urls_removed: number;
  targeted_urls: string[];
  jurisdiction: string | null;
  source_url: string;
  dismissed_by_user: boolean;
  notes: string | null;
}

export interface DomainRecord {
  domain: string;
  watchlist: boolean;
  added_at: number;
  last_checked: number;
  complaints: Complaint[];
  last_seen_complaint_id: string | null;
  new_count: number;
  status: DomainStatus;
}

export interface ApiUsage {
  count: number;
  date: string;
}

export type SourceUsageMap = Record<ComplaintSource, ApiUsage>;

export type QueueItem =
  | { kind: 'domain'; domain: string; priority: QueuePriority }
  | { kind: 'sender'; sender_name: string; priority: QueuePriority };

export interface QueueStatus {
  length: number;
  processing: string | null;
}

export interface SenderAggregateEntry {
  name: string;
  count: number;
}

export interface SenderMonthlyCount {
  month: string;
  count: number;
}

export interface SourceHealth {
  url: string;
  checked_at: number;
  http_status: number | null;
  archive_last_snapshot: number | null;
  archive_snapshot_url: string | null;
  error: string | null;
}

export interface SenderProfile {
  sender_name: string;
  source: ComplaintSource;
  fetched_at: number;
  status: SenderProfileStatus;
  error: string | null;
  total_notices: number;
  sampled_notices: number;
  first_activity: number | null;
  last_activity: number | null;
  monthly_counts: SenderMonthlyCount[];
  cross_watchlist: Array<{ domain: string; count: number; last_activity: number }>;
  top_principals: SenderAggregateEntry[];
  top_recipients: SenderAggregateEntry[];
  top_target_hosts: SenderAggregateEntry[];
  top_source_urls: SenderAggregateEntry[];
  jurisdictions: SenderAggregateEntry[];
  source_health: SourceHealth[];
}
