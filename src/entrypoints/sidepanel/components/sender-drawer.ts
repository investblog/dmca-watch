import type { SenderAggregateEntry, SenderMonthlyCount, SenderProfile } from '@shared/types';
import { createDrawer } from './drawer';
import { sendMessage } from '@shared/messaging';
import { el, showToast } from '@shared/ui-helpers';
import { toUnicode } from '@shared/domain-utils';
import { STORAGE_KEYS, FRESHNESS_LAG_LABEL, GTR_WEB_BASE } from '@shared/constants';

function gtrOverviewUrl(senderName: string): string {
  return `${GTR_WEB_BASE}/explore?r=${encodeURIComponent(senderName)}`;
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function buildSparkline(monthly: SenderMonthlyCount[], width = 320, height = 48): SVGSVGElement {
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('class', 'timeline-spark');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Sender activity by month');

  if (!monthly.length) {
    const text = document.createElementNS(svgNs, 'text');
    text.setAttribute('x', String(width / 2));
    text.setAttribute('y', String(height / 2 + 4));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('class', 'timeline-spark__empty');
    text.textContent = 'No monthly data';
    svg.appendChild(text);
    return svg;
  }

  const max = Math.max(...monthly.map((m) => m.count), 1);
  const barWidth = Math.max(2, Math.floor(width / Math.max(monthly.length, 1)) - 1);
  const gap = 1;

  monthly.forEach((month, index) => {
    const barHeight = Math.max(1, Math.round((month.count / max) * (height - 6)));
    const x = index * (barWidth + gap);
    const y = height - barHeight - 2;
    const rect = document.createElementNS(svgNs, 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(barWidth));
    rect.setAttribute('height', String(barHeight));
    rect.setAttribute('class', 'timeline-spark__bar');
    const title = document.createElementNS(svgNs, 'title');
    title.textContent = `${month.month}: ${month.count}`;
    rect.appendChild(title);
    svg.appendChild(rect);
  });

  return svg;
}

function buildAggregateList(entries: SenderAggregateEntry[], emptyText: string): HTMLElement {
  const list = el('ul', 'sender-list');
  if (!entries.length) {
    const li = el('li', 'sender-list__empty', emptyText);
    list.appendChild(li);
    return list;
  }
  for (const entry of entries) {
    const li = el('li', 'sender-list__row');
    const name = el('span', 'sender-list__name', entry.name);
    name.title = entry.name;
    const count = el('span', 'sender-list__count', String(entry.count));
    li.append(name, count);
    list.appendChild(li);
  }
  return list;
}

function buildCrossWatchlistList(
  entries: Array<{ domain: string; count: number; last_activity: number }>,
): HTMLElement {
  const list = el('ul', 'sender-list');
  if (!entries.length) {
    const li = el('li', 'sender-list__empty', 'Not seen in any other watchlist domain');
    list.appendChild(li);
    return list;
  }
  for (const entry of entries) {
    const li = el('li', 'sender-list__row');
    const name = el('span', 'sender-list__name', toUnicode(entry.domain));
    name.title = `${entry.domain} · last activity ${formatDate(entry.last_activity)}`;
    const count = el('span', 'sender-list__count', String(entry.count));
    li.append(name, count);
    list.appendChild(li);
  }
  return list;
}

function buildSection(title: string, content: Element): HTMLElement {
  const section = el('section', 'sender-section');
  const heading = el('h3', 'sender-section__title', title);
  section.append(heading, content);
  return section;
}

export function openSenderDrawer(senderName: string): void {
  const { aside, body, footer } = createDrawer(senderName, () => {
    chrome.storage.onChanged.removeListener(onChanged);
  });

  const meta = el('div', 'sender-meta');
  const bodyWrap = el('div', 'sender-body');
  body.append(meta, bodyWrap);

  const refreshBtn = el('button', 'btn btn--outline btn--sm', 'Refresh');
  refreshBtn.type = 'button';
  refreshBtn.addEventListener('click', () => {
    void sendMessage({ type: 'GET_SENDER_PROFILE', sender_name: senderName, forceRefresh: true });
  });

  const exportBtn = el('button', 'btn btn--ghost btn--sm', 'Export JSON');
  exportBtn.type = 'button';
  exportBtn.addEventListener('click', () => {
    void chrome.storage.local.get({ [STORAGE_KEYS.SENDER_PROFILES]: {} }, (data) => {
      const all = (data[STORAGE_KEYS.SENDER_PROFILES] || {}) as Record<string, SenderProfile>;
      const profile = all[senderName];
      if (!profile) {
        showToast('No profile to export', 'warning');
        return;
      }
      const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dmca-watch-sender-${senderName.replace(/[^a-z0-9_-]+/gi, '_')}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    });
  });

  const gtrLink = document.createElement('a');
  gtrLink.className = 'btn btn--ghost btn--sm';
  gtrLink.href = gtrOverviewUrl(senderName);
  gtrLink.target = '_blank';
  gtrLink.rel = 'noreferrer noopener';
  gtrLink.textContent = 'View on GTR';

  footer.append(refreshBtn, exportBtn, gtrLink);

  function render(profile: SenderProfile | null): void {
    meta.replaceChildren();
    bodyWrap.replaceChildren();

    if (!profile) {
      meta.appendChild(el('div', 'sender-meta__loading', 'Loading sender profile...'));
      return;
    }

    if (profile.status === 'loading' && profile.fetched_at === 0) {
      meta.appendChild(el('div', 'sender-meta__loading', 'Aggregating local watchlist data...'));
      return;
    }

    if (profile.status === 'error') {
      meta.appendChild(el('div', 'sender-meta__error', `Failed: ${profile.error ?? 'unknown'}`));
      return;
    }

    const sourceBadge = profile.source === 'lumen'
      ? 'Enriched with Lumen Database'
      : 'Aggregated from your watchlist via Google Transparency Report';

    const total = el('div', 'sender-meta__total');
    total.innerHTML = `<strong>${profile.total_notices.toLocaleString()}</strong> complaints across your watchlist`;
    const sourceLine = el('div', 'sender-meta__sampled', sourceBadge);
    const range = el('div', 'sender-meta__range', `Active: ${formatDate(profile.first_activity)} — ${formatDate(profile.last_activity)}`);
    const fetched = el('div', 'sender-meta__fetched', `Snapshot ${formatDateTime(profile.fetched_at)}`);
    const disclaimer = el('div', 'sender-meta__fetched', FRESHNESS_LAG_LABEL);
    meta.append(total, sourceLine, range, fetched, disclaimer);

    bodyWrap.append(buildSection('Activity (monthly)', buildSparkline(profile.monthly_counts)));
    bodyWrap.append(buildSection('Also in your watchlist', buildCrossWatchlistList(profile.cross_watchlist)));

    if (profile.source === 'lumen') {
      if (profile.top_principals.length) {
        bodyWrap.append(buildSection('Top principals', buildAggregateList(profile.top_principals, 'No principal data')));
      }
      if (profile.top_recipients.length) {
        bodyWrap.append(buildSection('Top recipients', buildAggregateList(profile.top_recipients, 'No recipient data')));
      }
      if (profile.top_target_hosts.length) {
        bodyWrap.append(buildSection('Top targeted hosts', buildAggregateList(profile.top_target_hosts, 'No target data')));
      }
      if (profile.top_source_urls.length) {
        bodyWrap.append(buildSection('Top cited source URLs', buildAggregateList(profile.top_source_urls, 'No source data')));
      }
      if (profile.jurisdictions.length) {
        bodyWrap.append(buildSection('Jurisdictions', buildAggregateList(profile.jurisdictions, 'No jurisdiction data')));
      }
    } else {
      const upgradeHint = el(
        'div',
        'wizard-note',
        'Principals, recipients, targeted hosts, and jurisdictions are available via optional Lumen enrichment (Settings → Advanced).',
      );
      bodyWrap.append(buildSection('More dimensions', upgradeHint));
    }
  }

  function onChanged(changes: Record<string, chrome.storage.StorageChange>, area: chrome.storage.AreaName): void {
    if (area !== 'local' || !changes[STORAGE_KEYS.SENDER_PROFILES]) return;
    const next = (changes[STORAGE_KEYS.SENDER_PROFILES].newValue ?? {}) as Record<string, SenderProfile>;
    render(next[senderName] ?? null);
  }

  chrome.storage.onChanged.addListener(onChanged);

  render(null);
  document.body.appendChild(aside);

  void sendMessage({ type: 'GET_SENDER_PROFILE', sender_name: senderName }).then((response) => {
    render(response.profile);
  });
}
