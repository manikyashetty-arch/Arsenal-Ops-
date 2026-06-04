/**
 * Pure capability-grant logic for the Roles editor.
 *
 * This was inline in AdminDashboard.tsx as a mix of pure predicates and
 * `setRoleForm`-wrapping closures. Extracted here as pure functions
 * (grants in → grants out) so the wildcard/auto-promote rules can be unit
 * tested directly and reused. The component keeps `roleForm` state and wraps
 * the `apply*` helpers in `setRoleForm`.
 */
import { PROJECT_TABS } from '@/lib/projectTabs';
import type { Capability } from '../types';

/** A pickable capability surface. Optional sub-rows render indented under the
 *  parent; when the parent's grant (typically a wildcard) is active, children
 *  render as covered + disabled. */
export interface PickerItem {
  label: string;
  grant: string;
  description: string;
  children?: { label: string; grant: string; description: string }[];
}

export interface PickerGroup {
  prefix: 'project' | 'admin';
  label: string;
  wildcard: string;
  items: PickerItem[];
}

/** Minimal shape the toggle/checked helpers need from a catalog node. Recursive
 *  because `isItemEffectivelyChecked` walks children depth-first; real catalogs
 *  are only 2 levels deep, but the type allows arbitrary nesting honestly. */
export type CatalogNode = { grant: string; children?: readonly CatalogNode[] };

/** Loose shape of a project-tab entry that `buildPickerCatalog` reads. Real
 *  `ProjectTabSpec` is wider (id/icon/capabilities) and assignable to this;
 *  tests can pass a minimal fake without constructing a full tab spec. */
export interface ProjectTabLike {
  label: string;
  picker: {
    grant: string;
    description: string;
    children?: readonly { label: string; grant: string; description: string }[];
  };
}

