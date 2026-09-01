# Stoa Capital

React + Vite site for stoacap.com, scaffolded from the [astorivc](https://github.com/astorimattia/astorivc) layout and design system.

## Status

This is a starting scaffold. Content marked `[Placeholder — ...]` or `TODO` throughout `src/App.jsx`, `index.html`, and `public/llms.txt` needs to be replaced with Stoa Capital's real positioning, metrics, portfolio, co-investors, and — importantly — accurate legal/regulatory disclosures before this site is published to a live domain.

Deliberately not carried over from astorivc: its Redis-backed admin CMS, LP memo distribution pages, and analytics tracking APIs (`api/*`, `Admin.jsx`, `LPMemo.jsx`) — those are specific to Astori Ventures' fund operations and require their own infrastructure/secrets.

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # production build
npm run preview  # preview production build
npm run lint      # eslint
```

## Deployment

Configured for Vercel (see `vercel.json`). Point the `stoacap.com` domain at this project once content is finalized.
