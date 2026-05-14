import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  X,
  BookOpen,
  ClipboardList,
  Bug,
  Target,
  ExternalLink,
  Edit2,
  Calendar,
  Clock,
  MessageSquare,
  AlertCircle,
  Inbox,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from '@/components/ui/calendar';
import TicketContributors from '@/components/TicketContributors';

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
  is_personal?: boolean;
}

interface ProjectDeveloper {
  id: number;
  name: string;
  email: string;
  role: string;
  responsibilities?: string;
  is_admin: boolean;
}

interface Developer {
  id: number;
  name: string;
  email: string;
  github_username?: string;
  avatar_url?: string;
}

type Comment = {
  id: number;
  work_item_id: number;
  author_id: number;
  author_name: string;
  content: string;
  comment_type: 'comment' | 'blocker' | 'business_review';
  mentions: number[];
  created_at: string;
};

interface TaskDetailPanelProps {
  selectedTask: MyTask;
  isEditingTask: boolean;
  editingTaskForm: Partial<MyTask>;
  setEditingTaskForm: React.Dispatch<React.SetStateAction<Partial<MyTask>>>;
  editTaskProjectDevelopers: ProjectDeveloper[];
  showCalendarMyTask: boolean;
  setShowCalendarMyTask: React.Dispatch<React.SetStateAction<boolean>>;
  displayComments: Comment[];
  allDevelopers: Developer[];
  newComment: string;
  showMentions: boolean;
  mentionFilter: string;
  taskSprints: { id: number; name: string; start_date: string | null; end_date: string | null }[];
  setSelectedTask: React.Dispatch<React.SetStateAction<MyTask | null>>;
  setIsEditingTask: React.Dispatch<React.SetStateAction<boolean>>;
  startEditTask: () => void;
  cancelEditTask: () => void;
  saveEditedTask: () => void;
  handleLogHours: (task: MyTask, hoursToLog: number) => void;
  handleStatusChange: (task: MyTask, newStatus: string) => void;
  handleMoveTaskToSprint: (itemId: string, targetSprintId: number | null) => void;
  getNextTaskSprint: (currentSprintId: number | null | undefined) => number | null;
  handleCommentChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmitComment: (commentType?: 'comment' | 'blocker' | 'business_review') => void;
  insertMention: (developer: { id: number; name: string }) => void;
  renderTextWithNewlines: (text: string) => React.ReactNode;
  renderCommentContent: (content: string, mentions?: number[]) => React.ReactNode;
}

const TASK_TYPE_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; label: string; bg: string }
> = {
  user_story: { icon: BookOpen, color: '#E0B954', label: 'Story', bg: 'rgba(224,185,84,0.15)' },
  task: { icon: ClipboardList, color: '#F59E0B', label: 'Task', bg: 'rgba(245,158,11,0.15)' },
  bug: { icon: Bug, color: '#EF4444', label: 'Bug', bg: 'rgba(239,68,68,0.15)' },
  epic: { icon: Target, color: '#A78BFA', label: 'Epic', bg: 'rgba(167,139,250,0.15)' },
};

const STATUS_CONFIG = {
  backlog: { label: 'Backlog', color: '#737373', icon: Inbox },
  todo: { label: 'To Do', color: '#E0B954', icon: Plus },
  in_progress: { label: 'In Progress', color: '#F59E0B', icon: Clock },
  in_review: { label: 'In Review', color: '#C79E3B', icon: AlertCircle },
  done: { label: 'Done', color: '#E0B954', icon: CheckCircle2 },
} as const;

