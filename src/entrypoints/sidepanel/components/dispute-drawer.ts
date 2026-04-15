import type { Complaint } from '@shared/types';
import { createDrawer } from './drawer';
import {
  generateCounterNoticePrompt,
  generateCounterNoticeTemplate,
  GOOGLE_COUNTER_NOTICE_URL,
} from '@shared/counter-notice-templates';
import { showToast } from '@shared/ui-helpers';

function createCopyButton(text: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'btn btn--outline btn--sm';
  button.type = 'button';
  button.textContent = 'Copy';
  button.addEventListener('click', () => {
    void navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard', 'success');
    }).catch(() => {
      showToast('Copy failed', 'error');
    });
  });
  return button;
}

export function openDisputeDrawer(domain: string, complaint: Complaint): void {
  const { aside, body, footer } = createDrawer('Counter-notice draft', () => {});

  const template = generateCounterNoticeTemplate(domain, complaint);
  const prompt = generateCounterNoticePrompt(domain, complaint);

  const summary = document.createElement('div');
  summary.className = 'vendor-card';
  summary.innerHTML = [
    `<div class="vendor-card__header"><strong>${complaint.sender}</strong><span class="vendor-card__verdict"> - ${new Date(complaint.date).toLocaleDateString()}</span></div>`,
    `<pre class="vendor-card__preview">${complaint.targeted_urls.map((url) => url.replace(/</g, '&lt;')).join('\n')}</pre>`,
  ].join('');

  const templateBlock = document.createElement('div');
  templateBlock.className = 'vendor-card';
  templateBlock.innerHTML = '<div class="vendor-card__header">Template</div>';
  const templatePre = document.createElement('pre');
  templatePre.className = 'vendor-card__preview';
  templatePre.textContent = template;
  templateBlock.append(templatePre, createCopyButton(template));

  const promptBlock = document.createElement('div');
  promptBlock.className = 'vendor-card';
  promptBlock.innerHTML = '<div class="vendor-card__header">AI prompt</div>';
  const promptPre = document.createElement('pre');
  promptPre.className = 'vendor-card__preview';
  promptPre.textContent = prompt;
  promptBlock.append(promptPre, createCopyButton(prompt));

  body.append(summary, templateBlock, promptBlock);

  const link = document.createElement('a');
  link.className = 'btn btn--primary btn--sm';
  link.href = GOOGLE_COUNTER_NOTICE_URL;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = 'Open Google counter-notice form';
  footer.append(link);

  document.body.appendChild(aside);
}
