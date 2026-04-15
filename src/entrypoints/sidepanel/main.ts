import { browser } from 'wxt/browser';
import { applyI18n, _ } from '@shared/i18n';
import { getThemePreference, initTheme, toggleTheme } from '@shared/theme';
import { showToast } from '@shared/ui-helpers';
import { extractDomain, normalizeDomainInput, toUnicode } from '@shared/domain-utils';
import {
  getDomains,
  getSourceUsage,
  isPaused,
} from '@shared/db';
import { sendMessage } from '@shared/messaging';
import type { Complaint, DomainRecord, DomainStatus } from '@shared/types';
import { FRESHNESS_LAG_LABEL, STORAGE_KEYS } from '@shared/constants';
import { openDisputeDrawer } from './components/dispute-drawer';
import { openSenderDrawer } from './components/sender-drawer';
import { openSettingsDrawer } from './components/settings-drawer';

type ViewName = 'watchlist' | 'current';

const statusClassMap: Record<DomainStatus, string> = {
  clean: 'clean',
  has_complaints: 'unknown',
  has_new: 'malicious',
  pending: 'pending',
  unknown: 'unknown',
};

interface ActionGate {
  canCheck: boolean;
  reason: string | null;
}

function computeGate(paused: boolean): ActionGate {
  if (paused) return { canCheck: false, reason: 'Paused — resume to check' };
  return { canCheck: true, reason: null };
}

let currentGate: ActionGate = { canCheck: true, reason: null };

function applyAddDomainGate(gate: ActionGate): void {
  currentGate = gate;
  const button = document.getElementById('btnAddDomain') as HTMLButtonElement | null;
  if (!button) return;
  button.disabled = !gate.canCheck;
  if (gate.reason) button.title = gate.reason;
  else button.removeAttribute('title');
}

let forcedDomain: string | null = null;
let lastSeenMarker = '';

function showView(name: ViewName): void {
  document.querySelectorAll<HTMLElement>('[data-view-content]').forEach((element) => {
    element.hidden = element.dataset.viewContent !== name;
  });
  document.querySelectorAll<HTMLElement>('.nav-tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.tab === name);
  });
}

function timeAgo(ts: number): string {
  if (!ts) return 'never';
  const diffMinutes = Math.floor((Date.now() - ts) / 60_000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

type ContextTab = Awaited<ReturnType<typeof browser.tabs.query>>[number] | null;

async function getContextTab(): Promise<ContextTab> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return tab ?? null;
  } catch {
    return null;
  }
}

function updateFooterCount(records: Record<string, DomainRecord>): void {
  const footerCount = document.getElementById('footerCount') as HTMLElement;
  const count = Object.values(records).filter((record) => record.watchlist).length;
  footerCount.textContent = String(count);
  footerCount.title = `${count} domains`;
}

interface ContributorStats {
  count: number;
  last_activity: number;
}

function aggregateBy(
  complaints: Complaint[],
  selector: (c: Complaint) => string | null,
): Array<[string, ContributorStats]> {
  const map = new Map<string, ContributorStats>();
  for (const complaint of complaints) {
    const name = selector(complaint);
    if (!name) continue;
    const entry = map.get(name) ?? { count: 0, last_activity: 0 };
    entry.count += 1;
    if (complaint.date > entry.last_activity) entry.last_activity = complaint.date;
    map.set(name, entry);
  }
  return [...map.entries()]
    .sort(([, a], [, b]) => b.count - a.count || b.last_activity - a.last_activity)
    .slice(0, 5);
}

