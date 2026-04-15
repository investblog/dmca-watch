# DMCA Watch

Browser extension for webmasters: historical audit of DMCA complaints filed against your domains, with sender forensics and counter-notice templates. **Retrospective audit and pattern detection — not real-time alerting.**

> Status: **v0.1.0 draft / bootstrap** — Phase 0 source pivot done 2026-04-14, doc rewrite in progress, code surface migration is Phase 2. See [SPEC.md](SPEC.md) and [ROADMAP.md](ROADMAP.md).
>
> Primary source for v1 is **Google Transparency Report** (public undocumented JSON API, no token required). Lumen Database is optional secondary enrichment for users with a researcher token. Google Search Console is out of v1.
>
> Important: Google updates the Transparency Report dataset approximately once per month, so the data this extension surfaces is **30 to 60 days behind real-time events**. This is a fundamental constraint of the source, not a bug. The extension is positioned as a *retrospective audit tool*, not an *early warning system*.
>
> Landing: [dmca.cam](https://dmca.cam)

## Why

Fake DMCA complaints are a large-scale problem: copyright trolls, competitors, reputation attacks. The usual effect is a URL quietly removed from Google Search without notifying the owner. If the owner does not find out and file a counter-notice in time, the URL stays removed.

Google publishes the complete record of these removal actions in [Google Transparency Report](https://transparencyreport.google.com/copyright). It is searchable by domain, by reporting organization, and by copyright owner. But the official UI is built for casual research, not for portfolio-level monitoring of your own sites over time. There is no "watchlist" feature, no alerts on new complaints in the latest dataset refresh, no sender pattern detection across multiple domains. DMCA Watch is the audit-and-pattern layer that should already exist.

For users with a Lumen Database researcher token, optional secondary enrichment adds per-URL lists and richer forensics — Google Transparency Report publishes counts of removed URLs but not the actual URLs themselves; Lumen has them. Lumen is opt-in via Settings → Advanced; the extension works fully without it.

## Planned features (v1)

- Watchlist of domains with scheduled background checks against Google Transparency Report
- Badge indicator on the extension icon for new complaints since the last source data refresh
- Side panel with complaint details: sender, copyright owner, URL counts, dates
- Sender Forensics Card: top reporters / copyright owners targeting a domain, monthly activity timeline
- Counter-notice templates (DMCA 17 U.S.C. §512(g))
- Honest data-freshness disclosure in welcome wizard, settings, and tooltips
- Browser notifications on new complaints
- Pause mode and excluded domains
- IDN support
- Dark / light / auto theme
- Chrome, Edge, Firefox
- Optional Lumen secondary enrichment (Settings → Advanced) for users with a researcher token

## Sources

- **v1 primary:** Google Transparency Report — undocumented JSON API on `transparencyreport.google.com/transparencyreport/api/v3/copyright/`. Public, no auth, ~monthly updates.
- **v1 optional secondary:** Lumen Database — researcher API. Opt-in via Settings → Advanced. Adds per-URL lists and richer sender forensics. Note: Lumen staff confirmed in writing (April 2026) that they do not grant researcher credentials for the "monitor your own domains" use case — their program is restricted to journalism, academic, and legislative/policy research. This secondary path is only usable by people who already hold a Lumen token obtained for one of those purposes.
- **v2 research:** Google Search Console (probably via OAuth + Messages inbox scraping) for verified property owners who want fresher signals. Not a v1 commitment.

## Development

```bash
npm install
npm run dev          # Chrome dev build
npm run dev:firefox  # Firefox dev build
npm run dev:edge     # Edge dev build
npm run build
npm run zip:all
npm run check        # TypeScript + ESLint
```

## Tech Stack

- [WXT](https://wxt.dev)
- TypeScript strict
- Vanilla DOM, zero runtime dependencies

## Sibling projects

Part of the 301.st webmaster toolkit line, alongside [VirusTotal Domain Monitor](https://github.com/investblog/virustotal), Redirect Inspector, CookiePeek, Geo Tier Builder.

## License

TBD
