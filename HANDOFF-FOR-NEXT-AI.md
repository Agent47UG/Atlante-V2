# Atlante — Handoff for the next AI

_Last updated: 2026-09-01. Written by the previous assistant for whoever picks this up next._

## TL;DR
Atlante is a React + Three.js + Vite single-page app that visualizes civilizations
and a knowledge graph over a 3D globe. This session upgraded it from a **static**
graph into an **infinite, internet-fed, shared** knowledge graph pulled live from
Wikidata/Wikipedia, cached in layers, with **Gemini-narrated stories**, deployed on
**Cloudflare Pages + Turso**.

**Status: implementation complete, both builds green.** What's left is entirely
user-owned: pushing to GitHub and deploying to Cloudflare (see `DEPLOY.txt`).

## ⚠️ Hard rules (do not violate)
- **NEVER run `git push` or connect to GitHub.** The user is on a monitored
  corporate laptop; a prior network probe to GitHub triggered a security alert.
  The user does ALL pushes and deploys themselves.
- **Do not run mid-task `npm install`.** If you truly need a new package, STOP and
  give the user a batch list to install. (Currently NO new packages are needed —
  everything in `package.json` is already installed.)
- **`SETUP-FILL-ME.txt` contains live secrets** (Gemini key in plaintext; Turso/
  GitHub tokens). It is gitignored and must stay uncommitted. Never print its
  secret values back in full. Remind the user to rotate the Gemini key.

## How to verify the current state (safe, offline)
```powershell
cd <project root>
npm run build                                  # client: tsc -b && vite build  → must pass
npx tsc -p functions\tsconfig.json --noEmit    # server functions typecheck    → must pass
```
Both currently exit 0. Do NOT run the app against live APIs on the corporate
laptop unless the user asks — that hits Wikidata/Gemini/Turso over the network.

## Architecture

### Client (in `src/`, dependency-free for the live layer)
- `src/data/new-data/graph.ts` — the seeded "core": `NODE_MAP`, `ADJACENCY`
  (plain mutable objects), `EDGES` (mutable array), plus sync helpers
  (`neighborsOf`, `pathBetween`, `edgeBetween`, `resolveNodes`). **Unmodified** —
  the live layer mutates these objects in place so all existing sync helpers
  transparently see new nodes.
