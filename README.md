# Techverx Team Directory

Next.js app with MongoDB persistence, Excel import/export, table-first editing, and OpenAI-powered semantic search + staffing assistant.

## Setup

### 1. Environment (`.env`)

```env
MONGODB_URI=mongodb://localhost:27017/techverx
OPENAI_API_KEY=sk-...   # required for AI
```

Optional:

```env
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### 2. MongoDB

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Or use MongoDB Atlas — paste connection string as MONGODB_URI
```

### 3. Install & seed

```bash
npm install
npm run seed          # loads Resources Skill Sheet.xlsx + builds AI embeddings
npm run dev           # http://localhost:3000
```

## Deploy on Vercel

This is a **Next.js** app (not a static site). In Vercel **Project Settings → General**:

1. **Framework Preset:** Next.js (repo includes `vercel.json` for this).
2. **Build Command:** `npm run build` (default).
3. **Output Directory:** leave **empty** — do **not** set `public`. That folder is only for static assets (favicon, etc.), not the build output.
4. **Environment variables:** `MONGODB_URI`, `OPENAI_API_KEY` (use MongoDB Atlas for production).

Redeploy after changing settings.

## API keys

| Key | Required | Purpose |
|-----|----------|---------|
| `MONGODB_URI` | Yes | Persist team data |
| `OPENAI_API_KEY` | Yes for AI | Chat assistant, embeddings for semantic search, auto-embed on save/import |

Get an OpenAI key: https://platform.openai.com/api-keys

No other API keys needed for v1. Vector search runs in-app (cosine similarity on stored embeddings) — works with local MongoDB, no Atlas Vector Search required.

## Tags (any colon format — AI understands)

| Format | Example | Readable |
|--------|---------|----------|
| Allocation | `allocation:june:cis:4h` | June · CIS · 4h |
| Team allocation | `allocated:cis:core-team` | Allocated · CIS · Core Team |
| Month status | `may:bench`, `june:cis` | May · bench |
| Certificate | `certificate:devops:aws-developer-associate` | Certificate · Devops · Aws Developer Associate |
| Specialization tag | `spec:full-stack:node` | ties to specs list |
| Any namespace | `skill-focus:react`, `client:acme` | Skill focus · React |
| Freeform | `available` | as written |

### Managing tags (per person)

| Action | How |
|--------|-----|
| **Add** | Tags column → **+** (one or many lines; commas/newlines OK) |
| **Remove** | **×** on the chip, or **+N** popover → **×** on each tag |
| **Change** | Remove the old tag, then add the new one (no inline edit) |
| **Filter table** | Click a tag pill under the search bar (matches all spelling variants) |

Variants like `allocated:cis:core team` and `allocated:cis:Core-team` are stored as one canonical tag: `allocated:cis:core-team`.

### Clean up old / duplicate tags (whole database)

If you already saved multiple spellings of the same tag:

```bash
npm run normalize-tags
```

Then **Refresh** the app (and **Reindex** in the AI panel if you use semantic search).

**Excel:** edit the **Tags** column → **Import** (upsert by employee ID) to bulk-replace tags.

## Specializations (multiple per person)

Granular labels such as **Full Stack (Node)**, **Full Stack (Python)**, **DevOps**, **DevOps (Basic)** — auto-detected from skills/role, extended via `spec:*` tags, or **edit specs** on a row.

## AI generate profile

**AI Profile** button → enter `TV-xxxxx` + notes (skills, bench, allocations, role). Preview or **Generate & save**. AI creates skills, tags, projects, and stores `notes` for future context.

## Features

- **Table view** (default) — inline edit name, role, exp, stack, email
- **Skills** — expand row, add/delete skills, click to rate 1–5 (overrides AI)
- **Tags** — add per person, filter with AND logic
- **Import** — upload `.xlsx` (upsert by Employee Code)
- **Export** — Excel or JSON
- **AI panel** — natural language staffing questions + optional project matcher input
- **Reindex** — rebuild embeddings after bulk changes