function buildContributorList(label: string, entries: Array<[string, ContributorStats]>): HTMLElement {
  const section = document.createElement('div');
  section.className = 'sender-section';

  const heading = document.createElement('h4');
  heading.className = 'sender-section__title';
  heading.textContent = label;
  section.appendChild(heading);

  const list = document.createElement('ul');
  list.className = 'sender-list';
  for (const [name, stats] of entries) {
    const li = document.createElement('li');
    li.className = 'sender-list__row';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sender-list__name sender-link';
    btn.textContent = name;
    btn.title = `Last activity ${new Date(stats.last_activity).toLocaleDateString()}`;
    btn.addEventListener('click', () => openSenderDrawer(name));
    const count = document.createElement('span');
    count.className = 'sender-list__count';
    count.textContent = String(stats.count);
    li.append(btn, count);
    list.appendChild(li);
  }
  section.appendChild(list);
  return section;
}

function buildTopContributorsCard(record: DomainRecord): HTMLElement | null {
  if (!record.complaints.length) return null;

  const topReporters = aggregateBy(record.complaints, (c) => c.sender || null);
  const topOwners = aggregateBy(record.complaints, (c) => c.principal);

  if (!topReporters.length && !topOwners.length) return null;

  const card = document.createElement('fieldset');
  card.className = 'inspect-card';
  card.innerHTML = '<legend><span class="inspect-card__eyebrow-label">Who is hitting this domain</span></legend>';

  if (topReporters.length) card.appendChild(buildContributorList('Top reporters', topReporters));
  if (topOwners.length) card.appendChild(buildContributorList('Top copyright owners', topOwners));

  return card;
}

function createComplaintCard(domain: string, complaint: Complaint): HTMLElement {
  const card = document.createElement('div');
  card.className = 'vendor-card';

  const header = document.createElement('div');
  header.className = 'vendor-card__header';

  const senderBtn = document.createElement('button');
  senderBtn.type = 'button';
  senderBtn.className = 'sender-link';
  senderBtn.textContent = complaint.sender;
  senderBtn.title = `Investigate ${complaint.sender}`;
  senderBtn.addEventListener('click', () => {
    openSenderDrawer(complaint.sender);
  });

  const datePart = document.createElement('span');
  datePart.className = 'vendor-card__verdict';
  datePart.textContent = ` · ${new Date(complaint.date).toLocaleDateString()}`;
  header.append(senderBtn, datePart);

  const summary = document.createElement('div');
  summary.className = 'vendor-card__preview';
  const principalLine = complaint.principal && complaint.principal !== complaint.sender
    ? `On behalf of ${complaint.principal}\n`
    : '';
  const countsLine = `${complaint.urls_removed} URL${complaint.urls_removed === 1 ? '' : 's'} removed of ${complaint.urls_total} in the original request`;
  summary.textContent = `${principalLine}${countsLine}`;

  const actions = document.createElement('div');
  actions.className = 'domain-card__actions';

  if (complaint.targeted_urls.length > 0) {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn--outline btn--sm';
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy URLs';
    copyBtn.addEventListener('click', () => {
      void navigator.clipboard.writeText(complaint.targeted_urls.join('\n')).then(() => {
        showToast('URLs copied', 'success');
      });
    });
    actions.append(copyBtn);
  }

  const sourceBtn = document.createElement('a');
  sourceBtn.className = 'btn btn--ghost btn--sm';
  sourceBtn.href = complaint.source_url;
  sourceBtn.target = '_blank';
  sourceBtn.rel = 'noreferrer';
  sourceBtn.textContent = complaint.source === 'lumen' ? 'View on Lumen' : 'View on GTR';

  const resolveBtn = document.createElement('button');
  resolveBtn.className = 'btn btn--ghost btn--sm';
  resolveBtn.type = 'button';
  resolveBtn.textContent = complaint.dismissed_by_user ? 'Resolved' : 'Mark resolved';
  resolveBtn.disabled = complaint.dismissed_by_user;
  resolveBtn.addEventListener('click', () => {
    void sendMessage({ type: 'DISMISS_COMPLAINT', domain, complaintId: complaint.id }).then(() => {
      showToast('Complaint marked as resolved', 'success');
    });
  });

  const disputeBtn = document.createElement('button');
  disputeBtn.className = 'btn btn--primary btn--sm';
  disputeBtn.type = 'button';
  disputeBtn.textContent = 'Draft counter-notice';
  disputeBtn.addEventListener('click', () => openDisputeDrawer(domain, complaint));

  actions.append(sourceBtn, resolveBtn, disputeBtn);
  card.append(header, summary, actions);
  return card;
}

