# Store Listing Package

> **Status: skeleton** — v1.0 features not yet implemented. Fill in each section as features land. Use VT Monitor's `store/` directory as reference for per-locale structure when doing the i18n pass.
>
> **Updated 2026-04-14** under Phase 0 source pivot: primary source is now Google Transparency Report (public, no token), Lumen Database is optional secondary enrichment, GSC is out of v1.

## Positioning

DMCA Watch is a browser extension for webmasters, agencies, SEOs, and domain operators who need a complete, searchable history of DMCA complaints filed against their domains. It surfaces every DMCA removal action Google has acted on for each of your sites, identifies repeat-offender reporters, and gives you counter-notice templates you can copy and submit yourself.

It is not a real-time alert system — Google updates the underlying Transparency Report data approximately once per month, so the extension is honest about being a **retrospective audit and pattern-detection tool**, not an early-warning monitor. There is no public source that allows real-time DMCA detection; we say so up front rather than overselling.

It is not a legal service, not a blocker, and not a consumer add-on. It is a focused tool for people who manage sites and need an operational view of the takedown notices their domains have collected.

## Short Description - Chrome / Edge

TBD — one-sentence pitch under 132 characters. Draft: "Audit DMCA complaint history against your domains via Google Transparency Report — watchlist, sender forensics, counter-notice templates."

## Firefox Summary

TBD — 250 character summary. Draft: "DMCA Watch gives webmasters a historical audit of DMCA complaints against their domains via Google Transparency Report. Add domains to a watchlist, investigate repeat-offender reporters, and draft counter-notices from DMCA §512(g) templates. No account, no token, no setup."

## Detailed Description

TBD — full description, written after v1.0 feature set is locked. Should cover:

- The DMCA-removal problem (search removal happens quietly, owners notice only when traffic drops)
- The data source: Google Transparency Report, public since 2011, updated approximately monthly
- The honest limitation: ~30-60 day data lag means this is a **retrospective audit tool**, not real-time alerting
- What the extension does: watchlist, badge, Current Site, Sender Forensics Card, counter-notice drawer
- Optional Lumen Database enrichment for researchers with a token (per-URL data, richer forensics)
- What it does NOT do (no legal advice, no auto-submission, no real-time alerts)

## Why This Is Different

- Built for domain operators, not consumers
- Tracks the complete historical record of every DMCA action against your sites
- Sender forensics: see which reporters keep targeting you, with monthly activity
- Uses public Google Transparency Report data, no third-party backend
- Optional Lumen Database power-user upgrade for researchers
- Counter-notice templates ready to copy, with AI prompt variants
- Keeps data local: no analytics, no telemetry, no central server
- Honest about what it is and is not — no false "real-time alerts" promise

## Key Features

TBD — mirror final v1.0 scope from ROADMAP.md. Working list:

- Watchlist of monitored domains with scheduled background refresh
- Per-domain Current Site view with full complaint history
- Sender Forensics Card (top reporters, top copyright owners, monthly sparkline)
- Counter-notice drawer with DMCA §512(g) templates
- Welcome wizard with honest data-freshness disclosure
- Pause mode, excluded domains, light/dark/auto theme
- Optional Lumen secondary enrichment (Settings → Advanced)
- Watchlist export/import (JSON / CSV)
- Sender profile dossier export (JSON)

## Typical Use Cases

### 1. Audit a domain's DMCA history
Add a production domain to the watchlist and immediately see every DMCA removal request Google has acted on for it — sender, copyright owner, dates, counts of URLs removed.

### 2. Identify repeat-offender reporters
Open the Sender Forensics Card on a sender name to see how many complaints that organization has filed, monthly activity timeline, and which other domains in your watchlist they have targeted.

### 3. Investigate a suspicious takedown
Open Current Site on a domain you own to review every complaint filed against it, including who filed it, on whose behalf, and what GTR records about it.

### 4. Draft a counter-notice
Open the Dispute drawer to copy a DMCA §512(g) counter-notice template, adapt it to your case, and keep notes on your filing status.