- `src/data/new-data/liveStore.ts` — **the growth layer** (NEW). Fetches from the
  backend, merges into NODE_MAP/ADJACENCY/EDGES, caches in IndexedDB (raw, no
  `idb` dep), notifies React via `subscribe`. Key exports:
  - `ensureNode(id)` — load a node's neighbors on demand. No-op for core/slug ids
    and already-expanded nodes. Only Q-ids (`/^Q\d+$/`) are "live".
  - `bridgeCore(coreId, term)` — grafts a civilization's live Wikidata frontier
    onto its curated root node (the doorway from core → infinite).
  - `buildLiveStory(text)` — splits "A to B" into two concepts, resolves both via
    `/api/search`, POSTs `/api/story`, merges nodes, grounds the story on the
    civilization **geographically nearest the starting concept** (user's choice),
    returns a `Story`.
  - `subscribe`, `isLoading`, `loadError`, `isExpanded`, `isLiveId`, `NODE_GEO`
    (lat/lon/year/image sidecar, since `KnowledgeNode` has no geo fields).
- `src/components/GraphExplorer.tsx` — wired to the live store: `ensureNode` on
  focus change, `bridgeCore` on civ open, `subscribe`→re-render (a `storeVersion`
  state is threaded into the `focusView` memo deps so fetched neighbors appear),
  and a "Charting…" loading pill / error pill.
- `src/components/StoriesMenu.tsx` — `onBuild` is now `async` with a `busy`
  ("Charting…") state.
- `src/App.tsx` — `buildAndPlayStory` tries the local `buildStoryFromText` first,
  then falls back to `buildLiveStory`. `startStory` uses `story.civilizationId`
  as the "ground" (live stories set it to the nearest civ).
- `src/styles.css` — Stories menu was redesigned to a dark "star-chart"
  (`--sky-*` / `--star-*` tokens); added `.graph-loading` spinner styles.

### Server (Cloudflare Pages Functions in `functions/`)
Compiled separately by Cloudflare — NOT type-checked by `npm run build`
(client `tsconfig.json` only includes `src`). Has its own `functions/tsconfig.json`.
- `functions/api/_lib/types.ts` — wire types (`WireNode`, `WireNeighbor`,
  `FetchedNode`, `NodeResponse`, `Env`, `KVNamespace`).
- `functions/api/_lib/wikidata.ts` — `fetchWikidataNode(qid)` (EntityData JSON +
  ONE batched enrichment SPARQL + Wikipedia REST summary), `searchWikidata(term)`.
  MAX_NEIGHBORS=8, MIN_SITELINKS=8. (Bidirectional UNION SPARQL 502s on the public
  endpoint — that's why it uses EntityData-outgoing + batched enrichment.)
- `functions/api/_lib/db.ts` — Turso client, `ensureSchema` (auto-creates on every
  request), `readNode`, `writeNode` (pinned rows protected), `neighborIds`.
- `functions/api/_lib/resolve.ts` — `resolveNode(env,id,waitUntil)`:
  KV → Turso → Wikidata, 7-day KV TTL.
- `functions/api/_lib/pathfind.ts` — `findPath(env,from,to)` bidirectional BFS
  (MAX_EXPANSIONS=24, MAX_DEPTH=6).
- `functions/api/_lib/gemini.ts` — `narratePath(env,question,stops)` via Gemini
  generateContent; falls back to node summaries if the key/model fails.
- `functions/api/_lib/http.ts` — `json`, `errorJson`, `CORS`, `Ctx`.
- Endpoints: `node/[id].ts` (GET /api/node/:id), `search.ts` (GET /api/search?q=),
  `path.ts` (GET /api/path?from=&to=), `story.ts` (POST /api/story).

### ID convention
Core/seed nodes use slugs (`"zero"`, `"mesopotamia"`); live nodes use Q-ids
(`"Q935"`). `isExpanded` treats non-Q-ids as always-expanded. API only accepts Q-ids.

## Env bindings the app needs on Cloudflare
`TURSO_URL`, `TURSO_TOKEN`, `GEMINI_KEY`, `GEMINI_MODEL` (=`gemini-2.5-flash`),
and a KV namespace bound as `ATLANTE_KV`. Values live in `SETUP-FILL-ME.txt`.
Client optionally reads `VITE_API_BASE` (defaults to `/api`).

## What was completed this session
- Stories menu dark redesign + polish (solid bg, reduced radii, blend-mode byline).
- Planning/setup docs: `ideas.txt`, `infinite-atlante-plan.txt`, `SETUP-FILL-ME.txt`.
- `.gitignore` (excludes node_modules, dist, SETUP-FILL-ME.txt, .env*, .dev.vars,
  *.local, .wrangler). Baseline commit made.
- Full server API in `functions/`.
- Client `liveStore.ts` + full wiring into GraphExplorer / StoriesMenu / App.
- **Bug fixes**: added missing `FetchedNode` type; typed Gemini `res.json()` as
  `any`; **fixed wrong import paths** — `path.ts`/`search.ts`/`story.ts` are
  directly in `functions/api/` so they must import `./_lib/...`, NOT `../_lib/...`
  (only `node/[id].ts` is a level deeper and correctly uses `../_lib/`). This
  would have broken 3 endpoints on deploy.
- `DEPLOY.txt` — browser-only deploy runbook.

## What's left (USER-OWNED — do not do these for them)
1. Push code to GitHub repo `Agent47UG/Atlante-V2` (excluding node_modules, dist,
   SETUP-FILL-ME.txt).
2. Create Cloudflare KV namespace `ATLANTE_KV`, connect Pages to the repo, add the
   env vars + KV binding, deploy. Full steps in `DEPLOY.txt`.
3. Rotate the Gemini API key (was plaintext during setup).

_Note: the user said they're moving the project to a personal PC to commit from
there "because there are many problems." If they hit build/runtime issues on the
new machine, first re-run the two verify commands above; a fresh `npm install`
may be needed there since node_modules shouldn't be copied/committed._

## Possible next enhancements (not started — optional)
- **Globe/timeline markers for live nodes**: currently the globe only renders the
  ~21 curated `CIVILIZATIONS`. `NODE_GEO` already holds lat/lon/year for live
  nodes; rendering a globe glow + moving the timeline for a focused live node with
  coords is a `Globe.tsx` / timeline change (medium effort).
- Richer relationship verbs on bridged/story edges (currently generic
  "leads to" / "related to" in a few spots).
- Rate-limiting / abuse protection on the public API before wide sharing.

## Gotchas
- Live Q-nodes have `civilizationId === undefined`; an `App.tsx` useEffect maps
  `focusId → civ` via `NODE_MAP[focusId]?.civilizationId` and no-ops for them
  (intended).
- `buildPathView` only needs the step nodes present in `NODE_MAP` (it lays them
  out in sequence) — it does NOT require edges in ADJACENCY, which is why live
  stories work by merging just the path nodes.
- First fetch of any concept is a cold ~2–4s (Wikidata + enrichment + summary);
  cached everywhere after that.