function renderWatchlist(records: Record<string, DomainRecord>, gate: ActionGate): void {
  updateFooterCount(records);
  const container = document.getElementById('watchlistContainer') as HTMLElement;
  container.replaceChildren();

  const domains = Object.values(records)
    .filter((record) => record.watchlist)
    .sort((a, b) => b.added_at - a.added_at);

  if (!domains.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = _('emptyWatchlist', 'No domains yet. Add your first domain above.');
    container.appendChild(empty);
    return;
  }

  for (const record of domains) {
    const card = document.createElement('div');
    card.className = 'domain-card';

    const dot = document.createElement('span');
    dot.className = `status-dot status-dot--${statusClassMap[record.status]}`;

    const info = document.createElement('div');
    info.className = 'domain-card__info';

    const name = document.createElement('div');
    name.className = 'domain-card__name';
    name.textContent = toUnicode(record.domain);

    const meta = document.createElement('div');
    meta.className = 'domain-card__meta';
    meta.textContent = record.last_checked
      ? `Last checked ${timeAgo(record.last_checked)}`
      : 'Not checked yet';
    meta.title = FRESHNESS_LAG_LABEL;

    info.append(name, meta);

    const actions = document.createElement('div');
    actions.className = 'domain-card__actions';

    const checkBtn = document.createElement('button');
    checkBtn.className = 'btn btn--outline btn--sm';
    checkBtn.type = 'button';
    checkBtn.textContent = record.status === 'pending' ? 'Queued' : _('checkNowBtn', 'Check now');
    checkBtn.disabled = record.status === 'pending' || !gate.canCheck;
    if (!gate.canCheck && gate.reason) checkBtn.title = gate.reason;
    checkBtn.addEventListener('click', () => {
      void sendMessage({ type: 'CHECK_DOMAIN', domain: record.domain });
    });

    const openBtn = document.createElement('button');
    openBtn.className = 'btn btn--ghost btn--sm';
    openBtn.type = 'button';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', () => {
      forcedDomain = record.domain;
      showView('current');
      void renderCurrentSite();
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn--ghost btn--sm';
    removeBtn.type = 'button';
    removeBtn.textContent = _('removeBtn', 'Remove');
    removeBtn.addEventListener('click', () => {
      void sendMessage({ type: 'REMOVE_DOMAIN', domain: record.domain });
    });

    actions.append(checkBtn, openBtn, removeBtn);
    card.append(dot, info, actions);
    container.appendChild(card);
  }
}

