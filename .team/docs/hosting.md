# Hosting shortlist

Ella's starting point at intake for "where will it run". Two or three well-known managed options per kind of product, each with when to pick it. It holds no prices or free-tier limits, because those change; Rohan checks them on the providers' own pages for each project, and Bea prices from what he finds. How hosting is chosen and set up: [foundation, hosting](../playbooks/foundation.md#hosting).

Last reviewed: 2026-11-12. The [role refresh](../playbooks/improve.md#5-role-refresh) re-checks this list each quarter.

| Kind of product | Options | Pick it when |
|---|---|---|
| Website with no backend (pages, docs, a landing page) | [Cloudflare Pages](https://pages.cloudflare.com/) · [Netlify](https://www.netlify.com/) · [GitHub Pages](https://pages.github.com/) | Cloudflare or Netlify for previews per PR and forms; GitHub Pages when the site lives in the repo and needs nothing else |
| Web app built on a front-end framework | [Vercel](https://vercel.com/) · [Netlify](https://www.netlify.com/) · [Render](https://render.com/) | Vercel for Next.js; Netlify for most other frameworks; Render when it also needs a long-running server |
| Backend, API or background jobs | [Render](https://render.com/) · [Railway](https://railway.com/) · [Fly.io](https://fly.io/) | Render for the simplest setup with previews; Railway for quick multi-service projects; Fly.io when users are spread across regions |
| Database, sign-in and file storage | [Supabase](https://supabase.com/) · [Neon](https://neon.tech/) · [Firebase](https://firebase.google.com/) | Supabase for Postgres with sign-in and storage in one; Neon for plain Postgres with branch copies for previews; Firebase for mobile-first apps already on Google |
| Mobile app builds and updates | [Expo EAS](https://expo.dev/eas) · [Codemagic](https://codemagic.io/) | Expo for React Native; Codemagic for Flutter or native code. Both build and sign without your own Mac |
| AI feature or agent | The web or backend host above, plus the model provider's API | Long-running or scheduled agents go on a backend host, not a web host with short time limits |

**Large clouds** ([AWS](https://aws.amazon.com/), [Google Cloud](https://cloud.google.com/), [Azure](https://azure.microsoft.com/)) are not a default for a beginner: they take more setup and upkeep. Use one when there's a reason (credits, a rule your users require, a service only it offers), with infrastructure as code.

**Anything off this list** (another cloud, a company's own servers, a provider the owner already pays for) is fine. Rohan researches it for that project from the provider's own docs and any official skill it publishes, and the [practice and skill review](../playbooks/engagement.md#practice-and-skill-review) vets that skill as usual.