### 5. Audit a client portfolio
Bulk add domains from a client handoff to quickly see which of them have outstanding takedown activity, and from whom.

## Who This Is For

- Webmasters
- Site owners
- Agencies managing multiple domains
- SEO specialists dealing with ranking drops
- Legal operations teams at content-heavy sites
- Domain portfolio operators
- Researchers studying DMCA abuse patterns (with optional Lumen secondary)

## Who This Is NOT For

- Anyone needing real-time DMCA detection. Underlying data is approximately 30-60 days behind real-time events. There is no public source that fixes this; we are not going to pretend otherwise.
- Anyone needing per-URL lists of removed URLs without optional Lumen secondary. Google Transparency Report publishes counts, not URL lists. The optional Lumen secondary path provides URL lists for users with a researcher token.

## What It Does Not Do

- Does not provide real-time DMCA alerts (data source is monthly-updated)
- Does not provide legal advice
- Does not submit counter-notices on your behalf
- Does not block websites
- Does not scan page content
- Does not aggregate or redistribute Google or Lumen data
- Does not evaluate complaint validity
- Does not require an account, token, or email signup for basic use

## Privacy And Permissions

The extension talks to Google Transparency Report (always), Lumen Database (only when you opt-in to enrichment with a researcher token), and Archive.org (only when Lumen is enabled and you trigger source health checks). All other data stays in your browser.

Permissions in plain English:

- `storage`: save watchlist, settings, complaint cache, and (if you enable Lumen) your token
- `alarms`: run scheduled background checks
- `tabs` and `activeTab`: detect the active tab's domain for badge and Current Site
- `sidePanel`: open the monitor panel in Chromium browsers
- `notifications`: alert on new complaints discovered in the latest source data refresh
- `host permission for transparencyreport.google.com`: send domain-search requests to Google Transparency Report's public copyright endpoints
- `host permission for lumendatabase.org`: send Lumen API requests when Lumen secondary is opted in
- `host permission for archive.org`: query Wayback Machine availability when running Source Health checks (Lumen-only feature)

No analytics. No telemetry. No third-party tracking. No external sync server. No `<all_urls>` permission.

See `PRIVACY.md` for the full policy.

## Setup Notes

1. Install the extension from your browser's store.
2. Open the welcome wizard. Read the honest data-freshness note (Google Transparency Report data is approximately 30-60 days behind real time).
3. Add your first domain.
4. Choose a check interval.
5. (Optional, for existing Lumen researchers only) If you already hold a Lumen Database researcher token obtained for journalism, academic study, or legislative/policy research, you can enable Lumen secondary enrichment in Settings → Advanced to unlock per-URL data and richer sender forensics. Lumen staff confirmed in writing (April 2026) that monitoring your own domains is not a use case they grant tokens for — do not apply for a token just to use this extension.

That's it. No accounts, no email, no waiting on approvals.

## Suggested Keywords

- DMCA
- takedown notice
- Google Transparency Report
- copyright removal audit
- counter-notice
- webmaster tools
- domain monitor
- DMCA history
- copyright troll
- repeat offender
- sender forensics
- search removal audit
- takedown audit
- DMCA pattern detection
- Lumen Database

## Screenshot Ideas

1. Watchlist with mixed clean / has_new / has_complaints domains
2. Current Site inspector showing a complaint card with sender, copyright owner, counts, and source link
3. Sender Forensics Card showing total notices, monthly sparkline, top targeted domains
4. Dispute drawer with counter-notice template preview
5. Welcome wizard step 1 with honest freshness disclosure
6. Settings drawer Advanced section with Lumen toggle
7. Settings screen with pause mode and excluded domains

## Submission Notes

- Category: Developer Tools
- Homepage: https://dmca.cam
- Privacy policy: see `PRIVACY.md`
- Store IDs: TBD (reserve after v1.0 feature lock)
- Honest positioning: the listing must clearly state the ~30-60 day data freshness limit. Do not write copy that suggests "real-time" or "instant" alerts.
