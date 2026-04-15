import type { DomainStatus } from './types';

export const GTR_BUDGET = {
  WATCHLIST_RESERVE: 800,
  AD_HOC_LIMIT: 200,
  HARD_CAP: 1000,
  DAILY_MAX: 1200,
} as const;

export const LUMEN_BUDGET = {
  WATCHLIST_RESERVE: 400,
  AD_HOC_LIMIT: 100,
  HARD_CAP: 480,
  DAILY_MAX: 500,
} as const;

export const GTR_THROTTLE_MS = 5_000;
export const LUMEN_THROTTLE_MS = 10_000;
export const ADHOC_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export const ALARM_NAME = 'watchlist-tick';
export const ALARM_PERIOD_MINUTES = 60;

export const BADGE_CONFIG: Record<DomainStatus, { color: string; text: string }> = {
  clean: { color: '#22c55e', text: '\u2713' },
  has_complaints: { color: '#6b7280', text: 'i' },
  has_new: { color: '#ef4444', text: '!' },
  pending: { color: '#3b82f6', text: '\u2026' },
  unknown: { color: '#6b7280', text: '?' },
};

export const BADGE_PAUSE = { color: '#f59e0b', text: 'II' } as const;
export const BADGE_QUEUE_COLOR = '#3b82f6';

export const UNSUPPORTED_PROTOCOLS = [
  'chrome:',
  'chrome-extension:',
  'edge:',
  'about:',
  'moz-extension:',
  'file:',
  'data:',
  'blob:',
];

export const STORAGE_KEYS = {
  DOMAINS: 'domains',
  SOURCE_USAGE: 'source_usage',
  SENDER_PROFILES: 'sender_profiles',
  LUMEN_API_TOKEN: 'lumen_api_token',
  LUMEN_ENABLED: 'lumen_enabled',
  CHECK_INTERVAL: 'check_interval_hours',
  THEME: 'theme',
  PAUSE_UNTIL: 'pause_until',
  EXCLUDED_DOMAINS: 'excluded_domains',
  NOTIFY_ON_NEW: 'notify_on_new',
  SOURCE_STATUS: 'source_status',
} as const;

export const GTR_API_BASE = 'https://transparencyreport.google.com/transparencyreport/api/v3/copyright';
export const GTR_WEB_BASE = 'https://transparencyreport.google.com/copyright';

export const FRESHNESS_LAG_LABEL = 'Source data is typically 30–60 days behind real-time events.';

export const SENDER_PROFILE_TTL_MS = 24 * 60 * 60 * 1000;
export const SENDER_PROFILE_SAMPLE_PAGES = 5;
export const SENDER_PROFILE_PAGE_SIZE = 100;
export const SENDER_TOP_LIMIT = 10;
export const GTR_REQUESTS_PAGE_SIZE = 10;

export const DEFAULT_EXCLUDED_DOMAINS: string[] = [
  'google.com',
  'youtube.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'github.com',
  'reddit.com',
  'wikipedia.org',
  'lumendatabase.org',
  'transparencyreport.google.com',
];

export const RETRY = {
  MAX_ATTEMPTS: 3,
  NETWORK_DELAY_MS: 30_000,
  RATE_LIMIT_DELAY_MS: 60_000,
} as const;
