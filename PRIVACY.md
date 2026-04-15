# Privacy Policy — DMCA Watch

**Last updated:** April 2026

## Summary

DMCA Watch is a browser extension for webmasters that monitors public DMCA complaint records against your domains. It runs locally in your browser and does not operate any backend service. There is no central server collecting, storing, or aggregating your data. Every request the extension makes is initiated from your browser, with public endpoints by default.

The primary data source is **Google Transparency Report**, a public dataset Google publishes about copyright takedown requests it has received. No account, no token, and no setup are required to use the extension. Optionally, you can also enable enrichment through the **Lumen Database** if you have a Lumen researcher token; this is opt-in and disabled by default.

## What you should know about data freshness

Google updates the Transparency Report dataset roughly once per month. The data DMCA Watch surfaces is therefore approximately **30 to 60 days behind real-time events**. If a URL was removed from Google Search yesterday, the extension will not show that complaint until Google publishes the next dataset update.

This means DMCA Watch is a **retrospective audit and pattern-detection tool**, not a real-time alerting system. We say this in the welcome wizard, in the settings drawer, and in tooltips on every "last checked" timestamp. We mention it again here because it shapes what the extension is for and what it cannot do.

## What data does the extension store, and where?

All data stays on your device unless explicitly noted as synced through your browser account.

### Stored in `chrome.storage.sync` (syncs across your devices through your browser account)

- **Lumen API token** — only if you choose to enable optional Lumen enrichment in Settings → Advanced. The token is stored here so it is available on every browser you are signed into. It is only ever sent to `lumendatabase.org`. The extension is fully usable without this token.
- **Lumen enabled flag** — a boolean indicating whether you have opted in to Lumen secondary enrichment. Default: `false`.
- **Source access status** — short strings tracking whether your token has been accepted by Lumen (when applicable).
- **Check interval** — how often the extension refreshes your watchlist (12h / 24h / 3 days / 7 days).
- **Theme preference** — `dark` / `light` / `auto`.
- **Pause state** — timestamp until which monitoring is paused, or null.
- **Excluded domains** — domains you have chosen to exclude from badge display.
- **Notify-on-new preference** — boolean for browser notifications.

### Stored in `chrome.storage.local` (stays on this device only, never synced)

- **Domain watchlist and complaint records** — the domains you monitor and the complaint data fetched for them. Each complaint includes sender (the reporting organization), copyright owner (the principal on whose behalf the request was filed), date, count of URLs requested for removal, count of URLs Google actually removed, and any notes you added or "resolved" marks you applied. When Lumen enrichment is active, complaint records may also include a per-URL list and a link to the original notice text on Lumen.
- **Sender profiles** — when you investigate a sender or copyright owner via the Sender Forensics Card, the aggregate statistics (total notice count, recent activity, top targets, monthly counts) are cached for 24 hours so the extension does not re-query the source every time you open the card.
- **Source health results** — when you run "Check sources" on a sender profile (only available when Lumen enrichment is active), the HTTP status and Archive.org snapshot metadata for the top cited source URLs are stored in the same cache entry.
- **API usage counters** — daily counters of how many requests the extension has made to Google Transparency Report and (if active) Lumen Database, used to respect rate limits. Resets at UTC midnight.

None of this local data is ever transmitted to any server operated by us. We do not operate any server.

## Network requests the extension makes

The extension talks to the following third-party services, and nothing else:

### Google Transparency Report (`https://transparencyreport.google.com`) — primary source, always active

The default and primary data source. The extension queries Google's public Transparency Report endpoints under `/transparencyreport/api/v3/copyright/` for each domain in your watchlist or each domain you inspect on the Current Site tab. The endpoints we call are:

- `domains/detail` — per-domain summary of total requests and URLs removed
- `requests/summary` — paginated list of recent DMCA requests targeting the domain
- `reporters/summary` — top reporting organizations against the domain
- `owners/summary` — top copyright owners against the domain
- `overview/urlsremoved` — weekly time series of removed URLs for the domain

Only the domain name being checked is sent. No personal data, no account information, no tokens. These are public endpoints used by Google's own Transparency Report SPA. Requests are throttled to one request per five seconds per installation.

The Transparency Report data is itself published by Google as a public dataset; what Google chooses to publish is governed by Google's own policies. The extension only reads what Google has already made public.

### Lumen Database (`https://lumendatabase.org`) — optional secondary, opt-in

The extension talks to Lumen Database **only if** you have explicitly enabled Lumen enrichment in Settings → Advanced and provided a Lumen researcher token. By default, the extension does not contact Lumen at all.

When enabled, two kinds of requests are made:

- **Domain search** — when the extension fetches data for a domain, it queries Lumen for notices mentioning that domain to enrich the GTR data with per-URL lists and raw notice text. The domain name and your API token are sent.
- **Sender profile search** — when you click a sender name in a complaint card, the extension queries Lumen for additional aggregates the GTR API does not expose (top recipients, top cited source URLs, jurisdictions). The sender name and your API token are sent.

Requests are throttled to one request per ten seconds per installation — more conservative than Lumen's documented rate limit of approximately one request per second.

Lumen is a research project operated by the Berkman Klein Center for Internet & Society at Harvard University. Lumen's [API Terms of Use](https://lumendatabase.org/pages/api_terms) govern how the data can be used. By using this extension with your Lumen researcher token, you are acting as a Researcher under Lumen's terms, and the extension respects those terms: it does not redistribute Lumen data, does not cache Lumen data on any server, and does not share your token.

