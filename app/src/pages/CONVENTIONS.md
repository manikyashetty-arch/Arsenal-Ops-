# Page-folder conventions

Pages in this directory follow a co-located folder layout so that a page's
modals, tabs, and sections live next to its orchestrator rather than in a
distant `components/` tree.

## Folder layout

```
pages/
  Foo/
    Foo.tsx          ← orchestrator; the only file App.tsx imports through index.ts
    index.ts         ← re-export: `export { default } from './Foo';`
    modals/
      FooBarModal.tsx
    tabs/
      FooSomethingTab.tsx
    sections/        ← non-tab page regions
      FooHeader.tsx
    components/      ← small reusable pieces specific to this page
      FooCard.tsx
```

`App.tsx` imports `./pages/Foo` (no extension) — the path resolves through
`index.ts`. Stack traces and file pickers still show `Foo.tsx` rather than a
generic `index.tsx`.

## Extraction rules

1. **Queries stay at the page level.** `useQuery` lives in the orchestrator
   — or, once the data layer is large, in a co-located `hooks/use<Page>Data.ts`
   the orchestrator calls (see `AdminDashboard/hooks/` and
   `ProjectDetail/hooks/useProjectDetailData.ts`). Either way, sub-components
   receive `data`/`isLoading` as props. Do not re-call `useQuery` with the
   same key in a child — it doubles subscriptions.

2. **Mutations stay at the page level.** Same rule as queries: in the
   orchestrator or its data hook. Pass the `mutate` function (or a wrapped
   handler) down. Form state can live in the child (modals especially benefit
   from owning their own form state); the page owns the cache. Effects that
   drive the orchestrator's own render/routing (URL sync, access-correction
   redirects) stay in the orchestrator, not the data hook.

3. **Each sub-component has an explicit `interface FooProps`** at the top of
   its file. No implicit closure dependencies on parent variables.

4. **Handlers extract DOWN with their component** when they're only used by
   that component. Handlers that touch multiple sub-trees stay at the parent.

5. **Co-located per-page `types.ts` is the home for a page's domain types.**
   When a page's shapes are shared across its orchestrator, hooks, tabs, and
   sections, declare them once in `pages/<Page>/types.ts` and import from there
   (see `AdminDashboard/types.ts` and `ProjectDetail/types.ts`) rather than
   redeclaring the same `interface` in each file. A single *cross-page* shared
   types module (audit F-T1) remains a separate initiative — per-page `types.ts`
   is not that.

6. **No barrels until a folder has ≥4 files.** Explicit named imports keep
   the dependency graph readable.

7. **`React.lazy` only when audit or plan specifies.** Lazy-loading a small
   modal that opens on user click adds chunk-load latency for no benefit.

## Why this exists

Audit F-X1 (see `.branch-review/frontend-audit-*.md`) flagged 5 page files
over 1,000 LOC each. The split plan is in
`.plans/split-monolithic-frontend-*.md`. This document is the contract every
extraction PR follows so the splits don't drift apart.
