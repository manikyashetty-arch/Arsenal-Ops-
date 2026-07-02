import type { MyTask, PersonalTask } from '../types';

export const priorityColor = (priority: string): string => {
  if (priority === 'critical') return '#EF4444';
  if (priority === 'high') return '#F97316';
  if (priority === 'medium') return '#F59E0B';
  return '#737373';
};

// Deterministic per-project accent for the small color dot on a task row.
// Keyed on project_id so the same project always gets the same swatch.
const PROJECT_DOT_PALETTE = [
  '#E0B954',
  '#5896DE',
  '#9C82E0',
  '#40BE86',
  '#E8743C',
  '#EC4899',
  '#22D3EE',
  '#F5A623',
];
export const projectDotColor = (projectId: number | null | undefined): string => {
  const idx = Math.abs(projectId ?? 0) % PROJECT_DOT_PALETTE.length;
  return PROJECT_DOT_PALETTE[idx] ?? '#8A8A8A';
};

// "Focus" = what needs you first: overdue OR due today, excluding done.
export const isDueToday = (dueDate: string | null | undefined): boolean => {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};
export const isFocusTask = (task: MyTask): boolean =>
  task.status !== 'done' && (task.is_overdue || isDueToday(task.due_date));

export const sortPersonalTasks = (a: PersonalTask, b: PersonalTask) => {
  if (a.status === 'done' && b.status !== 'done') return 1;
  if (a.status !== 'done' && b.status === 'done') return -1;
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const aPriority = priorityOrder[a.priority?.toLowerCase() || 'medium'] ?? 999;
  const bPriority = priorityOrder[b.priority?.toLowerCase() || 'medium'] ?? 999;
  return aPriority - bPriority;
};

export const sortUpcomingTasks = (tasks: MyTask[]) => {
  return [...tasks].sort((a, b) => {
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    return 0;
  });
};

/**
 * Completed tab: latest-completed first. Falls back to 0 when
 * `completed_at` is missing (legacy rows that pre-date the column), which
 * sorts them at the bottom — better than letting them disrupt the
 * timeline of newer rows.
 */
export const sortCompletedTasks = (tasks: MyTask[]) => {
  return [...tasks].sort((a, b) => {
    const aT = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const bT = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    return bT - aT;
  });
};

export type MyTaskTab = 'focus' | 'upcoming' | 'overdue' | 'completed' | 'personal';
