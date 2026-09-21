# Stoa Capital

React + Vite site for stoacap.com, mirroring the [astorivc](https://github.com/astorimattia/astorivc) layout, design system, and public-facing content under the Stoa Capital name.

## Status

Content (portfolio, track record, co-investors, disclosures, founder bio) is copied from astori.vc verbatim, with the brand name/domain swapped (Astori Ventures → Stoa Capital, astori.vc → stoacap.com) for public-facing copy. Stoa Capital is a brand/DBA of Astori Ventures LLC, not a separate legal entity — legal/regulatory references (the operating entity, the Opus Advisors LLC subsidiary, the Alternative Markets LLC broker-dealer relationship, FINRA/SEC registrations) are kept under the Astori Ventures LLC name throughout, with "dba Stoa Capital" noted where relevant. Verify this structure is still accurate before merging/publishing to the live domain, since these are regulated claims about securities licensing and registration status.

Deliberately not carried over from astorivc: its Redis-backed admin CMS, LP memo distribution pages, and analytics tracking APIs (`api/*`, `Admin.jsx`, `LPMemo.jsx`, the `/notes` nav link) — those are specific to Astori Ventures' fund operations and require their own infrastructure/secrets (Redis instance, email provider) that this project doesn't have configured.

Also not carried over: astorivc's actual logo/OG image assets and Crunchbase/LinkedIn company profile links, since those point to Astori Ventures' real brand assets and company pages rather than Stoa Capital's. The favicon uses "SC" initials as a placeholder; a real Stoa Capital logo and OG image should replace it before publishing.

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # production build
npm run preview  # preview production build
npm run lint      # eslint
```

## Deployment

Configured for Vercel (see `vercel.json`). Point the `stoacap.com` domain at this project once the content above has been verified.
