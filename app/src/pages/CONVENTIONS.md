# Page conventions

When a top-level page component grows beyond ~600 lines, convert it from a
single `pages/Foo.tsx` into a folder using the layout below. This is a
behaviour-neutral refactor — no logic changes, no new abstractions.

## Folder layout

```
pages/Foo/
  Foo.tsx                  # the orchestrator component (default export)
  index.ts                 # one-line re-export: export { default } from './Foo';
  modals/                  # one file per modal lifted out of Foo
    FooXModal.tsx
  tabs/                    # or sections/, panels/, components/ — pick what fits
    FooXTab.tsx
```

The orchestrator file keeps the same name as the folder so stack traces stay
readable. The `index.ts` exists so imports of the page (e.g.
`import AdminDashboard from '@/pages/AdminDashboard'`) keep resolving without
changing the import site.

## Rules for extracting sub-components

1. **Queries stay at the parent.** Don't call `useQuery` in an extracted
   sub-component if the parent already does. Pass `data` down as a prop.
   Two subscriptions to the same key duplicates network state and
   complicates invalidation reasoning.
2. **Mutations stay at the parent.** Define `useMutation` in the orchestrator;
   pass the `mutate` function (or a small handler that wraps it) down as a
   prop. Sub-components shouldn't own server-state lifecycle.
3. **Local UI state moves with its consumer.** Filter strings, sort fields,
   "is this row expanded" booleans — extract these *down* with the component
   that reads them. Only state shared across siblings stays at the parent.
4. **Explicit prop interfaces.** Each extracted file declares its own
   `interface FooXProps { ... }` at the top. No shared types module yet —
   that's a separate initiative.
5. **No Context for prop drilling.** If a sub-component needs 6+ props, leave
   the prop list ugly. Don't introduce Context to "clean it up" — that's a
   different design decision and a different PR.
6. **No barrel index.ts inside sub-folders** until the folder has ≥4 files.
   Explicit named imports are easier to navigate.
7. **No new abstractions.** This refactor is about file size only. If you
   notice a bug while extracting, file it as a follow-up; don't fix it in
   the extraction PR.

## Why this layout

- Matches the existing `components/ProjectHub/` convention in this repo.
- Smaller import-path churn than moving to `src/features/<page>/`.
- Each extraction PR stays mechanical and revertible.

See `.plans/split-monolithic-frontend-*.md` for the full extraction plan
and per-PR scope.
