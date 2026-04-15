# DMCA Watch — Manifesto

> Draft v0.2. Landing copy for [dmca.cam](https://dmca.cam). Written in English as the default for international distribution; Russian/other translations to follow if needed.

---

## Built by webmasters who are tired of losing pages to fake takedowns.

Every day, thousands of DMCA complaints are filed against legitimate websites by people who don't own the content they claim to protect. Competitors trying to knock you out of search results. Shakedown operations run by "rights agencies" that don't represent anyone. Reputation-erasure services hired to make things disappear. Automated bots generating takedown claims against pages that never copied a thing.

When one of those complaints lands at Google, the targeted URL can vanish from search results within hours. You are not notified. You get no chance to respond before removal. Traffic drops. Revenue drops. By the time you notice — if you notice at all — you may have missed the 10-day window to file a counter-notice, and the removal becomes permanent.

You can find the public record of every one of those complaints. Google publishes it. Nobody is reading it for you.

---

## What this is, and what it is not

Let's start with the limit, because it shapes everything else.

**DMCA Watch is not a real-time alert system.** Google publishes copyright removal data through its Transparency Report, but Google updates that data approximately once per month. By the time a new complaint shows up in the dataset, the URL has already been gone from search results for one or two months. We cannot warn you before the damage; nothing built on Google's own published data can.

**What DMCA Watch is** is the audit and pattern-detection tool that should already exist. It looks at every domain you own, pulls the most recent DMCA requests against each one from Google's Transparency Report, and accumulates that history locally so it grows every time you refresh. It shows you who has been hitting you, how often, and how badly. It tells you who the repeat-offender reporters are. It surfaces the "rights agencies" that file ten complaints a week against a single domain. It gives you the historical record you need to understand what happened, file informed counter-notices, and recognize patterns before you waste another quarter wondering why your traffic is sliding.

For a domain with a few dozen historical DMCA requests we fetch the full record on the first check. For a high-volume target with thousands of historical requests we fetch the most recent 100 per check and keep accumulating new entries on every refresh. Either way, history never gets silently dropped — once a complaint is in your local storage it stays there until you remove the domain.

If you want a real-time monitor, you do not have one. Nobody does. We are not going to lie about it.

If you want to know everything that has happened so far, and to see the pattern clearly, that is what this tool is for.

---

## Why this hasn't been fixed

Google's Transparency Report has been public since 2011. Every copyright removal request Google has acted on for Search is in there, indexed by domain, by reporting organization, by copyright owner. Anyone can search it.

But searching is not monitoring. Going to transparencyreport.google.com every morning to paste each of your domains into the search box is not a strategy, especially if you operate ten or fifty or two hundred domains. The data is open, the interface is built for casual researchers, and there is no way to watch your own portfolio over time without doing it manually.

So the data sits there, the complaints keep landing, and webmasters keep finding out only when the damage is already two months old.

---

## What DMCA Watch does

You install the extension. You add your domains to a watchlist. The extension checks them on a schedule against Google Transparency Report and shows you, in a single side panel, every DMCA-related removal action that has been taken against your sites.

For each domain, you see:

- Its DMCA history from Google Transparency Report, accumulated locally across refreshes
- Who filed them — the reporting organization name
- On whose behalf — the copyright owner
- How many URLs were targeted in each request, and how many Google actually removed
- Dates from the source data, with honest "this is N days behind real time" labelling
- Patterns: which reporters keep coming after this domain, which copyright owners they claim to represent, monthly activity over years

For each suspicious sender, you see a forensics card: total complaints they have filed, monthly activity timeline, every domain in your watchlist they have touched. You see the pattern with your own eyes; we do not slap "abuser" labels on anyone, because that is a judgment call we are not going to make for you.

When you find a complaint that looks wrong, the extension hands you a clean DMCA §512(g) counter-notice template you can copy, edit, and submit yourself. We don't file for you — counter-notices are legal documents you are signing under penalty of perjury, and that decision stays yours.

That's the whole product. No backend, no analytics, no tracking. Your watchlist lives in your browser. Your queries go directly from your device to Google Transparency Report and nowhere else. The code is open source. The privacy policy fits on one page.

---

## What you'll need

Nothing. No account, no API token, no email exchange with anyone. Install the extension, add your domains, look at the data.

If you already hold a Lumen Database researcher token for academic, journalistic, or legislative/policy work, you can optionally enable Lumen enrichment in Settings → Advanced. Lumen has data Google Transparency Report does not — full per-URL lists for each notice and complaints filed against non-Google services like Twitter or GitHub. That feature is opt-in and disabled by default.

**We asked Lumen directly.** We wrote to Lumen staff and asked whether we could obtain researcher access to run this product. They answered, in writing, in April 2026, that the use case of "monitoring takedown notices filed against my own domains" is not one they grant researcher credentials for, and directed us to webmaster and Search Console tools instead. Their public no-token endpoint is limited to 1 notice per email per 24 hours and they have no plans to raise that. We respect their answer and we are not going to tell you to waste time applying for a token you will not get. So we built around Google Transparency Report as the primary public source, and we kept Lumen enrichment as an optional feature for the small group of users who already hold a Lumen token obtained for a different research purpose.

We are not gating the product behind anyone else's approval process. We tried to once, in an earlier plan. We got told no. We believe them. So we built around the public source instead.

---

## What we will never do

- Sell, share, or log your data
- Run a central server that tracks which domains you are watching
- Inject ads, safe-browsing warnings, or modifications into the pages you visit
- Pretend to give legal advice
- Auto-file counter-notices on your behalf
- Pretend to offer real-time alerts when the underlying data is monthly
- Use Lumen's API in ways that would compromise our researcher access for the optional secondary path

---

## Who we are

We are webmasters. Some of us run content sites. Some of us run search-adjacent products. All of us have watched legitimate pages disappear from Google on fake complaints and had nothing to do about it except guess at the cause and rebuild.

DMCA Watch is part of the 301.st webmaster toolkit — the same line that produced VirusTotal Domain Monitor, Redirect Inspector, CookiePeek, Geo Tier Builder, and others. Tools built by operators for operators, not for general consumers.

We built this because we needed it ourselves.

---

## What's next

- Bulk import for agencies managing client portfolios
- Cross-domain insights: "this reporter has hit five other domains in your watchlist"
- Better sender-pattern visualization
- Pre-built counter-notice templates for common abuse patterns
- Lumen Power Pack for researchers who want per-URL detail and richer forensics
- Research track: real-time DMCA detection through Google Search Console for verified property owners (probably involves OAuth + scraping the GSC Messages inbox; not a v1 commitment, not a v1 promise)
- A shared, community-maintained view of repeat-offender complainants

Everything we build stays free, open source, and aligned with webmasters — not with whoever is filing the complaints.

---

## Get involved

- **Install:** Chrome Web Store · Firefox Add-ons · Microsoft Edge Add-ons _(links live at launch)_
- **Source:** github.com/investblog/dmca-watch _(when public)_
- **Contact:** hello@dmca.cam
- **Part of:** [301.st](https://301.st) — the webmaster toolkit line

If you are a webmaster who has been hit by a fake takedown, this is for you.

If you haven't been hit yet, install it anyway. You will be — and when you are, you will want the history already loaded.