async function renderCurrentSite(): Promise<void> {
  const container = document.getElementById('currentSiteInfo') as HTMLElement;
  container.replaceChildren();

  const paused = await isPaused();
  const gate = computeGate(paused);
  const tab = await getContextTab();
  const activeDomain = forcedDomain ?? (tab?.url ? extractDomain(tab.url) : null);

  if (!activeDomain) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = _('unsupportedPage', 'This page type is not supported');
    container.appendChild(empty);
    return;
  }

  const records = await getDomains();
  const record = records[activeDomain];
  const visualStatus = statusClassMap[record?.status ?? 'unknown'];

  const summary = document.createElement('fieldset');
  summary.className = 'inspect-card';
  const lastCheckedLine = record?.last_checked
    ? `Last checked ${timeAgo(record.last_checked)}`
    : 'Not checked yet — press Check now';
  summary.innerHTML = [
    '<legend><span class="inspect-card__eyebrow-label">Current site</span></legend>',
    '<div class="inspect-card__summary">',
    `<span class="inspect-card__domain">${toUnicode(activeDomain)}</span>`,
    `<div class="inspect-card__verdict-row"><span class="inspect-card__verdict"><span class="status-dot status-dot--${visualStatus}"></span><span class="verdict-chip verdict-chip--${visualStatus}">${record?.status ?? 'unknown'}</span></span></div>`,
    `<span class="inspect-card__headline">${record ? `${record.complaints.length} complaints (${record.new_count} new)` : 'No local data yet'}</span>`,
    `<span class="inspect-card__body" title="${FRESHNESS_LAG_LABEL}">${lastCheckedLine}</span>`,
    '</div>',
  ].join('');

  const toolbar = document.createElement('div');
  toolbar.className = 'inspect-card__toolbar';

  const checkBtn = document.createElement('button');
  checkBtn.className = 'btn btn--primary btn--sm';
  checkBtn.type = 'button';
  checkBtn.textContent = _('checkNowBtn', 'Check now');
  checkBtn.disabled = !gate.canCheck;
  if (!gate.canCheck && gate.reason) checkBtn.title = gate.reason;
  checkBtn.addEventListener('click', () => {
    void sendMessage({ type: 'CHECK_DOMAIN', domain: activeDomain });
  });

  const watchlistBtn = document.createElement('button');
  watchlistBtn.className = 'btn btn--outline btn--sm';
  watchlistBtn.type = 'button';
  watchlistBtn.textContent = record?.watchlist ? 'In watchlist' : _('addToWatchlistBtn', 'Add to watchlist');
  watchlistBtn.disabled = Boolean(record?.watchlist) || !gate.canCheck;
  if (!gate.canCheck && gate.reason && !record?.watchlist) watchlistBtn.title = gate.reason;
  watchlistBtn.addEventListener('click', () => {
    void sendMessage({ type: 'ADD_DOMAIN', domain: activeDomain });
  });

  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'btn btn--ghost btn--sm';
  settingsBtn.type = 'button';
  settingsBtn.textContent = 'Settings';
  settingsBtn.addEventListener('click', openSettingsDrawer);

  toolbar.append(checkBtn, watchlistBtn, settingsBtn);
  summary.appendChild(toolbar);
  container.appendChild(summary);

  if (record) {
    const contributorsCard = buildTopContributorsCard(record);
    if (contributorsCard) container.appendChild(contributorsCard);
  }

  if (record?.new_count) {
    const marker = `${activeDomain}:${record.new_count}:${record.last_seen_complaint_id ?? ''}`;
    if (marker !== lastSeenMarker) {
      lastSeenMarker = marker;
      void sendMessage({ type: 'MARK_DOMAIN_SEEN', domain: activeDomain });
    }
  }

  if (!record?.complaints.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = record?.last_checked
      ? 'No DMCA complaints found for this domain in Google Transparency Report.'
      : 'Press "Check now" to fetch complaint history from Google Transparency Report.';
    container.appendChild(empty);
    return;
  }

  for (const complaint of record.complaints) {
    container.appendChild(createComplaintCard(activeDomain, complaint));
  }
}

async function updateFooterUsage(): Promise<void> {
  const footerUsage = document.getElementById('footerUsage') as HTMLElement;
  const usage = await getSourceUsage();
  footerUsage.textContent = String(usage.gtr.count);
  footerUsage.title = `${usage.gtr.count} GTR requests today${usage.lumen.count > 0 ? ` · ${usage.lumen.count} Lumen requests today` : ''}`;
}

async function pollQueueStatus(): Promise<void> {
  const footerQueue = document.getElementById('footerQueue') as HTMLElement;
  const footer = document.getElementById('panelFooter') as HTMLElement;

  try {
    const status = await sendMessage({ type: 'GET_QUEUE_STATUS' });
    const total = status.length + (status.processing ? 1 : 0);
    footerQueue.hidden = total === 0;
    footerQueue.textContent = String(total);
    footer.classList.toggle('is-loading', total > 0);
  } catch {
    footerQueue.hidden = true;
    footer.classList.remove('is-loading');
  }
}

