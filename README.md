# Warframe Arbitrations Guide

A dark-mode web guide covering Arbitrations strategy, builds, Kuva farming, and Vitus Essence.

# [arbi.guide](https://arbi.guide/)

**Author:** Geek (`@.edc` on Discord) - [Arbitration Goons community](https://discord.gg/Arbitrations)

## What's in this repo

This repository is the deployed site - everything here is what gets served at `arbi.guide`, hosted via Cloudflare Pages.

| File / Folder | Description |
|---|---|
| `index.html` | The complete guide - a single self-contained page |
| `.media_cache/v1/` | Converted media assets (WebP images, MP4 videos) referenced by `index.html` |
| `logo.png` | Site favicon and brand logo |
| `sitemap.xml` | Sitemap for search engine indexing |
| `robots.txt` | Crawl directives pointing to the sitemap |

## Features

- Full darkmode design
- Sticky sidebar with section navigation and copy-link buttons
- Expandable lightbox for full resolution image and video viewing
- Section-jump flash highlight when navigating via sidebar or shared links
- User controls for font size, spacing, and content width (saved to localStorage)
- Lazy loaded images and videos with priority tiers and shimmer placeholders
- Guide search shortcuts: `/` to focus, `Enter` / `Shift+Enter` to step through, `Esc` to clear
- Live viewer count showing how many people are reading the guide right now
- Responsive mobile layout with slide in sidebar and scroll progress bar
- Accessibility: skip-to-content link, respects `prefers-reduced-motion`
- Particle animation in desktop margins
- Easter eggs :3

## License

Site content © the guide authors. HTML/CSS/JS shell is MIT licensed - see [LICENSE](LICENSE).