/** Convert a snake_case role/key to PascalCase for display. */
export function toPascalCase(str: string): string {
  return str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/** Does wildcard `grant` cover `key`? (`*` covers all; `x.*` covers `x` and `x.…`) */
export function wildcardCovers(grant: string, key: string): boolean {
  if (grant === '*') return true;
  if (!grant.endsWith('.*')) return false;
  const prefix = grant.slice(0, -2);
  return key === prefix || key.startsWith(prefix + '.');
}

/** Does `key` fall under the scope of `grant` (exact, wildcard, or `*`)? */
export function keyIsUnderGrant(key: string, grant: string): boolean {
  if (grant === '*') return true;
  if (grant.endsWith('.*')) {
    const prefix = grant.slice(0, -2);
    return key === prefix || key.startsWith(prefix + '.');
  }
  return key === grant;
}

/** Strict "is this exact grant or a wildcard ancestor in the grant set?"
 *  Sibling sub-caps and descendants do NOT count. This is the LEAF check —
 *  for nodes with children use `isItemEffectivelyChecked`. */
export function isItemChecked(grant: string, grants: string[]): boolean {
  if (grants.includes('*')) return true;
  if (grants.includes(grant)) return true;
  for (const g of grants) {
    if (!g.endsWith('.*')) continue;
    const prefix = g.slice(0, -2);
    // Covered when grant equals the wildcard's prefix or is a descendant —
    // e.g. grant='project.pm.*' is covered by g='project.*'.
    if (grant === prefix || grant.startsWith(prefix + '.')) return true;
  }
  return false;
}

/** Recursive "effectively checked" for any catalog node: directly granted /
 *  wildcard-covered, OR (has children AND every child is effectively checked). */
export function isItemEffectivelyChecked(node: CatalogNode, grants: string[]): boolean {
  if (isItemChecked(node.grant, grants)) return true;
  if (!node.children || node.children.length === 0) return false;
  return node.children.every((c) => isItemEffectivelyChecked(c, grants));
}

/** Toggle a single leaf grant. When unchecking a key that's only covered by a
 *  wildcard, the wildcard is expanded into its explicit sub-caps (minus the
 *  unchecked key) so the rest stay granted. Returns the next grant set. */
export function applyToggleGrant(grants: string[], key: string, registry: Capability[]): string[] {
  if (grants.includes(key)) {
    return grants.filter((g) => g !== key);
  }
  const coveringWildcards = grants.filter((g) => wildcardCovers(g, key));
  if (coveringWildcards.length > 0) {
    const nonCovering = grants.filter((g) => !coveringWildcards.includes(g));
    const expanded = new Set<string>(nonCovering);
    for (const cap of registry) {
      if (cap.key === key) continue;
      if (coveringWildcards.some((w) => keyIsUnderGrant(cap.key, w))) {
        expanded.add(cap.key);
      }
    }
    return Array.from(expanded);
  }
  return [...grants, key];
}

/** Toggle a catalog node (leaf, parent-with-children, or group wildcard) using
 *  the EFFECTIVE checked state. Uncheck removes the exact grant and, for
 *  wildcards, sweeps every explicit sub-cap underneath. Check adds the grant
 *  and, for wildcards, drops now-redundant explicit sub-caps. Returns the next
 *  grant set. */
export function applyToggleCatalogItem(grants: string[], node: CatalogNode): string[] {
  const { grant } = node;
  const checked = isItemEffectivelyChecked(node, grants);
  if (checked) {
    let isUnderRemoved: (g: string) => boolean;
    if (grant.endsWith('.*')) {
      const prefix = grant.slice(0, -2);
      isUnderRemoved = (g) => g === grant || g === prefix || g.startsWith(prefix + '.');
    } else {
      isUnderRemoved = (g) => g === grant;
    }
    return grants.filter((g) => !isUnderRemoved(g));
  }
  let cleaned: string[];
  if (grant.endsWith('.*')) {
    const prefix = grant.slice(0, -2);
    cleaned = grants.filter((g) => g !== prefix && !g.startsWith(prefix + '.'));
  } else {
    cleaned = grants.slice();
  }
  return [...cleaned, grant];
}

/**
 * Display catalog for the Roles role-editor picker.
 *
 * PROJECT items are derived from the single project-tab registry
 * (`lib/projectTabs.ts`) so adding a tab there automatically surfaces it in the
 * role editor with the right label, description, grant key, and sub-rows. The
 * two write-side entries and the ADMIN group are hand-curated since those
 * surfaces don't share the tab abstraction. Cap keys live outside the read
 * groups' wildcards on purpose (`project.tracker_write` is a sibling of
 * `project.tracker`, not nested) so granting read doesn't auto-grant write.
 *
 * Accepts `projectTabs` as a parameter (defaulting to the real registry) so the
 * builder can be tested without coupling to the live tab list.
 */
export function buildPickerCatalog(
  projectTabs: readonly ProjectTabLike[] = PROJECT_TABS,
): PickerGroup[] {
  return [
    {
      prefix: 'project',
      label: 'Project',
      wildcard: 'project.*',
      items: [
        ...projectTabs.map((tab) => ({
          label: tab.label,
          grant: tab.picker.grant,
          description: tab.picker.description,
          children: tab.picker.children ? [...tab.picker.children] : undefined,
        })),
        {
          label: 'Manage items & sprints',
          grant: 'project.tracker_write',
          description: 'Create, edit, and delete work items and sprints',
        },
        {
          label: 'AI Generators',
          grant: 'project.ai.write',
          description: 'Run PRD analyzer and roadmap parser (write)',
        },
        {
          label: 'Create new projects',
          grant: 'project.create',
          description: 'Create new projects from the home page (write)',
        },
        {
          label: 'Assign personal tasks to project',
          grant: 'project.assign_personal_task',
          description: 'Convert a personal task into a project ticket (write)',
        },
      ],
    },
    {
      prefix: 'admin',
      label: 'Admin',
      wildcard: 'admin.*',
      items: [
        { label: 'Dashboard', grant: 'admin.dashboard', description: 'Admin dashboard summary' },
        { label: 'Employees', grant: 'admin.employees', description: 'Manage employees' },
        { label: 'Projects', grant: 'admin.projects', description: 'Manage projects from admin' },
        { label: 'Users', grant: 'admin.users', description: 'Manage users and role assignments' },
        { label: 'Roles', grant: 'admin.roles', description: 'Manage roles and capability grants' },
      ],
    },
  ];
}