**Who can actually use Lumen enrichment:** Lumen staff confirmed in writing in April 2026 that they do not issue researcher credentials for the use case of monitoring your own domains. Their researcher program is limited to journalism, academic study, and legislative/policy research. Public no-token access is hard-capped at 1 notice per email per 24 hours. If you do not already hold a Lumen token for one of the allowed research purposes, leave Lumen enrichment disabled — the extension works fully using only Google Transparency Report, and we do not recommend applying for a Lumen token just to use this extension.

You can disable Lumen enrichment at any time from Settings → Advanced. The extension will continue to work normally using only Google Transparency Report.

### Archive.org (`https://archive.org`) — only when Lumen Source Health is active

When Lumen secondary enrichment is enabled and you trigger "Check sources" on a sender profile, the extension queries the Wayback Machine availability API for each of the top cited source URLs. Only the URL being checked is sent; no personal data is transmitted. This helps you see whether an "original source" cited by a takedown notice has ever been archived, and if so, when.

If Lumen enrichment is disabled, the extension does not contact Archive.org at all.

## Data you export

The extension lets you export:

- **Your watchlist** as JSON or CSV, from Settings → Data.
- **A single sender profile** as a JSON dossier, from the sender card.

What happens to those files after export is your responsibility. The extension does not upload them anywhere.

## What this extension does NOT do

- Does not operate a backend service
- Does not collect analytics or telemetry
- Does not track browsing history
- Does not inject ads, safe-browsing warnings, or anything else into web pages
- Does not read page content — only reads the URL of the active tab to decide what to show in the badge
- Does not use cookies, fingerprinting, or any other identifier beyond what your browser already does
- Does not sell, share, or redistribute any data
- Does not send counter-notices on your behalf — counter-notice templates are drafts that you copy, edit, and submit yourself
- Does not give legal advice
- Does not provide real-time DMCA detection — the underlying data sources are themselves not real-time (see "What you should know about data freshness" above)

## Permissions, in plain English

| Permission | Why it is needed |
|---|---|
| `storage` | Save your watchlist, settings, complaint cache, sender profile cache, and (if you enable Lumen) your token in your browser's local storage |
| `alarms` | Schedule background checks of your watchlist according to the check interval you chose |
| `tabs` | Read the URL of the active tab so the icon badge can show the status for the domain you are looking at |
| `activeTab` | Access the current tab when you open the side panel |
| `sidePanel` (Chrome/Edge) | Open the extension's main UI in the side panel |
| `notifications` | Show a browser notification when a new complaint is detected for a watchlist domain |
| `host_permissions: https://transparencyreport.google.com/*` | Send domain-search requests to Google Transparency Report's public copyright endpoints. Always used. |
| `host_permissions: https://lumendatabase.org/*` | Send search and notice-lookup requests to Lumen Database. Used only when you have explicitly enabled Lumen secondary enrichment. |
| `host_permissions: https://archive.org/*` | Query the Wayback Machine availability API for source URL snapshots. Used only when Lumen enrichment is active and you run "Check sources". |

The extension does not request `webRequest`, `declarativeNetRequest`, content script injection, `<all_urls>` host access, or any permission that would let it read or modify the pages you visit.

## Third-party services

- **Google Transparency Report** — `transparencyreport.google.com`, operated by Google. Public dataset of copyright removal requests Google has received for Google Search. Always used as the primary source.
- **Lumen Database** — `lumendatabase.org`, operated by the Berkman Klein Center for Internet & Society at Harvard University. Public database of legal takedown notices. Used only when you have explicitly enabled Lumen secondary enrichment and provided a researcher token.
- **Archive.org Wayback Machine** — `archive.org`, operated by the Internet Archive. Used only when Lumen enrichment is active and you run "Check sources" on a sender profile.

## Your responsibility when following links

The extension surfaces links to source pages — Google Transparency Report pages, Lumen complaint records, optional cited source URLs. When you follow any of those links, your use of the resulting content is governed by the same rules as browsing any other page on the web. Per Lumen's API Terms of Use, "your use of the resulting content will be limited to non-infringing and/or fair use under copyright law." Per Google's terms, browsing the public Transparency Report is governed by Google's standard usage policies. The extension displays those links as-is; what you do with them is your call.

## Legal disclaimer

DMCA Watch is a monitoring tool. It does not provide legal advice and does not evaluate the validity of any complaint. The Sender Forensics Card shows aggregated metrics — total notice counts, top targets, recent activity — so you can see patterns for yourself. It does not label any sender as "abusive", "fake", or "illegitimate". The conclusions you draw from those metrics are your own.

Counter-notice templates are informational starting points. A counter-notice is a legal document you sign under penalty of perjury. Consult a qualified attorney for any legal matter before acting on what the extension shows you.

## Risk of source endpoint changes

The Google Transparency Report API the extension uses is undocumented — it is the same API Google's own public Transparency Report SPA uses. Google may change or remove these endpoints at any time without notice. If that happens, the extension will mark the source as unstable and continue showing the last successfully fetched data while we adapt. There is no risk of data loss or unauthorized access — the worst case is that automatic refresh stops working until we ship an update.

Lumen reserves the right to revoke API access at any time. If your token is revoked, the extension will mark the Lumen source as `invalid` and stop attempting Lumen enrichment until you provide a new one. The primary monitoring loop through Google Transparency Report is not affected. We have no influence over Lumen's issuance or revocation decisions.

## Changes to this policy

If this privacy policy changes, the updated version will be published in the extension repository and on https://dmca.cam. Significant changes will be announced in release notes.

## Contact

For questions or concerns about privacy: https://dmca.cam
