import { browser } from 'wxt/browser';
import { applyI18n } from '@shared/i18n';
import { initTheme } from '@shared/theme';
import { normalizeDomainInput } from '@shared/domain-utils';
import { sendMessage } from '@shared/messaging';

initTheme();
applyI18n();

const steps = [
  document.getElementById('step1'),
  document.getElementById('step2'),
  document.getElementById('step3'),
].filter(Boolean) as HTMLElement[];

const progressFill = document.getElementById('progressFill') as HTMLElement;
const domainInput = document.getElementById('domainInput') as HTMLInputElement;
const domainStatus = document.getElementById('domainStatus') as HTMLElement;

function showStep(index: number): void {
  steps.forEach((step, stepIndex) => {
    step.hidden = stepIndex !== index;
  });
  progressFill.style.width = `${Math.round(((index + 1) / steps.length) * 100)}%`;
}

document.getElementById('btnGetStarted')?.addEventListener('click', () => {
  showStep(1);
});

document.getElementById('btnAddDomain')?.addEventListener('click', () => {
  const domain = normalizeDomainInput(domainInput.value);
  if (!domain) {
    domainStatus.textContent = 'Enter a valid domain';
    domainStatus.className = 'inline-msg is-visible inline-msg--error';
    return;
  }

  void sendMessage({ type: 'ADD_DOMAIN', domain }).then((response) => {
    if (!response.ok) {
      domainStatus.textContent = response.error ?? 'Failed to add domain';
      domainStatus.className = 'inline-msg is-visible inline-msg--error';
      return;
    }
    showStep(2);
  }).catch(() => {
    domainStatus.textContent = 'Extension runtime is not ready';
    domainStatus.className = 'inline-msg is-visible inline-msg--error';
  });
});

document.getElementById('btnSkip')?.addEventListener('click', () => {
  showStep(2);
});

document.getElementById('btnOpenPanel')?.addEventListener('click', () => {
  try {
    const sidebarAction = (browser as unknown as { sidebarAction?: { open: () => void } }).sidebarAction;
    if (sidebarAction?.open) {
      sidebarAction.open();
      return;
    }
  } catch {
    /* ignore */
  }

  void sendMessage({ type: 'OPEN_SIDEPANEL' }).catch(() => {});
});