export default function TaskDetailPanel({
  selectedTask,
  isEditingTask,
  editingTaskForm,
  setEditingTaskForm,
  editTaskProjectDevelopers,
  showCalendarMyTask,
  setShowCalendarMyTask,
  displayComments,
  allDevelopers,
  newComment,
  showMentions,
  mentionFilter,
  taskSprints,
  setSelectedTask,
  setIsEditingTask,
  startEditTask,
  cancelEditTask,
  saveEditedTask,
  handleLogHours,
  handleStatusChange,
  handleMoveTaskToSprint,
  getNextTaskSprint,
  handleCommentChange,
  handleSubmitComment,
  insertMention,
  renderTextWithNewlines,
  renderCommentContent,
}: TaskDetailPanelProps) {
  const navigate = useNavigate();

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={() => {
          setSelectedTask(null);
          setIsEditingTask(false);
        }}
      />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-[#080808] border-l border-[rgba(255,255,255,0.07)] z-50 flex flex-col shadow-2xl shadow-black/50">
        {/* Panel Header */}
        <div className="flex items-start justify-between p-5 border-b border-[rgba(255,255,255,0.05)] sticky top-0 bg-[#080808] flex-shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {(() => {
              const tc = TASK_TYPE_CONFIG[selectedTask.type] || TASK_TYPE_CONFIG.task;
              return (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium flex-shrink-0"
                  style={{ backgroundColor: tc.bg, color: tc.color }}
                >
                  <tc.icon className="w-4 h-4" />
                  {tc.label}
                </div>
              );
            })()}
            <span className="text-xs font-mono text-[#E0B954] flex-shrink-0">
              {selectedTask.key}
            </span>
            {/* <button
                                onClick={() => { navigate(`/project/${selectedTask.project_id}`); setSelectedTask(null); }}
                                className="flex items-center gap-1 text-xs text-[#737373] hover:text-white ml-auto flex-shrink-0"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Open in project
                            </button> */}
          </div>
          <button
            onClick={() => {
              setSelectedTask(null);
              setIsEditingTask(false);
            }}
            className="p-1.5 rounded-lg hover:bg-[rgba(244,246,255,0.05)] text-[#737373] hover:text-white ml-3 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Panel Content (scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isEditingTask ? (
            // Edit Mode - Comprehensive form matching ProjectBoard
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#737373] block mb-1.5">Title</label>
                <Input
                  value={editingTaskForm.title}
                  onChange={(e) =>
                    setEditingTaskForm({ ...editingTaskForm, title: e.target.value })
                  }
                  className="bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#737373] block mb-1.5">
                  Description
                </label>
                <Textarea
                  value={editingTaskForm.description}
                  onChange={(e) =>
                    setEditingTaskForm({ ...editingTaskForm, description: e.target.value })
                  }
                  className="bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl min-h-[120px] resize-none whitespace-pre-wrap"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#737373] block mb-1.5">
                    Type
                  </label>
                  <select
                    value={editingTaskForm.type}
                    onChange={(e) =>
                      setEditingTaskForm({ ...editingTaskForm, type: e.target.value })
                    }
                    className="w-full h-10 bg-[rgba(255,255,255,0.025)] border border-[rgba(255,255,255,0.07)] text-[#f5f5f5] rounded-xl px-3 text-sm"
                  >
                    <option value="user_story">Story</option>
                    <option value="task">Task</option>
                    <option value="bug">Bug</option>
                    <option value="epic">Epic</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#737373] block mb-1.5">
                    Priority
                  </label>
                  <select
                    value={editingTaskForm.priority}
                    onChange={(e) =>
                      setEditingTaskForm({ ...editingTaskForm, priority: e.target.value })
                    }
                    className="w-full h-10 bg-[rgba(255,255,255,0.025)] border border-[rgba(255,255,255,0.07)] text-[#f5f5f5] rounded-xl px-3 text-sm"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#737373] block mb-1.5">
                    Story Points
                  </label>
                  <Input
                    type="number"
                    value={editingTaskForm.story_points || 0}
                    onChange={(e) =>
                      setEditingTaskForm({
                        ...editingTaskForm,
                        story_points: parseInt(e.target.value) || 0,
                      })
                    }
                    className="bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#737373] block mb-1.5">
                    Allocated Hours
                  </label>
                  <Input
                    type="number"
                    value={editingTaskForm.assigned_hours || 0}
                    onChange={(e) =>
                      setEditingTaskForm({
                        ...editingTaskForm,
                        assigned_hours: parseInt(e.target.value) || 0,
                      })
                    }
                    className="bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#737373] block mb-1.5">
                    Logged Hours
                  </label>
                  <Input
                    type="number"
                    value={editingTaskForm.logged_hours || 0}
                    onChange={(e) =>
                      setEditingTaskForm({
                        ...editingTaskForm,
                        logged_hours: parseInt(e.target.value) || 0,
                      })
                    }
                    className="bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#737373] block mb-1.5">
                    Remaining Hours
                  </label>
                  <Input
                    type="number"
                    value={editingTaskForm.remaining_hours || 0}
                    onChange={(e) =>
                      setEditingTaskForm({
                        ...editingTaskForm,
                        remaining_hours: parseInt(e.target.value) || 0,
                      })
                    }
                    className="bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[#737373] block mb-1.5">
                  Assignee
                </label>
                <select
                  value={editingTaskForm.assignee_id || ''}
                  onChange={(e) =>
                    setEditingTaskForm({
                      ...editingTaskForm,
                      assignee_id: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  className="w-full h-10 bg-[rgba(255,255,255,0.025)] border border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl px-3 text-sm"
                >
                  <option value="">Unassigned</option>
                  {editTaskProjectDevelopers.map((dev) => (
                    <option key={dev.id} value={dev.id}>
                      {dev.name} ({dev.role})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#737373] block mb-1.5">
                  Status
                </label>
                <select
                  value={editingTaskForm.status}
                  onChange={(e) =>
                    setEditingTaskForm({ ...editingTaskForm, status: e.target.value })
                  }
                  className="w-full h-10 bg-[rgba(255,255,255,0.025)] border border-[rgba(255,255,255,0.07)] text-[#f5f5f5] rounded-xl px-3 text-sm"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#737373] block mb-1.5">
                    Due Date
                  </label>
                  <Popover open={showCalendarMyTask} onOpenChange={setShowCalendarMyTask}>
                    <PopoverTrigger asChild>
                      <Button className="w-full justify-start text-left font-normal bg-[rgba(255,255,255,0.025)] border border-[rgba(255,255,255,0.07)] text-[#F4F6FF] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F4F6FF] rounded-xl h-10">
                        <Calendar className="w-4 h-4 mr-2" />
                        {editingTaskForm.due_date
                          ? parseLocalDate(editingTaskForm.due_date)?.toLocaleDateString(
                              'en-US',
                              { month: 'short', day: 'numeric', year: 'numeric' },
                            )
                          : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 bg-[#0d0d0d] border-[rgba(255,255,255,0.07)]"
                      align="start"
                    >
                      <CalendarIcon
                        mode="single"
                        selected={parseLocalDate(
                          editingTaskForm.due_date === null
                            ? undefined
                            : editingTaskForm.due_date,
                        )}
                        onSelect={(date) => {
                          if (date) {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            setEditingTaskForm({
                              ...editingTaskForm,
                              due_date: `${year}-${month}-${day}`,
                            });
                            setShowCalendarMyTask(false);
                          }
                        }}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        classNames={{
                          months: 'flex flex-col',
                          month: 'space-y-4',
                          caption:
                            'flex justify-between items-center px-0 pb-4 relative h-7 mb-2',
                          caption_label: 'text-sm font-medium text-white',
                          nav: 'space-x-1 flex items-center',
                          nav_button: 'text-white hover:bg-[rgba(224,185,84,0.1)] rounded p-1',
                          nav_button_previous: 'absolute left-0',
                          nav_button_next: 'absolute right-0',
                          table: 'w-full border-collapse space-y-1',
                          head_row: 'flex',
                          head_cell:
                            'text-xs font-medium text-[#737373] w-8 h-8 flex items-center justify-center rounded',
                          row: 'flex w-full gap-1',
                          cell: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-transparent',
                          day: 'h-8 w-8 p-0 font-normal',
                          day_button:
                            'text-white hover:bg-[rgba(224,185,84,0.1)] rounded-lg h-8 w-8 transition-colors',
                          day_selected:
                            'bg-[#E0B954] text-[#0d0d0d] hover:bg-[#E0B954] font-semibold',
                          day_today: 'bg-[rgba(224,185,84,0.2)] text-[#E0B954] font-semibold',
                          day_outside: 'text-[#444]',
                          day_disabled: 'text-[#333] opacity-50 cursor-not-allowed',
                          day_range_middle:
                            'aria-selected:bg-[rgba(224,185,84,0.1)] aria-selected:text-white',
                          day_hidden: 'invisible',
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={saveEditedTask}
                  className="flex-1 bg-gradient-to-r from-[#E0B954] to-[#B8872A] text-white rounded-xl h-10 font-medium"
                >
                  Save Changes
                </Button>
                <Button
                  onClick={cancelEditTask}
                  variant="outline"
                  className="flex-1 bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#a3a3a3] hover:text-white rounded-xl h-10"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            // View Mode
            <>
              <div>
                <h2 className="text-xl font-bold text-white mb-3">{selectedTask.title}</h2>
                <p className="text-sm text-[#a3a3a3] leading-relaxed whitespace-pre-wrap">
                  {renderTextWithNewlines(selectedTask.description || '') ||
                    'No description provided.'}
                </p>
              </div>

              {/* Detail Stats */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: 'Story Points',
                    value: String(selectedTask.story_points || 0),
                    color: '#E0B954',
                  },
                  {
                    label: 'Allocated Hours',
                    value: `${selectedTask.assigned_hours || 0}h`,
                    color: '#E0B954',
                  },
                  {
                    label: 'Logged Hours',
                    value: `${selectedTask.logged_hours || 0}h`,
                    color: '#E0B954',
                  },
                  {
                    label: 'Remaining Hours',
                    value: `${selectedTask.remaining_hours || 0}h`,
                    color: '#F59E0B',
                  },
                  {
                    label: 'Due Date',
                    value: selectedTask.due_date
                      ? (parseLocalDate(
                          selectedTask.due_date as string,
                        )?.toLocaleDateString() ?? 'Not set')
                      : 'Not set',
                    color: selectedTask.due_date ? '#E0B954' : '#737373',
                  },
                  {
                    label: 'Status',
                    value: (
                      STATUS_CONFIG[selectedTask.status as keyof typeof STATUS_CONFIG] ||
                      STATUS_CONFIG.todo
                    ).label,
                    color: (
                      STATUS_CONFIG[selectedTask.status as keyof typeof STATUS_CONFIG] ||
                      STATUS_CONFIG.todo
                    ).color,
                  },
                  {
                    label: 'Priority',
                    value:
                      selectedTask.priority?.charAt(0).toUpperCase() +
                      (selectedTask.priority?.slice(1) || ''),
                    color:
                      selectedTask.priority === 'critical'
                        ? '#EF4444'
                        : selectedTask.priority === 'high'
                          ? '#F97316'
                          : selectedTask.priority === 'medium'
                            ? '#F59E0B'
                            : '#737373',
                  },
                ].map((d) => (
                  <div
                    key={d.label}
                    className="bg-[rgba(255,255,255,0.025)] border border-[rgba(255,255,255,0.05)] rounded-xl p-3.5"
                  >
                    <div className="text-[10px] text-[#737373] font-medium uppercase tracking-wider mb-1">
                      {d.label}
                    </div>
                    <div className="text-lg font-bold" style={{ color: d.color }}>
                      {d.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Metadata */}
              <div className="space-y-3">
                {[
                  { label: 'Assignee', value: selectedTask.assignee || 'Unassigned' },
                  { label: 'Sprint', value: selectedTask.sprint || 'Not assigned' },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.03)]"
                  >
                    <span className="text-xs text-[#737373]">{m.label}</span>
                    <span className="text-sm text-[#f5f5f5]">{m.value}</span>
                  </div>
                ))}
              </div>

              {/* Hierarchy breadcrumb */}
              {(selectedTask.epic_key || selectedTask.parent_key) && (
                <div>
                  <div className="text-xs text-[#737373] mb-2 font-medium">Hierarchy</div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {selectedTask.epic_key && selectedTask.epic_id && (
                      <a
                        href={`/project/${selectedTask.project_id}/board/${selectedTask.epic_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-[rgba(167,139,250,0.12)] text-[#A78BFA] text-xs hover:bg-[rgba(167,139,250,0.2)] transition-colors cursor-pointer"
                      >
                        Epic: {selectedTask.epic_key}
                      </a>
                    )}
                    {selectedTask.epic_key && selectedTask.parent_key && (
                      <span className="text-[#555] text-xs">›</span>
                    )}
                    {selectedTask.parent_key && selectedTask.parent_id && (
                      <a
                        href={`/project/${selectedTask.project_id}/board/${selectedTask.parent_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-[rgba(224,185,84,0.10)] text-[#E0B954] text-xs hover:bg-[rgba(224,185,84,0.2)] transition-colors cursor-pointer"
                      >
                        Parent: {selectedTask.parent_key}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Tags */}
              {selectedTask.tags && selectedTask.tags.length > 0 && (
                <div>
                  <div className="text-xs text-[#737373] mb-2 font-medium">Tags</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedTask.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-lg bg-[rgba(255,255,255,0.05)] text-[#a3a3a3] text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Log Hours Section */}
              <div className="pt-4 border-t border-[rgba(255,255,255,0.05)]">
                <div className="text-xs text-[#737373] mb-3 font-medium">Log Work Hours</div>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    placeholder="Hours"
                    min="0"
                    className="w-24 h-9 bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl"
                    id="log-hours-input"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      const input = document.getElementById(
                        'log-hours-input',
                      ) as HTMLInputElement;
                      const hours = parseInt(input?.value || '0');
                      if (hours > 0 && selectedTask) {
                        handleLogHours(selectedTask, hours);
                        input.value = '';
                      }
                    }}
                    className="bg-[#E0B954] hover:bg-[#C79E3B] text-white rounded-xl h-9"
                  >
                    <Clock className="w-3.5 h-3.5 mr-1.5" />
                    Log Hours
                  </Button>
                </div>
                <p className="text-[10px] text-[#737373] mt-2">
                  Current: {selectedTask.logged_hours || 0}h logged ·{' '}
                  {selectedTask.remaining_hours || 0}h remaining
                </p>
              </div>

              {/* Contributors (only renders when 2+ people have logged hours) */}
              <TicketContributors
                workItemId={selectedTask.id}
                token={localStorage.getItem('token') || ''}
              />

              {/* Status Buttons - Move to */}
              <div className="pt-4 border-t border-[rgba(255,255,255,0.05)]">
                <div className="text-xs text-[#737373] mb-3 font-medium">Move to</div>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map(
                    (status) => (
                      <Button
                        key={status}
                        size="sm"
                        onClick={() => handleStatusChange(selectedTask, status)}
                        className={`rounded-lg text-xs h-9 transition-all ${
                          selectedTask.status === status
                            ? 'text-white shadow-lg'
                            : 'bg-transparent border border-[rgba(255,255,255,0.07)] text-[#737373] hover:text-white hover:border-[rgba(244,246,255,0.15)]'
                        }`}
                        style={
                          selectedTask.status === status
                            ? {
                                backgroundColor: STATUS_CONFIG[status].color,
                                boxShadow: `0 4px 12px ${STATUS_CONFIG[status].color}33`,
                              }
                            : {}
                        }
                      >
                        {STATUS_CONFIG[status].label}
                      </Button>
                    ),
                  )}
                </div>
              </div>

              {/* Sprint Actions (mirrors ProjectBoard) */}
              {taskSprints.length > 0 && (
                <div className="pt-4 border-t border-[rgba(255,255,255,0.05)]">
                  <div className="text-xs text-[#737373] mb-3 font-medium">Sprint Actions</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedTask.sprint_id &&
                      getNextTaskSprint(selectedTask.sprint_id) &&
                      selectedTask.status !== 'done' && (
                        <Button
                          size="sm"
                          onClick={() =>
                            handleMoveTaskToSprint(
                              selectedTask.id,
                              getNextTaskSprint(selectedTask.sprint_id),
                            )
                          }
                          className="rounded-lg text-xs h-9 bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.3)] text-[#F59E0B] hover:bg-[rgba(245,158,11,0.2)]"
                        >
                          <ArrowRight className="w-3 h-3 mr-1" />
                          Push to Next Sprint
                        </Button>
                      )}
                    {selectedTask.sprint_id && (
                      <Button
                        size="sm"
                        onClick={() => handleMoveTaskToSprint(selectedTask.id, null)}
                        className="rounded-lg text-xs h-9 bg-transparent border border-[rgba(255,255,255,0.07)] text-[#737373] hover:text-white hover:border-[rgba(244,246,255,0.15)]"
                      >
                        <Inbox className="w-3 h-3 mr-1" />
                        Move to Backlog
                      </Button>
                    )}
                    {!selectedTask.sprint_id && (
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleMoveTaskToSprint(selectedTask.id, parseInt(e.target.value));
                            e.target.value = '';
                          }
                        }}
                        className="h-9 text-xs bg-[rgba(255,255,255,0.025)] border border-[rgba(255,255,255,0.07)] text-[#a3a3a3] rounded-lg px-3 appearance-none cursor-pointer hover:border-[rgba(244,246,255,0.15)]"
                        defaultValue=""
                      >
                        <option value="">Add to Sprint...</option>
                        {taskSprints.map((sprint) => (
                          <option key={sprint.id} value={sprint.id}>
                            {sprint.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}

              {/* Comments Section */}
              <div className="pt-4 border-t border-[rgba(255,255,255,0.05)]">
                <div className="text-xs text-[#737373] mb-3 font-medium">
                  Activity & Comments
                </div>

                {/* Comment Input */}
                <div className="relative mb-4">
                  <Textarea
                    value={newComment}
                    onChange={handleCommentChange}
                    placeholder="Add a comment... Use @ to mention someone"
                    className="bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl min-h-[80px] placeholder:text-[#334155] resize-none pr-20"
                  />
                  {/* @Mentions Dropdown */}
                  {showMentions && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-[#1A1D26] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                      {allDevelopers
                        .filter((d) =>
                          d.name.toLowerCase().includes(mentionFilter.toLowerCase()),
                        )
                        .slice(0, 5)
                        .map((dev) => (
                          <button
                            key={dev.id}
                            onClick={() => insertMention(dev)}
                            className="w-full px-3 py-2 text-left text-sm text-[#f5f5f5] hover:bg-[rgba(224,185,84,0.1)] flex items-center gap-2"
                          >
                            <div className="w-6 h-6 rounded-full bg-[rgba(224,185,84,0.2)] flex items-center justify-center text-xs text-[#E0B954]">
                              {dev.name.charAt(0).toUpperCase()}
                            </div>
                            <span>{dev.name}</span>
                            <span className="text-[#737373] text-xs ml-auto">{dev.email}</span>
                          </button>
                        ))}
                      {allDevelopers.filter((d) =>
                        d.name.toLowerCase().includes(mentionFilter.toLowerCase()),
                      ).length === 0 && (
                        <div className="px-3 py-2 text-sm text-[#737373]">
                          No matching developers
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => handleSubmitComment('comment')}
                      disabled={!newComment.trim()}
                      className="bg-[rgba(224,185,84,0.1)] border border-[rgba(224,185,84,0.3)] text-[#E0B954] hover:bg-[rgba(224,185,84,0.2)] rounded-lg text-xs h-8"
                    >
                      <MessageSquare className="w-3 h-3 mr-1" />
                      Comment
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSubmitComment('blocker')}
                      disabled={!newComment.trim()}
                      className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[#EF4444] hover:bg-[rgba(239,68,68,0.2)] rounded-lg text-xs h-8"
                    >
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Report Blocker
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSubmitComment('business_review')}
                      disabled={!newComment.trim()}
                      className="bg-[rgba(167,139,250,0.1)] border border-[rgba(167,139,250,0.3)] text-[#A78BFA] hover:bg-[rgba(167,139,250,0.2)] rounded-lg text-xs h-8"
                    >
                      <Target className="w-3 h-3 mr-1" />
                      Business Review
                    </Button>
                  </div>
                </div>

                {/* Comments List */}
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {displayComments.length === 0 ? (
                    <div className="text-center py-6 text-[#737373] text-sm">
                      No comments yet. Be the first to comment!
                    </div>
                  ) : (
                    displayComments.map((comment) => (
                      <div
                        key={comment.id}
                        className={`p-3 rounded-xl ${
                          comment.comment_type === 'blocker'
                            ? 'bg-[rgba(239,68,68,0.05)] border border-[rgba(239,68,68,0.2)]'
                            : comment.comment_type === 'business_review'
                              ? 'bg-[rgba(167,139,250,0.05)] border border-[rgba(167,139,250,0.2)]'
                              : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                              comment.comment_type === 'blocker'
                                ? 'bg-[rgba(239,68,68,0.2)] text-[#EF4444]'
                                : comment.comment_type === 'business_review'
                                  ? 'bg-[rgba(167,139,250,0.2)] text-[#A78BFA]'
                                  : 'bg-[rgba(224,185,84,0.2)] text-[#E0B954]'
                            }`}
                          >
                            {comment.author_name?.charAt?.(0)?.toUpperCase() || '?'}
                          </div>
                          <span className="text-sm font-medium text-[#f5f5f5]">
                            {comment.author_name}
                          </span>
                          {comment.comment_type === 'blocker' && (
                            <span className="px-1.5 py-0.5 rounded-md bg-[rgba(239,68,68,0.2)] text-[#EF4444] text-[10px] font-medium">
                              BLOCKER
                            </span>
                          )}
                          {comment.comment_type === 'business_review' && (
                            <span className="px-1.5 py-0.5 rounded-md bg-[rgba(167,139,250,0.2)] text-[#A78BFA] text-[10px] font-medium">
                              BUSINESS REVIEW
                            </span>
                          )}
                          <span className="text-xs text-[#737373] ml-auto">
                            {new Date(comment.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-[#a3a3a3] leading-relaxed">
                          {renderCommentContent(comment.content, comment.mentions)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 border-t border-[rgba(255,255,255,0.05)] flex gap-3">
          <button
            onClick={() => startEditTask()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-white font-semibold text-sm hover:bg-[rgba(255,255,255,0.08)] transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={() => {
              navigate(`/project/${selectedTask.project_id}/board/${selectedTask.id}`);
              setSelectedTask(null);
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-[#E0B954] to-[#C79E3B] text-[#080808] font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <ExternalLink className="w-4 h-4" />
            Open ticket
          </button>
        </div>
      </div>
    </>
  );
}
