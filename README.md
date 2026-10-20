# WQA Testbench

One Vercel site for sharing short-lived tests and assets with clients. Drop an HTML file, a folder or a ZIP, or start from a template with a JSON file, and get a link like `tests.wearewqa.com/nav-card-sort-k7q2`. The link works without an account, can have a password, and ends on its own. When it ends, the link stops working and the files are deleted straight away; the responses stay on the dashboard for the team to download for 30 days (`RESPONSE_RETENTION_DAYS`), then they're deleted too.

Built against the requirements in *Problem definition: sharing short-lived assets and tests with customers* (20 Oct 2026).

## What it does

| Req | What it says | How Testbench handles it |
| --- | --- | --- |
| R1 | Share by link, no attachment | Every drop gets a link at the site root |
| R2 | No account for the recipient | Links open for anyone; the team signs in, visitors never do |
| R3 | Lifespan set by the publisher, removed automatically | 1 day, 2 days, 1 week or 30 days (configurable). Checked on every request. The link and files go when a drop ends; responses stay team-only for 30 days, then go |
| R4 | Lifespans fit real review windows | `LIFESPANS` env var. Change it once the sharing inventory shows the real range |
| R5 | Client material not exposed | Random link endings, optional password, `noindex` everywhere, hosted pages run sandboxed (see Security) |
| R6 | Agents can publish | API with personal tokens: `POST /api/v1/drops`, `PUT` to update. See the API page in the app |
| R7 | Single HTML, folder or ZIP | All three, from the drop zone or the API |
| R8 | Update the same link | Upload a new version or new JSON; the link and responses stay |
| R9 | See what's live, who owns it, when it ends | Dashboard with owner, end time, views and response counts; "Ends in the next 24 hours" count |
| R10 | Low running cost | Vercel Hobby/Pro, Vercel Blob and Upstash Redis free tiers cover light use |
| R11 | WQA SSO | Google sign-in, limited to `@wearewqa.com` |
| R12 | Optional password | Per drop. Changing it signs everyone out of the old one. 10 tries per 15 minutes per IP |
| R13 | Templates in a shared repository, reused with new data | Templates page: upload a page once, list the JSON keys it needs, add an example |
| R17 | One site, a path per item | Yes |
| R18 | Opens unaided | Plain password screen, plain "This link has ended" page, a slim bar showing the end date |
| R19 | Anyone creates or uses a template; only some can change it | Owner, named editors and `TEMPLATE_ADMINS` can edit; everyone can use |

Not built yet: **R14** (a skill that formats JSON for a template), **R15** (per-person magic links) and **R16** (in-page feedback). These are Could priority, and the problem definition flags R15 and R16 as scope creep to phase in later. The data model has room for them.

### Saving responses

Hosted pages can save data. Testbench provides the same storage API the WQA study files already use (`window.claude.use("db")`, with `collection().add/doc().set/update/delete/onSnapshot`, and `use("downloads")`), so files like the card sort and tree test save here with no edits. Responses show on the drop's page and download as CSV or JSON, including after the drop ends: ended drops are listed under **Ended** with their responses for 30 days. **Delete responses now** on the drop's page removes them sooner, for example when a client asks.

Each drop chooses who sees saved responses *inside the page*:

- **Everyone with the link**: for moderated sessions, where the moderator's screen lists every session.
- **Each visitor sees only their own**: for unmoderated tests sent to many people.

The team always sees everything on the dashboard.

### Templates

A template is a page that reads its content from JSON. The JSON reaches the page two ways:

- `window.testbench.data`, for new templates.
- The `config/content` document, for pages written against `window.claude.use("db")`. The WQA card sort and tree test read their content from there, so they work as templates as they are.

To set up **Card Testing**: Templates → Add a template → drop `grouping-study.html`, name it "Card Testing", required keys `sorts`, and drop `examples/card-testing.example.json` as the example. Anyone can then start a card test by dropping a new JSON file. The tree test works the same way with `wayfinding-trial.html`, required keys `tree, tasks`, and `examples/tree-testing.example.json`.

Each drop takes its own copy of the template, so editing a template never changes a test that's already running.

## Set up on Vercel

