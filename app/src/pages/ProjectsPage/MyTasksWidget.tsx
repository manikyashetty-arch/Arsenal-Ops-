import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  CheckCircle2,
  Lock,
  AlertCircle,
  Edit2,
  Calendar,
  Circle,
  Flag,
  X,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from '@/components/ui/calendar';
import { toast } from 'sonner';

// Helper function to parse YYYY-MM-DD string to local Date object (avoids UTC timezone issues)
const parseLocalDate = (dateString: string | undefined): Date | undefined => {
  if (!dateString) return undefined;
  const [year, month, day] = dateString.split('-');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
};

interface MyTask {
  id: string;
  key: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  project_id: number;
  project_name: string;
  due_date: string | null;
  estimated_hours: number | null;
  logged_hours: number | null;
  remaining_hours: number | null;
  is_overdue: boolean;
  story_points?: number;
  assigned_hours?: number;
  assignee?: string;
  assignee_id?: number | null;
  description?: string;
  tags?: string[];
  acceptance_criteria?: string[];
  parent_id?: number | null;
  epic_id?: number | null;
  sprint_id?: number | null;
  sprint?: string;
  parent_key?: string | null;
  epic_key?: string | null;
  /** True for rows synthesized from personal tasks merged into the upcoming/overdue/completed lists. */
  is_personal?: boolean;
}

interface PersonalTask {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  estimated_hours: number;
  due_date?: string;
  tags: string[];
  is_converted: boolean;
  project_id?: number;
  work_item_id?: number;
}

interface MyTasksWidgetProps {
  /** Raw project work-items assigned to the current user */
  myTasks: MyTask[];
  myTasksLoading: boolean;
  /** Unconverted personal tasks as returned by the API */
  personalTasks: PersonalTask[];
  /** Personal tasks coerced into MyTask shape (is_personal=true) */
  personalAsMyTasks: (MyTask & { is_personal?: boolean })[];
  /** Current user object (used for avatar initial) */
  user: { name: string; id: number } | null;
  /** Open the task detail slide-in panel */
  setSelectedTask: React.Dispatch<React.SetStateAction<MyTask | null>>;
  /** Open the Add Personal Task dialog */
  setShowAddTaskDialog: React.Dispatch<React.SetStateAction<boolean>>;
  /** Toggle a personal task between done / pending */
  togglePersonalTaskComplete: (task: PersonalTask) => void;
  /** Open the edit-personal-task dialog pre-populated */
  startEditPersonalTask: (task: PersonalTask) => void;
  /** Delete a personal task (shows confirmation) */
  deletePersonalTask: (taskId: number) => void;
  /** Set the task that the convert-to-ticket dialog will act on */
  setConvertingTask: React.Dispatch<React.SetStateAction<PersonalTask | null>>;
  /** Open/close the convert-to-ticket dialog */
  setShowConvertDialog: React.Dispatch<React.SetStateAction<boolean>>;
  /** Optimistic status change for project work-items */
  handleStatusChange: (task: MyTask, newStatus: string) => void;
  /** Optimistic due-date change (handles both personal and project items) */
  handleQuickDueDateChange: (task: MyTask & { is_personal?: boolean }, isoDate: string) => void;
}

