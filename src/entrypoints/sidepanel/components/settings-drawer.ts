import { browser } from 'wxt/browser';
import { createDrawer } from './drawer';
import { el, showToast } from '@shared/ui-helpers';
import {
  getCheckInterval,
  getExcludedDomains,
  getLumenApiToken,
  getLumenEnabled,
  getNotifyOnNew,
  getSourceStatus,
  getWatchlistDomains,
  importDomains,
  isPaused,
  saveCheckInterval,
  saveExcludedDomains,
  saveLumenApiToken,
  saveLumenEnabled,
  saveNotifyOnNew,
  saveSourceStatus,
} from '@shared/db';
import { toUnicode } from '@shared/domain-utils';
import type { CheckInterval, DomainRecord, ThemePreference } from '@shared/types';
import { getThemePreference as getThemePreferenceLocal, setThemePreference } from '@shared/theme';
import { sendMessage } from '@shared/messaging';
import { FRESHNESS_LAG_LABEL } from '@shared/constants';

function lumenStatusLabel(status: string): string {
  switch (status) {
    case 'configured': return 'Token configured';
    case 'unverified': return 'Token saved, not yet verified';
    case 'invalid': return 'Token was rejected';
    default: return 'No token yet';
  }
}

export function openSettingsDrawer(): void {
  const { aside, body, footer } = createDrawer('Settings', () => {});

  void (async () => {
    const sourceSection = el('fieldset', 'vt-fieldset');
    sourceSection.innerHTML = '<legend>Source</legend>';

    const gtrRow = el('div', 'field');
    gtrRow.innerHTML = [
      '<div class="field__label">Google Transparency Report</div>',
      '<div class="inline-msg is-visible">Always connected · public, no token required</div>',
      `<div class="wizard-note" style="margin-top:var(--space-1)">${FRESHNESS_LAG_LABEL}</div>`,
    ].join('');
    sourceSection.append(gtrRow);
    body.appendChild(sourceSection);

    const advancedSection = el('fieldset', 'vt-fieldset');
    advancedSection.innerHTML = '<legend>Advanced — Lumen secondary enrichment</legend>';

    const lumenExplainer = el('div', 'wizard-note');
    lumenExplainer.textContent = 'Optional. Adds per-URL lists and richer sender forensics via Lumen Database. Lumen researcher credentials are issued only for journalism, academic study, or legislative/policy research — Lumen confirmed in writing (April 2026) that monitoring your own domains is not a granted use case. Enable this only if you already hold a token obtained for one of those research purposes. The extension works fully without Lumen.';
    advancedSection.appendChild(lumenExplainer);

    const lumenToggleLabel = el('label', 'field');
    const lumenToggle = document.createElement('input');
    lumenToggle.type = 'checkbox';
    lumenToggle.checked = await getLumenEnabled();
    lumenToggleLabel.append(lumenToggle, document.createTextNode(' Enable Lumen enrichment'));
    advancedSection.appendChild(lumenToggleLabel);

    const lumenFields = el('div', 'field');
    const tokenLabel = el('label', 'field__label', 'Lumen API token');
    const tokenRow = el('div', 'domain-form__row');
    const tokenInput = document.createElement('input');
    tokenInput.className = 'input';
    tokenInput.type = 'password';
    tokenInput.autocomplete = 'off';
    tokenInput.value = await getLumenApiToken();
    const saveBtn = el('button', 'btn btn--outline btn--sm', 'Save token');
    saveBtn.type = 'button';
    tokenRow.append(tokenInput, saveBtn);

    const lumenStatus = el('div', 'inline-msg is-visible');
    lumenStatus.textContent = lumenStatusLabel(await getSourceStatus());

    lumenFields.append(tokenLabel, tokenRow, lumenStatus);
    advancedSection.appendChild(lumenFields);

    function applyLumenFieldsEnabled(enabled: boolean): void {
      tokenInput.disabled = !enabled;
      saveBtn.disabled = !enabled;
      lumenFields.style.opacity = enabled ? '1' : '0.55';
    }
    applyLumenFieldsEnabled(lumenToggle.checked);

    lumenToggle.addEventListener('change', () => {
      const enabled = lumenToggle.checked;
      applyLumenFieldsEnabled(enabled);
      void sendMessage({ type: 'SET_LUMEN_ENABLED', enabled }).then(() => {
        showToast(enabled ? 'Lumen enrichment enabled' : 'Lumen enrichment disabled', 'success');
      });
    });

    saveBtn.addEventListener('click', () => {
      const nextToken = tokenInput.value.trim();
      void (async () => {
        const previousToken = await getLumenApiToken();
        const previousStatus = await getSourceStatus();
        await saveLumenApiToken(nextToken);
        if (!nextToken) {
          await saveSourceStatus('not_configured');
        } else if (nextToken !== previousToken || previousStatus === 'invalid' || previousStatus === 'not_configured') {
          await saveSourceStatus('unverified');
        }
        lumenStatus.textContent = lumenStatusLabel(await getSourceStatus());
        lumenStatus.className = 'inline-msg is-visible inline-msg--success';
      })().catch(() => {
        lumenStatus.textContent = 'Failed to save token';
        lumenStatus.className = 'inline-msg is-visible inline-msg--error';
      });
    });

    body.appendChild(advancedSection);

    const prefsSection = el('fieldset', 'vt-fieldset');
    prefsSection.innerHTML = '<legend>Preferences</legend>';

    const intervalField = el('div', 'field');
    const intervalLabel = el('label', 'field__label', 'Check interval');
    const intervalSelect = document.createElement('select');
    intervalSelect.className = 'input';
    const intervalOptions: Array<[CheckInterval, string]> = [
      [12, '12 hours'],
      [24, '24 hours'],
      [72, '3 days'],
      [168, '7 days'],
    ];
    for (const [value, label] of intervalOptions) {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = label;
      intervalSelect.appendChild(option);
    }
    intervalSelect.value = String(await getCheckInterval());
    intervalSelect.addEventListener('change', () => {
      void saveCheckInterval(Number(intervalSelect.value) as CheckInterval);
    });
    intervalField.append(intervalLabel, intervalSelect);

    const themeField = el('div', 'field');
    const themeLabel = el('label', 'field__label', 'Theme');
    const themeSelect = document.createElement('select');
    themeSelect.className = 'input';
    const themeOptions: Array<[ThemePreference, string]> = [
      ['auto', 'Auto'],
      ['dark', 'Dark'],
      ['light', 'Light'],
    ];
    for (const [value, label] of themeOptions) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      themeSelect.appendChild(option);
    }
    themeSelect.value = getThemePreferenceLocal();
    themeSelect.addEventListener('change', () => {
      setThemePreference(themeSelect.value as ThemePreference);
    });
    themeField.append(themeLabel, themeSelect);

    const notifyField = el('label', 'field');
    const notifyToggle = document.createElement('input');
    notifyToggle.type = 'checkbox';
    notifyToggle.checked = await getNotifyOnNew();
    notifyToggle.addEventListener('change', () => {
      void saveNotifyOnNew(notifyToggle.checked);
    });
    notifyField.append(notifyToggle, document.createTextNode(' Notify on new complaints'));

    prefsSection.append(intervalField, themeField, notifyField);
    body.appendChild(prefsSection);

    const monitoringSection = el('fieldset', 'vt-fieldset');
    monitoringSection.innerHTML = '<legend>Monitoring</legend>';

    const excludeField = el('div', 'field');
    const excludeLabel = el('label', 'field__label', 'Excluded domains');
    const excludeInput = document.createElement('textarea');
    excludeInput.className = 'bulk-textarea';
    excludeInput.rows = 4;
    excludeInput.value = (await getExcludedDomains()).join(', ');
    excludeInput.addEventListener('change', () => {
      const next = excludeInput.value
        .split(/[,\n\s]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
      void saveExcludedDomains(next).then(() => {
        showToast('Excluded domains saved', 'success');
      });
    });
    excludeField.append(excludeLabel, excludeInput);

    const pauseBtn = el('button', 'btn btn--outline btn--sm');
    pauseBtn.type = 'button';
    const paused = await isPaused();
    pauseBtn.textContent = paused ? 'Resume' : 'Pause for 1 hour';
    pauseBtn.addEventListener('click', () => {
      const message = pauseBtn.textContent === 'Resume'
        ? { type: 'RESUME' as const }
        : { type: 'PAUSE' as const, hours: 1 };
      void sendMessage(message).then(() => {
        pauseBtn.textContent = pauseBtn.textContent === 'Resume' ? 'Pause for 1 hour' : 'Resume';
      });
    });

    const setupGuideBtn = el('button', 'btn btn--ghost btn--sm', 'Open setup guide');
    setupGuideBtn.type = 'button';
    setupGuideBtn.addEventListener('click', () => {
      void browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') });
    });

    monitoringSection.append(excludeField, pauseBtn, setupGuideBtn);
    body.appendChild(monitoringSection);

    const dataSection = el('fieldset', 'vt-fieldset');
    dataSection.innerHTML = '<legend>Data</legend>';

    const dataRow = el('div', 'domain-form__row');
    const exportJsonBtn = el('button', 'btn btn--outline btn--sm', 'Export JSON');
    exportJsonBtn.type = 'button';
    const exportCsvBtn = el('button', 'btn btn--outline btn--sm', 'Export CSV');
    exportCsvBtn.type = 'button';
    const importBtn = el('button', 'btn btn--ghost btn--sm', 'Import JSON');
    importBtn.type = 'button';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json,.json';
    fileInput.style.display = 'none';

    exportJsonBtn.addEventListener('click', () => {
      void (async () => {
        const records = await getWatchlistDomains();
        if (!records.length) {
          showToast('No watchlist domains to export', 'warning');
          return;
        }
        const payload = {
          version: 1,
          exported_at: new Date().toISOString(),
          domains: records,
        };
        downloadFile(
          JSON.stringify(payload, null, 2),
          `dmca-watch-export-${todayIso()}.json`,
          'application/json',
        );
      })();
    });

    exportCsvBtn.addEventListener('click', () => {
      void (async () => {
        const records = await getWatchlistDomains();
        if (!records.length) {
          showToast('No watchlist domains to export', 'warning');
          return;
        }
        downloadFile(buildCsv(records), `dmca-watch-watchlist-${todayIso()}.csv`, 'text/csv');
      })();
    });

    importBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      void (async () => {
        try {
          const text = await file.text();
          const parsed: unknown = JSON.parse(text);
          const records = extractImportRecords(parsed);
          if (!records.length) {
            showToast('No valid domains in file', 'error');
            return;
          }
          const { added, updated } = await importDomains(records);
          showToast(`Imported: ${added} added, ${updated} updated`, 'success');
        } catch {
          showToast('Import failed: invalid JSON', 'error');
        } finally {
          fileInput.value = '';
        }
      })();
    });

    dataRow.append(exportJsonBtn, exportCsvBtn, importBtn, fileInput);
    dataSection.appendChild(dataRow);
    body.appendChild(dataSection);

    const about = el('div', 'drawer__about');
    about.innerHTML = [
      `<div><strong>DMCA Watch</strong> v${chrome.runtime.getManifest().version}</div>`,
      '<div>Retrospective DMCA audit tool. Primary source: Google Transparency Report.</div>',
      `<div class="wizard-note">${FRESHNESS_LAG_LABEL}</div>`,
      '<div class="drawer__about-links">',
      '<a class="drawer__about-link" href="https://dmca.cam" target="_blank" rel="noreferrer">dmca.cam</a>',
      '<a class="drawer__about-link" href="https://301.st" target="_blank" rel="noreferrer">301.st</a>',
      '</div>',
    ].join('');
    footer.appendChild(about);

    document.body.appendChild(aside);
  })();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(records: DomainRecord[]): string {
  const headers = [
    'domain',
    'unicode',
    'status',
    'complaint_count',
    'new_count',
    'last_complaint_date',
    'last_checked',
    'added_at',
  ];
  const rows = records.map((record) => {
    const lastComplaintDate = record.complaints[0]?.date
      ? new Date(record.complaints[0].date).toISOString()
      : '';
    const lastCheckedIso = record.last_checked ? new Date(record.last_checked).toISOString() : '';
    const addedAtIso = record.added_at ? new Date(record.added_at).toISOString() : '';
    return [
      csvEscape(record.domain),
      csvEscape(toUnicode(record.domain)),
      csvEscape(record.status),
      csvEscape(record.complaints.length),
      csvEscape(record.new_count),
      csvEscape(lastComplaintDate),
      csvEscape(lastCheckedIso),
      csvEscape(addedAtIso),
    ].join(',');
  });
  return [headers.join(','), ...rows].join('\r\n');
}

function extractImportRecords(parsed: unknown): DomainRecord[] {
  if (!parsed || typeof parsed !== 'object') return [];
  const candidate = parsed as { domains?: unknown };
  const list = Array.isArray(candidate.domains) ? candidate.domains : Array.isArray(parsed) ? parsed : [];
  const valid: DomainRecord[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Partial<DomainRecord>;
    if (typeof record.domain !== 'string' || !record.domain.includes('.')) continue;
    valid.push({
      domain: record.domain,
      watchlist: record.watchlist ?? true,
      added_at: typeof record.added_at === 'number' ? record.added_at : Date.now(),
      last_checked: typeof record.last_checked === 'number' ? record.last_checked : 0,
      complaints: Array.isArray(record.complaints) ? record.complaints : [],
      last_seen_complaint_id: record.last_seen_complaint_id ?? null,
      new_count: typeof record.new_count === 'number' ? record.new_count : 0,
      status: record.status ?? 'unknown',
    });
  }
  return valid;
}