1. **Push this folder to a GitHub repo** and import it in Vercel (New Project). The framework preset is Next.js; no build settings to change.
2. **Add storage.** In the project: Storage →
   - **Blob** → Create, region **London (lhr1)** or another EU region, Access **Private**, and tick **Add a read-write token env var**. This adds `BLOB_READ_WRITE_TOKEN`.
   - **Upstash for Redis** (Marketplace) → Create, region **eu-west** (London or Ireland). This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. **Create a Google OAuth client** in Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Web application.
   - Authorised redirect URI: `https://<your-domain>/api/auth/callback/google`
   - Set the consent screen to **Internal** so only WQA Workspace accounts can use it.
4. **Set environment variables** (Settings → Environment Variables). See `.env.example`:
   - `NEXTAUTH_SECRET`: run `openssl rand -base64 32`
   - `NEXTAUTH_URL`: the site's URL, e.g. `https://tests.wearewqa.com`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `ALLOWED_DOMAINS=wearewqa.com`
   - `CRON_SECRET`: any random string
   - Optional: `LIFESPANS`, `DEFAULT_LIFESPAN`, `TEMPLATE_ADMINS`
5. **Deploy**, then add a custom domain (Settings → Domains), e.g. `tests.wearewqa.com`. A WQA domain helps clients trust the link and helps it past client IT filters.

The nightly clean-up (`vercel.json`) runs once a day, which the Hobby plan allows. Expiry doesn't depend on it: an ended drop stops working the moment its time is up, and its data is deleted the next time anyone opens it, views the dashboard, or the clean-up runs.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no Google or storage keys set, it runs in **local mode**: sign in with any `@wearewqa.com` email (no password), and files and data go in `.data/`. Local mode is off in production.

## API

Create a token on the API page, then:

```bash
curl -X POST https://tests.wearewqa.com/api/v1/drops \
  -H "Authorization: Bearer $WQA_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Nav readout","lifespan":"7d","html":"<!doctype html><h1>Hello</h1>"}'
```

| Call | Does |
| --- | --- |
| `POST /api/v1/drops` | Publish. Content is one of `html`, `zip` (base64), `files` (`[{path, content, encoding?}]`), or `templateId` + `data`. Optional `title`, `slug`, `lifespan`, `password`, `visibility` |
| `PUT /api/v1/drops/<slug>` | New version on the same link. Same content fields; optional `extend`, `title` |
| `PATCH /api/v1/drops/<slug>` | `{"extend":"7d"}`, `{"password":"…"}`, `{"password":null}`, `{"visibility":"own"}`, `{"end":true}`, `{"deleteResponses":true}` |
| `DELETE /api/v1/drops/<slug>` | End, delete responses and remove |
| `GET /api/v1/drops` | List |
| `GET /api/drops/<id>/responses?format=csv` | Download responses |
| `GET /api/templates` | List templates with their required keys and example JSON |

API requests are capped at 4 MB (a Vercel limit). Bigger uploads go through the dashboard, which uploads straight to Blob (up to 50 MB).

## Security

- **Hosted pages are sandboxed.** They are served from `/x/<slug>/<token>/…` with `Content-Security-Policy: sandbox` and shown in an `<iframe sandbox>` without `allow-same-origin`. They run with an opaque origin, so they can't read the site's cookies or storage, or call its APIs, even when the file URL is opened directly. Storage only works through the player page, which checks the drop is live and unlocked.
- **File URLs expire.** The `<token>` part is signed and lasts 12 hours, and it stops working when the drop ends or gets a new version.
- **Nothing is indexed.** `noindex` headers on every response; link previews show no title for password-protected drops.
- **Passwords** are hashed with scrypt. The unlock cookie is signed, HTTP-only, and expires with the drop.
- **Blob storage**: files sit in a **private** Vercel Blob store. Only the app, using the store's token, can read them; visitors only ever get files through the app. (Set `BLOB_ACCESS=public` only if your store was created as public.)
- **Before client data goes on it**, run artifact 5 from the problem definition (the security and confidentiality check) against this setup.

## Code map

```
app/[slug]                       public player: password gate, ended page, sandboxed iframe + storage bridge
app/x/[slug]/[token]/[...path]   serves a drop's files, injects the storage shim into HTML
app/api/d/[slug]/db              storage for hosted pages
app/(team)/…                     dashboard, new drop, drop page, templates, API page
app/api/…                        team API (session or Bearer token)
lib/shim.ts                      the window.claude.use("db") compatible shim
lib/service.ts                   create, update and settings rules for drops
lib/model.ts                     data model, expiry, templates, responses
lib/store/                       Upstash Redis + Vercel Blob, or local files in .data/
```