export default function MyTasksWidget({
  myTasks,
  myTasksLoading,
  personalTasks,
  personalAsMyTasks,
  user,
  setSelectedTask,
  setShowAddTaskDialog,
  togglePersonalTaskComplete,
  startEditPersonalTask,
  deletePersonalTask,
  setConvertingTask,
  setShowConvertDialog,
  handleStatusChange,
  handleQuickDueDateChange,
}: MyTasksWidgetProps) {
  const navigate = useNavigate();

  // Local UI state — moves with the widget per CONVENTIONS rule 3
  const [myTaskTab, setMyTaskTab] = useState<'upcoming' | 'overdue' | 'completed' | 'personal'>(
    'upcoming',
  );
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [openDateRowId, setOpenDateRowId] = useState<string | null>(null);

  // Derived lists (depend on myTaskTab — lives here)
  const filteredMyTasks: (MyTask & { is_personal?: boolean })[] = (() => {
    if (myTaskTab === 'upcoming') {
      const projectUpcoming = myTasks.filter((t) => t.status !== 'done' && !t.is_overdue);
      const personalUpcoming = personalAsMyTasks.filter(
        (t) => t.status !== 'done' && !t.is_overdue,
      );
      return [...projectUpcoming, ...personalUpcoming];
    }
    if (myTaskTab === 'overdue') {
      // Exclude done tasks — clicking the done-circle should make them disappear
      const projectOverdue = myTasks.filter((t) => t.is_overdue && t.status !== 'done');
      const personalOverdue = personalAsMyTasks.filter((t) => t.is_overdue && t.status !== 'done');
      return [...projectOverdue, ...personalOverdue];
    }
    if (myTaskTab === 'completed') {
      const projectDone = myTasks.filter((t) => t.status === 'done');
      const personalDone = personalAsMyTasks.filter((t) => t.status === 'done');
      return [...projectDone, ...personalDone];
    }
    // 'personal' tab still rendered separately below — this branch is unused
    return myTasks.filter((t) => t.status === 'done');
  })();

  const getSortedTasks = (tasks: MyTask[]) => {
    if (myTaskTab === 'upcoming') {
      return [...tasks].sort((a, b) => {
        // Tasks with due dates come first, sorted chronologically
        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        // Tasks with due dates before tasks without
        if (a.due_date && !b.due_date) return -1;
        if (!a.due_date && b.due_date) return 1;
        // Both without due dates - maintain original order
        return 0;
      });
    }
    return tasks;
  };

  return (
    <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-2xl flex flex-col h-[460px]">
      <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#E0B954] to-[#C79E3B] flex items-center justify-center text-[#080808] text-sm font-bold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">My tasks</h2>
            <Lock className="w-3.5 h-3.5 text-[#737373]" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-[#737373] flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#E0B954]" />
            <span>{myTasks.filter((t) => t.status === 'done').length} completed</span>
          </div>
          <button
            onClick={() => setShowAddTaskDialog(true)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-r from-[#E0B954] to-[#C79E3B] hover:opacity-90 text-[#080808] transition-opacity"
            title="Add personal task"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-0 px-5 border-b border-[rgba(255,255,255,0.05)] flex-shrink-0">
        {(['upcoming', 'overdue', 'completed', 'personal'] as const).map((tab) => {
          const count =
            tab === 'upcoming'
              ? myTasks.filter((t) => t.status !== 'done' && !t.is_overdue).length +
                personalAsMyTasks.filter((t) => t.status !== 'done' && !t.is_overdue).length
              : tab === 'overdue'
                ? myTasks.filter((t) => t.is_overdue && t.status !== 'done').length +
                  personalAsMyTasks.filter((t) => t.is_overdue && t.status !== 'done').length
                : tab === 'personal'
                  ? personalTasks.filter((t) => !t.is_converted && t.status !== 'done').length
                  : myTasks.filter((t) => t.status === 'done').length +
                    personalAsMyTasks.filter((t) => t.status === 'done').length;
          return (
            <button
              key={tab}
              onClick={() => {
                setMyTaskTab(tab);
                setShowAllTasks(false);
              }}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                myTaskTab === tab
                  ? 'border-[#E0B954] text-white'
                  : 'border-transparent text-[#737373] hover:text-[#a3a3a3]'
              }`}
            >
              {tab === 'overdue' && count > 0 ? (
                <span className="flex items-center gap-1.5">
                  Overdue
                  <span className="bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded-full">
                    {count}
                  </span>
                </span>
              ) : tab === 'personal' ? (
                <span className="flex items-center gap-1.5">
                  Personal
                  {count > 0 && (
                    <span className="bg-[#E0B954]/20 text-[#E0B954] text-xs px-1.5 py-0.5 rounded-full">
                      {count}
                    </span>
                  )}
                </span>
              ) : (
                <span className="capitalize">{tab}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-0.5">
        {myTaskTab === 'personal' ? (
          // Personal tasks tab
          personalTasks.filter((t) => !t.is_converted).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="w-8 h-8 text-[#E0B954]/30 mb-2" />
              <p className="text-sm text-[#737373]">No personal tasks yet</p>
              <button
                onClick={() => setShowAddTaskDialog(true)}
                className="mt-3 text-xs text-[#E0B954] hover:text-[#C79E3B] flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add your first task
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {personalTasks
                .filter((t) => !t.is_converted)
                .sort((a, b) => {
                  // Completed tasks always last
                  if (a.status === 'done' && b.status !== 'done') return 1;
                  if (a.status !== 'done' && b.status === 'done') return -1;
                  // Sort by priority
                  const priorityOrder: Record<string, number> = {
                    critical: 0,
                    high: 1,
                    medium: 2,
                    low: 3,
                  };
                  const aPriority =
                    priorityOrder[a.priority?.toLowerCase() || 'medium'] ?? 999;
                  const bPriority =
                    priorityOrder[b.priority?.toLowerCase() || 'medium'] ?? 999;
                  return aPriority - bPriority;
                })
                .slice(0, 5)
                .map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[rgba(255,255,255,0.03)] transition-colors group ${
                      task.status === 'done' ? 'opacity-60' : ''
                    }`}
                  >
                    <button
                      onClick={() => togglePersonalTaskComplete(task)}
                      className="flex-shrink-0 text-[#737373] hover:text-[#E0B954] transition-colors"
                      title={task.status === 'done' ? 'Mark as pending' : 'Mark as complete'}
                    >
                      {task.status === 'done' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>
                    <span
                      className={`flex-1 text-sm truncate ${
                        task.status === 'done'
                          ? 'line-through text-[#737373]'
                          : 'text-[#f5f5f5]'
                      }`}
                    >
                      {task.title}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={{
                        borderColor:
                          (['critical', 'high', 'medium', 'low'].includes(task.priority)
                            ? task.priority === 'critical'
                              ? '#EF4444'
                              : task.priority === 'high'
                                ? '#F97316'
                                : task.priority === 'medium'
                                  ? '#F59E0B'
                                  : '#737373'
                            : '#737373') + '40',
                        color:
                          task.priority === 'critical'
                            ? '#EF4444'
                            : task.priority === 'high'
                              ? '#F97316'
                              : task.priority === 'medium'
                                ? '#F59E0B'
                                : '#737373',
                        backgroundColor:
                          (task.priority === 'critical'
                            ? '#EF4444'
                            : task.priority === 'high'
                              ? '#F97316'
                              : task.priority === 'medium'
                                ? '#F59E0B'
                                : '#737373') + '15',
                      }}
                    >
                      <Flag className="w-3 h-3 mr-1" />
                      {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                    </Badge>
                    {/* Inline calendar — same component used in upcoming/overdue/completed.
                                        Builds a synthetic MyTask wrapper so handleQuickDueDateChange can
                                        route the PUT to /api/personal-tasks/{id}. */}
                    <Popover
                      open={openDateRowId === `personal-${task.id}`}
                      onOpenChange={(o) => setOpenDateRowId(o ? `personal-${task.id}` : null)}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          title={
                            task.due_date
                              ? `Due ${parseLocalDate(task.due_date)?.toLocaleDateString()} — click to change`
                              : 'Set due date'
                          }
                          className={`flex items-center gap-1.5 text-xs flex-shrink-0 px-2 py-1 rounded-md border transition-all ${
                            task.due_date
                              ? 'border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] text-[#a3a3a3] hover:border-[#E0B954]/40 hover:text-[#E0B954]'
                              : 'border-transparent text-[#555] hover:border-[#E0B954]/30 hover:bg-[#E0B954]/5 hover:text-[#E0B954]'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {task.due_date
                              ? parseLocalDate(task.due_date)?.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : 'Set date'}
                          </span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto p-0 bg-[#0d0d0d] border-[rgba(255,255,255,0.07)] shadow-2xl rounded-xl overflow-hidden"
                        align="end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)]">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-[#E0B954]" />
                            <div className="text-xs font-semibold text-white">Due date</div>
                          </div>
                          <div className="text-[11px] text-[#737373] mt-0.5 truncate max-w-[280px]">
                            {task.title}
                          </div>
                        </div>
                        <div className="p-2">
                          {(() => {
                            // Build the synthetic MyTask wrapper once so the handler
                            // can route the PUT to the personal-tasks endpoint.
                            const fakeTask = {
                              id: `personal-${task.id}`,
                              title: task.title,
                              status: task.status,
                              due_date: task.due_date || null,
                              is_personal: true,
                            } as unknown as MyTask & { is_personal?: boolean };
                            return (
                              <CalendarIcon
                                mode="single"
                                selected={parseLocalDate(task.due_date || undefined)}
                                onSelect={(date) => {
                                  if (date) {
                                    const y = date.getFullYear();
                                    const m = String(date.getMonth() + 1).padStart(2, '0');
                                    const d = String(date.getDate()).padStart(2, '0');
                                    handleQuickDueDateChange(fakeTask, `${y}-${m}-${d}`);
                                    setOpenDateRowId(null);
                                  }
                                }}
                                classNames={{
                                  months: 'flex flex-col',
                                  month: 'space-y-3',
                                  caption:
                                    'flex justify-between items-center px-0 pb-3 relative h-7 mb-2',
                                  caption_label: 'text-sm font-semibold text-white',
                                  nav: 'space-x-1 flex items-center',
                                  nav_button:
                                    'text-[#a3a3a3] hover:text-[#E0B954] hover:bg-[rgba(224,185,84,0.1)] rounded-md p-1 transition-colors',
                                  nav_button_previous: 'absolute left-0',
                                  nav_button_next: 'absolute right-0',
                                  table: 'w-full border-collapse',
                                  head_row: 'flex',
                                  head_cell:
                                    'text-[10px] uppercase tracking-wider font-semibold text-[#737373] w-9 h-7 flex items-center justify-center',
                                  row: 'flex w-full gap-0.5 mt-1',
                                  cell: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
                                  day: 'h-9 w-9 p-0 font-normal',
                                  day_button:
                                    'text-white hover:bg-[rgba(224,185,84,0.15)] hover:text-[#E0B954] rounded-lg h-9 w-9 transition-all',
                                  day_selected:
                                    'bg-gradient-to-br from-[#E0B954] to-[#C79E3B] text-[#0d0d0d] hover:from-[#E0B954] hover:to-[#C79E3B] hover:text-[#0d0d0d] font-bold shadow-lg shadow-[#E0B954]/30',
                                  day_today:
                                    'ring-1 ring-[#E0B954]/40 text-[#E0B954] font-semibold',
                                  day_outside: 'text-[#3a3a3a]',
                                  day_disabled:
                                    'text-[#2a2a2a] opacity-40 cursor-not-allowed',
                                  day_hidden: 'invisible',
                                }}
                              />
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 border-t border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)]">
                          {(['Today', 'Tomorrow', 'Next week'] as const).map((label) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => {
                                const d = new Date();
                                if (label === 'Tomorrow') d.setDate(d.getDate() + 1);
                                if (label === 'Next week') d.setDate(d.getDate() + 7);
                                const y = d.getFullYear();
                                const m = String(d.getMonth() + 1).padStart(2, '0');
                                const day = String(d.getDate()).padStart(2, '0');
                                const fakeTask = {
                                  id: `personal-${task.id}`,
                                  title: task.title,
                                  status: task.status,
                                  due_date: task.due_date || null,
                                  is_personal: true,
                                } as unknown as MyTask & { is_personal?: boolean };
                                handleQuickDueDateChange(fakeTask, `${y}-${m}-${day}`);
                                setOpenDateRowId(null);
                              }}
                              className="flex-1 text-[11px] py-1.5 rounded-md bg-[rgba(255,255,255,0.04)] text-[#a3a3a3] hover:bg-[#E0B954]/15 hover:text-[#E0B954] transition-colors font-medium"
                            >
                              {label}
                            </button>
                          ))}
                          {task.due_date && (
                            <button
                              type="button"
                              onClick={() => {
                                const fakeTask = {
                                  id: `personal-${task.id}`,
                                  title: task.title,
                                  status: task.status,
                                  due_date: task.due_date || null,
                                  is_personal: true,
                                } as unknown as MyTask & { is_personal?: boolean };
                                handleQuickDueDateChange(fakeTask, '');
                                setOpenDateRowId(null);
                              }}
                              title="Clear due date"
                              className="px-2 py-1.5 rounded-md text-[11px] text-[#737373] hover:bg-red-500/15 hover:text-red-400 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <button
                      onClick={() => startEditPersonalTask(task)}
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-[#E0B954] hover:text-[#C79E3B] flex-shrink-0 transition-opacity"
                      title="Edit task"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setConvertingTask(task);
                        setShowConvertDialog(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-[#E0B954] hover:text-[#C79E3B] flex-shrink-0 transition-opacity"
                      title="Convert to project ticket"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      Tag to project
                    </button>
                    <button
                      onClick={() => deletePersonalTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-[#737373] hover:text-red-400 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              {personalTasks.filter((t) => !t.is_converted).length > 5 && (
                <button
                  onClick={() => navigate('/personal-tasks')}
                  className="w-full text-center text-xs text-[#737373] hover:text-[#E0B954] py-2.5 transition-colors"
                >
                  View all ({personalTasks.filter((t) => !t.is_converted).length - 5} more) →
                </button>
              )}
            </div>
          )
        ) : myTasksLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-[#E0B954]/30 border-t-[#E0B954] rounded-full animate-spin" />
          </div>
        ) : filteredMyTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <CheckCircle2 className="w-8 h-8 text-[#E0B954]/30 mb-2" />
            <p className="text-sm text-[#737373]">
              {myTaskTab === 'completed'
                ? 'No completed tasks yet'
                : myTaskTab === 'overdue'
                  ? 'No overdue tasks 🎉'
                  : 'No upcoming tasks'}
            </p>
          </div>
        ) : (
          (showAllTasks
            ? getSortedTasks(filteredMyTasks)
            : getSortedTasks(filteredMyTasks).slice(0, 6)
          ).map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[rgba(255,255,255,0.03)] transition-colors cursor-pointer group"
              onClick={() => {
                if (task.is_personal) {
                  // Personal tasks live in a separate table — open the personal tasks page to edit
                  navigate('/personal-tasks');
                } else {
                  setSelectedTask(task);
                }
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (task.is_personal) {
                    // Toggle the underlying personal task (find the real PersonalTask
                    // by stripping the "personal-" prefix from the synthetic id).
                    const realId = String(task.id).replace(/^personal-/, '');
                    const original = personalTasks.find((p) => String(p.id) === realId);
                    if (original) togglePersonalTaskComplete(original);
                    return;
                  }
                  // Project work item — toggle between done and todo so the same
                  // click can re-open a finished task from the Completed tab.
                  const nextStatus = task.status === 'done' ? 'todo' : 'done';
                  handleStatusChange(task, nextStatus);
                  toast.success(
                    `"${task.title}" ${nextStatus === 'done' ? 'marked as done' : 'reopened'}`,
                  );
                }}
                title={task.status === 'done' ? 'Reopen task' : 'Mark as done'}
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  task.status === 'done'
                    ? 'border-[#E0B954] bg-[#E0B954] hover:bg-transparent'
                    : task.is_overdue
                      ? 'border-red-400 hover:bg-red-400/20'
                      : 'border-[#444] group-hover:border-[#E0B954]/50 hover:bg-[#E0B954]/10'
                }`}
              >
                {task.status === 'done' && (
                  <CheckCircle2 className="w-3 h-3 text-[#080808]" />
                )}
              </button>
              <span
                className={`flex-1 text-sm truncate ${
                  task.status === 'done' ? 'line-through text-[#555]' : 'text-[#f5f5f5]'
                }`}
              >
                {task.title}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-md truncate max-w-[110px] flex-shrink-0 ${
                  task.is_personal
                    ? 'bg-[rgba(167,139,250,0.12)] text-[#A78BFA]'
                    : 'bg-[rgba(224,185,84,0.08)] text-[#C79E3B]'
                }`}
              >
                {task.is_personal ? 'Personal' : task.project_name}
              </span>
              {task.is_overdue && (
                <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              )}
              {/* Inline calendar popover — set or change the due date right from the row.
                                        Works on every tab (upcoming / overdue / completed / personal). Clicking
                                        an existing date re-opens the picker so it can be changed or cleared. */}
              <Popover
                open={openDateRowId === String(task.id)}
                onOpenChange={(o) => setOpenDateRowId(o ? String(task.id) : null)}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    title={
                      task.due_date
                        ? `Due ${parseLocalDate(task.due_date)?.toLocaleDateString()} — click to change`
                        : 'Set due date'
                    }
                    className={`flex items-center gap-1.5 text-xs flex-shrink-0 px-2 py-1 rounded-md border transition-all ${
                      task.is_overdue
                        ? 'border-red-400/30 bg-red-400/5 text-red-400 hover:border-red-400/50 hover:bg-red-400/10'
                        : task.due_date
                          ? 'border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] text-[#a3a3a3] hover:border-[#E0B954]/40 hover:text-[#E0B954]'
                          : 'border-transparent text-[#555] hover:border-[#E0B954]/30 hover:bg-[#E0B954]/5 hover:text-[#E0B954]'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {task.due_date
                        ? parseLocalDate(task.due_date)?.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Set date'}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 bg-[#0d0d0d] border-[rgba(255,255,255,0.07)] shadow-2xl rounded-xl overflow-hidden"
                  align="end"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)]">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-[#E0B954]" />
                      <div className="text-xs font-semibold text-white">Due date</div>
                    </div>
                    <div className="text-[11px] text-[#737373] mt-0.5 truncate max-w-[280px]">
                      {task.title}
                    </div>
                  </div>
                  <div className="p-2">
                    <CalendarIcon
                      mode="single"
                      selected={parseLocalDate(task.due_date || undefined)}
                      onSelect={(date) => {
                        if (date) {
                          const y = date.getFullYear();
                          const m = String(date.getMonth() + 1).padStart(2, '0');
                          const d = String(date.getDate()).padStart(2, '0');
                          handleQuickDueDateChange(task, `${y}-${m}-${d}`);
                          setOpenDateRowId(null);
                        }
                      }}
                      classNames={{
                        months: 'flex flex-col',
                        month: 'space-y-3',
                        caption:
                          'flex justify-between items-center px-0 pb-3 relative h-7 mb-2',
                        caption_label: 'text-sm font-semibold text-white',
                        nav: 'space-x-1 flex items-center',
                        nav_button:
                          'text-[#a3a3a3] hover:text-[#E0B954] hover:bg-[rgba(224,185,84,0.1)] rounded-md p-1 transition-colors',
                        nav_button_previous: 'absolute left-0',
                        nav_button_next: 'absolute right-0',
                        table: 'w-full border-collapse',
                        head_row: 'flex',
                        head_cell:
                          'text-[10px] uppercase tracking-wider font-semibold text-[#737373] w-9 h-7 flex items-center justify-center',
                        row: 'flex w-full gap-0.5 mt-1',
                        cell: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
                        day: 'h-9 w-9 p-0 font-normal',
                        day_button:
                          'text-white hover:bg-[rgba(224,185,84,0.15)] hover:text-[#E0B954] rounded-lg h-9 w-9 transition-all',
                        day_selected:
                          'bg-gradient-to-br from-[#E0B954] to-[#C79E3B] text-[#0d0d0d] hover:from-[#E0B954] hover:to-[#C79E3B] hover:text-[#0d0d0d] font-bold shadow-lg shadow-[#E0B954]/30',
                        day_today: 'ring-1 ring-[#E0B954]/40 text-[#E0B954] font-semibold',
                        day_outside: 'text-[#3a3a3a]',
                        day_disabled: 'text-[#2a2a2a] opacity-40 cursor-not-allowed',
                        day_hidden: 'invisible',
                      }}
                    />
                  </div>
                  {/* Footer — quick actions */}
                  <div className="flex items-center gap-2 px-3 py-2 border-t border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)]">
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date();
                        const y = today.getFullYear();
                        const m = String(today.getMonth() + 1).padStart(2, '0');
                        const d = String(today.getDate()).padStart(2, '0');
                        handleQuickDueDateChange(task, `${y}-${m}-${d}`);
                        setOpenDateRowId(null);
                      }}
                      className="flex-1 text-[11px] py-1.5 rounded-md bg-[rgba(255,255,255,0.04)] text-[#a3a3a3] hover:bg-[#E0B954]/15 hover:text-[#E0B954] transition-colors font-medium"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const tom = new Date();
                        tom.setDate(tom.getDate() + 1);
                        const y = tom.getFullYear();
                        const m = String(tom.getMonth() + 1).padStart(2, '0');
                        const d = String(tom.getDate()).padStart(2, '0');
                        handleQuickDueDateChange(task, `${y}-${m}-${d}`);
                        setOpenDateRowId(null);
                      }}
                      className="flex-1 text-[11px] py-1.5 rounded-md bg-[rgba(255,255,255,0.04)] text-[#a3a3a3] hover:bg-[#E0B954]/15 hover:text-[#E0B954] transition-colors font-medium"
                    >
                      Tomorrow
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const wk = new Date();
                        wk.setDate(wk.getDate() + 7);
                        const y = wk.getFullYear();
                        const m = String(wk.getMonth() + 1).padStart(2, '0');
                        const d = String(wk.getDate()).padStart(2, '0');
                        handleQuickDueDateChange(task, `${y}-${m}-${d}`);
                        setOpenDateRowId(null);
                      }}
                      className="flex-1 text-[11px] py-1.5 rounded-md bg-[rgba(255,255,255,0.04)] text-[#a3a3a3] hover:bg-[#E0B954]/15 hover:text-[#E0B954] transition-colors font-medium"
                    >
                      Next week
                    </button>
                    {task.due_date && (
                      <button
                        type="button"
                        onClick={() => {
                          handleQuickDueDateChange(task, '');
                          setOpenDateRowId(null);
                        }}
                        title="Clear due date"
                        className="px-2 py-1.5 rounded-md text-[11px] text-[#737373] hover:bg-red-500/15 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          ))
        )}
        {filteredMyTasks.length > 6 && myTaskTab != 'personal' && (
          <button
            onClick={() => setShowAllTasks((p) => !p)}
            className="w-full text-center text-xs text-[#737373] hover:text-[#E0B954] py-2.5 transition-colors"
          >
            {showAllTasks ? 'Show less' : `Show ${filteredMyTasks.length - 6} more`}
          </button>
        )}
      </div>
    </div>
  );
}