function initNavigation(): void {
  document.querySelectorAll<HTMLElement>('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const next = tab.dataset.tab as ViewName | undefined;
      if (!next) return;
      if (next === 'current') forcedDomain = null;
      showView(next);
      if (next === 'current') void renderCurrentSite();
    });
  });
}

function initThemeToggle(): void {
  const icon = document.getElementById('themeIcon') as SVGUseElement | null;
  const button = document.getElementById('btnToggleTheme');

  function updateIcon(): void {
    if (!icon) return;
    const preference = getThemePreference();
    const hrefMap = { dark: '#ico-moon', light: '#ico-sun', auto: '#ico-auto' } as const;
    icon.setAttribute('href', hrefMap[preference]);
  }

  updateIcon();
  button?.addEventListener('click', () => {
    toggleTheme();
    updateIcon();
  });
}

function initPauseButton(): void {
  const button = document.getElementById('btnPause');
  const icon = document.getElementById('pauseIcon') as SVGUseElement | null;

  async function refresh(): Promise<void> {
    const paused = await isPaused();
    if (icon) icon.setAttribute('href', paused ? '#ico-play' : '#ico-pause');
    if (button instanceof HTMLButtonElement) {
      button.title = paused ? 'Resume checking' : 'Pause checking';
    }
  }

  void refresh();
  button?.addEventListener('click', () => {
    void isPaused().then((paused) => (
      paused
        ? sendMessage({ type: 'RESUME' })
        : sendMessage({ type: 'PAUSE', hours: 1 })
    )).then(() => refresh());
  });
}

function initAddDomain(): void {
  const input = document.getElementById('addDomainInput') as HTMLInputElement;
  const error = document.getElementById('addDomainError') as HTMLElement;
  const button = document.getElementById('btnAddDomain') as HTMLButtonElement;

  button.addEventListener('click', () => {
    if (!currentGate.canCheck) {
      error.textContent = currentGate.reason ?? 'Add is currently disabled';
      error.className = 'inline-msg is-visible inline-msg--error';
      return;
    }

    const domain = normalizeDomainInput(input.value);
    if (!domain) {
      error.textContent = 'Enter a valid domain';
      error.className = 'inline-msg is-visible inline-msg--error';
      return;
    }

    error.textContent = '';
    error.className = 'inline-msg';
    void sendMessage({ type: 'ADD_DOMAIN', domain }).then((response) => {
      if (!response.ok) {
        error.textContent = response.error ?? 'Failed to add domain';
        error.className = 'inline-msg is-visible inline-msg--error';
        return;
      }
      input.value = '';
      showToast(response.error === 'check_deferred' ? 'Added — check deferred' : 'Domain queued', 'success');
      showView('watchlist');
    });
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes[STORAGE_KEYS.DOMAINS] || changes[STORAGE_KEYS.SOURCE_USAGE])) {
    void boot();
  }

  if (area === 'sync' && changes[STORAGE_KEYS.PAUSE_UNTIL]) {
    void boot();
  }
});

browser.tabs.onActivated.addListener(() => {
  if (forcedDomain === null) void renderCurrentSite();
});

browser.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (!tab.active || forcedDomain !== null) return;
  if (changeInfo.status === 'complete' || changeInfo.url) void renderCurrentSite();
});

async function boot(): Promise<void> {
  const records = await getDomains();
  const paused = await isPaused();
  const gate = computeGate(paused);
  const tab = await getContextTab();
  const activeDomain = tab?.url ? extractDomain(tab.url) : null;

  applyAddDomainGate(gate);
  renderWatchlist(records, gate);
  await renderCurrentSite();
  await updateFooterUsage();
  await pollQueueStatus();

  if (forcedDomain || activeDomain) showView('current');
  else showView('watchlist');
}

void (async () => {
  initTheme();
  applyI18n();
  initNavigation();
  initThemeToggle();
  initPauseButton();
  initAddDomain();
  document.getElementById('btnOpenSettings')?.addEventListener('click', openSettingsDrawer);
  await boot();
})();
