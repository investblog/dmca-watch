import type { Complaint } from './types';

export const GOOGLE_COUNTER_NOTICE_URL = 'https://support.google.com/legal/troubleshooter/1114905';

export function generateCounterNoticeTemplate(domain: string, complaint?: Complaint): string {
  const urls = complaint?.targeted_urls?.length
    ? complaint.targeted_urls.map((url) => `- ${url}`).join('\n')
    : '- [list affected URLs]';

  return [
    'Subject: DMCA Counter Notice',
    '',
    'To whom it may concern,',
    '',
    `I am submitting this counter notice regarding material hosted on ${domain}.`,
    'I have a good-faith belief that the material identified below was removed or disabled as a result of mistake or misidentification.',
    '',
    'Affected URLs:',
    urls,
    '',
    'I consent to the jurisdiction of the Federal District Court for the judicial district in which my address is located, or if my address is outside the United States, to any judicial district in which the service provider may be found.',
    'I will accept service of process from the person who provided the original notification or an agent of such person.',
    '',
    'Full legal name: [your name]',
    'Address: [your address]',
    'Telephone: [your phone]',
    'Email: [your email]',
    '',
    'Signature: [your signature]',
  ].join('\n');
}

export function generateCounterNoticePrompt(domain: string, complaint?: Complaint): string {
  return [
    'Adapt the following DMCA counter-notice draft for a real webmaster case.',
    `Domain: ${domain}`,
    `Sender: ${complaint?.sender ?? '[unknown]'}`,
    `Jurisdiction: ${complaint?.jurisdiction ?? '[unknown]'}`,
    `URLs: ${(complaint?.targeted_urls ?? []).join(', ') || '[list affected URLs]'}`,
    '',
    generateCounterNoticeTemplate(domain, complaint),
  ].join('\n');
}
