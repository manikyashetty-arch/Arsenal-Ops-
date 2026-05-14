import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import {
  Plus,
  FolderKanban,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Search,
  X,
  Layers,
  TrendingUp,
  Zap,
  User,
  Trash2,
  Settings,
  LogOut,
  Lock,
  BookOpen,
  Loader2,
  Calendar,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from '@/components/ui/calendar';
import { toast, Toaster } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import MyTasksWidget from './MyTasksWidget';

// Helper function to parse YYYY-MM-DD string to local Date object (avoids UTC timezone issues)
const parseLocalDate = (dateString: string | undefined): Date | undefined => {
  if (!dateString) return undefined;
  const [year, month, day] = dateString.split('-');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
};

interface ProjectStats {
  total: number;
  by_status: Record<string, number>;
  total_points: number;
  completed: number;
  completion_pct: number;
}

interface Developer {
  id: number;
  name: string;
  email: string;
  github_username?: string;
  avatar_url?: string;
}

interface ProjectDeveloper {
  id: number;
  name: string;
  email: string;
  role: string;
  responsibilities?: string;
  is_admin: boolean;
}

interface Project {
  id: number;
  name: string;
  description: string;
  key_prefix: string;
  status: string;
  github_repo_url?: string;
  github_repo_urls?: string[];
  github_repo_name?: string;
  created_at: string;
  work_item_stats: ProjectStats;
  developers: ProjectDeveloper[];
}

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
  // Enriched fields
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

const TaskDetailPanel = React.lazy(() => import('./TaskDetailPanel'));

const ProjectsPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    github_repo_url: '',
  });
  // Developer management
  const [selectedDevelopers, setSelectedDevelopers] = useState<
    { developer_id: number; role: string; responsibilities: string }[]
  >([]);
  const [selectedDeveloperId, setSelectedDeveloperId] = useState<string>('');
  const [newRole, setNewRole] = useState('');
  const [newResponsibilities, setNewResponsibilities] = useState('');

  // My Tasks
  const [showAllDueSoon, setShowAllDueSoon] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MyTask | null>(null);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editingTaskForm, setEditingTaskForm] = useState<Partial<MyTask>>({
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo',
    due_date: '',
    type: 'task',
    story_points: 0,
    assigned_hours: 0,
    logged_hours: 0,
    remaining_hours: 0,
  });
  const [editTaskProjectDevelopers, setEditTaskProjectDevelopers] = useState<ProjectDeveloper[]>(
    [],
  );
  const [showCalendarMyTask, setShowCalendarMyTask] = useState(false);

  // Personal Tasks
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
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [showCalendarAddTask, setShowCalendarAddTask] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertingTask, setConvertingTask] = useState<PersonalTask | null>(null);
  const [convertProjectId, setConvertProjectId] = useState('');
  const [convertAssigneeId, setConvertAssigneeId] = useState('');
  const [convertEstimatedHours, setConvertEstimatedHours] = useState('');
  // memberLookupProjectId drives the ['project', id] query for the convert dialog and add-task dialog
  const [memberLookupProjectId, setMemberLookupProjectId] = useState<string>('');
  const [newPersonalTask, setNewPersonalTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    project_id: '',
    assignee_developer_id: '',
    estimated_hours: '',
  });
  const [isEditingPersonalTask, setIsEditingPersonalTask] = useState(false);
  const [editingPersonalTask, setEditingPersonalTask] = useState<PersonalTask | null>(null);
  const [showCalendarEditPersonalTask, setShowCalendarEditPersonalTask] = useState(false);
  const [editPersonalTaskForm, setEditPersonalTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
  });

  // Comments system for tasks/tickets
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
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const commentCache = useRef<Map<string, Comment[]>>(new Map());

  // Private Notepad
  const [notepadContent, setNotepadContent] = useState('');
  const [notepadSaved, setNotepadSaved] = useState(true);

  // (box layout — no active tab needed)

  // ── react-query: projects list ────────────────────────────────────────────
  const projectsQuery = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/api/projects/'),
  });
  const projects = projectsQuery.data ?? [];
  const isLoading = projectsQuery.isLoading;

  // ── react-query: developers (available for project-create modal) ──────────
  const developersQuery = useQuery<Developer[]>({
    queryKey: ['developers'],
    queryFn: () => apiFetch<Developer[]>('/api/developers/'),
    enabled: showCreateModal,
  });
  const availableDevelopers = developersQuery.data ?? [];
  // also used for @mention autocomplete — share same query key
  const allDevelopers = developersQuery.data ?? [];

  // ── react-query: personal tasks ───────────────────────────────────────────
  const personalTasksQuery = useQuery<PersonalTask[]>({
    queryKey: ['personalTasks'],
    queryFn: () => apiFetch<PersonalTask[]>('/api/personal-tasks/'),
  });
  const personalTasks = personalTasksQuery.data ?? [];

  // ── react-query: project members (drives convert + add-task dialogs) ──────
  const projectMembersQuery = useQuery<{
    developers?: { id: number; name: string; email: string }[];
  }>({
    queryKey: ['project', memberLookupProjectId],
    queryFn: () =>
      apiFetch<{ developers?: { id: number; name: string; email: string }[] }>(
        `/api/projects/${memberLookupProjectId}`,
      ),
    enabled: !!memberLookupProjectId,
  });
  const projectMembers = projectMembersQuery.data?.developers ?? [];

  // ── react-query: my tasks ─────────────────────────────────────────────────
  const myTasksQuery = useQuery<MyTask[]>({
    queryKey: ['myTasks'],
    queryFn: () => apiFetch<MyTask[]>('/api/workitems/my-tasks'),
  });
  const myTasksLoading = myTasksQuery.isLoading;

  // ── react-query: sprints for selected task's project ─────────────────────
  const sprintProjectId = selectedTask?.project_id ?? null;
  const sprintsQuery = useQuery<
    { id: number; name: string; start_date: string | null; end_date: string | null }[]
  >({
    queryKey: ['sprints', sprintProjectId],
    queryFn: () => apiFetch(`/api/workitems/projects/${sprintProjectId}/sprints`),
    enabled: !!sprintProjectId,
  });
  const taskSprints = sprintsQuery.data ?? [];

  const myTasks = myTasksQuery.data ?? [];

  // Apply an optimistic update directly inside the ['myTasks'] cache.
  // This is the canonical react-query pattern — the cache IS the source
  // of truth, so callers do not need a parallel local state.
  const patchMyTasksCache = (updater: (old: MyTask[]) => MyTask[]) =>
    queryClient.setQueryData<MyTask[]>(['myTasks'], (old) => updater(old ?? []));

  // ── mutations: personal tasks ─────────────────────────────────────────────
  const invalidatePersonalTasks = () =>
    queryClient.invalidateQueries({ queryKey: ['personalTasks'] });

  // Toggle personal task (optimistic)
  const togglePersonalTaskMutation = useMutation({
    mutationFn: async (task: PersonalTask) => {
      const newStatus = task.status === 'done' ? 'todo' : 'done';
      await apiFetch(`/api/personal-tasks/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      return newStatus;
    },
    onMutate: async (task: PersonalTask) => {
      await queryClient.cancelQueries({ queryKey: ['personalTasks'] });
      const previous = queryClient.getQueryData<PersonalTask[]>(['personalTasks']);
      const newStatus = task.status === 'done' ? 'todo' : 'done';
      queryClient.setQueryData<PersonalTask[]>(['personalTasks'], (old) =>
        (old ?? []).map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)),
      );
      return { previous, newStatus };
    },
    onError: (_err, _task, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['personalTasks'], ctx.previous);
      toast.error('Failed to update task');
    },
    onSuccess: (newStatus) => {
      toast.success(newStatus === 'done' ? 'Task completed! 🎉' : 'Task reopened');
    },
    onSettled: () => invalidatePersonalTasks(),
  });

  const createPersonalTaskMutation = useMutation({
    mutationFn: async () => {
      // Step 1: Create the personal task
      const createdTask = await apiFetch<PersonalTask>('/api/personal-tasks/', {
        method: 'POST',
        body: JSON.stringify({
          title: newPersonalTask.title,
          description: newPersonalTask.description,
          priority: newPersonalTask.priority,
          due_date: newPersonalTask.due_date || undefined,
          estimated_hours: newPersonalTask.estimated_hours
            ? parseInt(newPersonalTask.estimated_hours)
            : 0,
        }),
      });
      // Step 2: If project is selected, convert to ticket
      if (newPersonalTask.project_id) {
        await apiFetch(`/api/personal-tasks/${createdTask.id}/convert-to-ticket`, {
          method: 'POST',
          body: JSON.stringify({
            project_id: parseInt(newPersonalTask.project_id),
            assignee_developer_id: newPersonalTask.assignee_developer_id
              ? parseInt(newPersonalTask.assignee_developer_id)
              : undefined,
          }),
        });
      }
      return createdTask;
    },
    onSuccess: () => {
      toast.success('Task created!');
      setShowAddTaskDialog(false);
      setNewPersonalTask({
        title: '',
        description: '',
        priority: 'medium',
        due_date: '',
        project_id: '',
        assignee_developer_id: '',
        estimated_hours: '',
      });
      setMemberLookupProjectId('');
      invalidatePersonalTasks();
    },
    onError: () => toast.error('Failed to create task'),
  });

  const convertToTicketMutation = useMutation({
    mutationFn: async () => {
      if (!convertingTask) throw new Error('No task selected');
      return apiFetch<{ work_item: { key: string; assignee_name?: string } }>(
        `/api/personal-tasks/${convertingTask.id}/convert-to-ticket`,
        {
          method: 'POST',
          body: JSON.stringify({
            project_id: parseInt(convertProjectId),
            type: 'task',
            estimated_hours: convertEstimatedHours
              ? parseInt(convertEstimatedHours)
              : convertingTask.estimated_hours,
            assignee_developer_id: convertAssigneeId ? parseInt(convertAssigneeId) : undefined,
          }),
        },
      );
    },
    onSuccess: (data) => {
      const assigneeName = data.work_item.assignee_name
        ? ` → assigned to ${data.work_item.assignee_name}`
        : '';
      toast.success(`Ticket ${data.work_item.key} created!${assigneeName}`);
      setShowConvertDialog(false);
      setConvertingTask(null);
      setConvertProjectId('');
      setConvertAssigneeId('');
      setConvertEstimatedHours('');
      setMemberLookupProjectId('');
      invalidatePersonalTasks();
    },
    onError: () => toast.error('Failed to convert'),
  });

  const deletePersonalTaskMutation = useMutation({
    mutationFn: (taskId: number) =>
      apiFetch<void>(`/api/personal-tasks/${taskId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Task deleted');
      invalidatePersonalTasks();
    },
    onError: () => toast.error('Failed to delete task'),
  });

  const updatePersonalTaskMutation = useMutation({
    mutationFn: (taskId: number) =>
      apiFetch<PersonalTask>(`/api/personal-tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: editPersonalTaskForm.title,
          description: editPersonalTaskForm.description,
          priority: editPersonalTaskForm.priority,
          due_date: editPersonalTaskForm.due_date || null,
        }),
      }),
    onSuccess: () => {
      toast.success('Task updated successfully');
      setIsEditingPersonalTask(false);
      setEditingPersonalTask(null);
      setEditPersonalTaskForm({ title: '', description: '', priority: 'medium', due_date: '' });
      invalidatePersonalTasks();
    },
    onError: () => toast.error('Failed to update task'),
  });

  // Wrapper functions (keep call sites in JSX unchanged)
  const togglePersonalTaskComplete = (task: PersonalTask) => {
    if (task.is_converted) {
      toast.error('Cannot modify a converted task');
      return;
    }
    togglePersonalTaskMutation.mutate(task);
  };
  const createPersonalTask = () => {
    if (!newPersonalTask.title.trim()) {
      toast.error('Title is required');
      return;
    }
    createPersonalTaskMutation.mutate();
  };
  const convertToTicket = () => {
    if (!convertingTask || !convertProjectId) return;
    convertToTicketMutation.mutate();
  };
  const deletePersonalTask = (taskId: number) => {
    if (!confirm('Delete this task?')) return;
    deletePersonalTaskMutation.mutate(taskId);
  };
  const updatePersonalTask = () => {
    if (!editingPersonalTask) return;
    if (!editPersonalTaskForm.title.trim()) {
      toast.error('Title is required');
      return;
    }
    updatePersonalTaskMutation.mutate(editingPersonalTask.id);
  };
  // isPending flags used in JSX
  const addingTask = createPersonalTaskMutation.isPending || updatePersonalTaskMutation.isPending;
  const convertingTicket = convertToTicketMutation.isPending;

  const startEditPersonalTask = (task: PersonalTask) => {
    setEditingPersonalTask(task);
    setEditPersonalTaskForm({
      title: task.title,
      description: task.description,
      priority: task.priority,
      due_date: task.due_date || '',
    });
    setIsEditingPersonalTask(true);
  };

  const cancelEditPersonalTask = () => {
    setIsEditingPersonalTask(false);
    setEditingPersonalTask(null);
    setEditPersonalTaskForm({ title: '', description: '', priority: 'medium', due_date: '' });
  };

  // ── mutations: work items ─────────────────────────────────────────────────
  const moveSprintMutation = useMutation({
    mutationFn: ({ itemId, targetSprintId }: { itemId: string; targetSprintId: number | null }) =>
      apiFetch<MyTask>(`/api/workitems/${itemId}/move-sprint`, {
        method: 'PUT',
        body: JSON.stringify({ target_sprint_id: targetSprintId }),
      }),
    onSuccess: (updated, { itemId, targetSprintId }) => {
      const merged = { ...selectedTask, ...updated } as MyTask;
      patchMyTasksCache((old) => old.map((t) => (t.id === itemId ? merged : t)));
      if (selectedTask?.id === itemId) setSelectedTask(merged);
      toast.success(targetSprintId ? 'Moved to sprint' : 'Moved to backlog');
      if (sprintProjectId)
        queryClient.invalidateQueries({ queryKey: ['sprints', sprintProjectId] });
      queryClient.invalidateQueries({ queryKey: ['workItems'] });
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
    },
    onError: () => toast.error('Failed to move ticket'),
  });

  const handleMoveTaskToSprint = (itemId: string, targetSprintId: number | null) => {
    moveSprintMutation.mutate({ itemId, targetSprintId });
  };

  const getNextTaskSprint = (currentSprintId: number | null | undefined): number | null => {
    if (!currentSprintId || taskSprints.length === 0) return null;
    const idx = taskSprints.findIndex((s) => s.id === currentSprintId);
    if (idx >= 0 && idx < taskSprints.length - 1) return taskSprints[idx + 1].id;
    return null;
  };

  // ── mutation: edit task project members (fetched on demand when edit opens) ─
  const [editTaskProjectId, setEditTaskProjectId] = useState<number | null>(null);
  const editTaskProjectQuery = useQuery<{ developers?: ProjectDeveloper[] }>({
    queryKey: ['project', editTaskProjectId],
    queryFn: () =>
      apiFetch<{ developers?: ProjectDeveloper[] }>(`/api/projects/${editTaskProjectId}`),
    enabled: !!editTaskProjectId,
  });

  // ── mutations: work-item writes ───────────────────────────────────────────
  const logHoursMutation = useMutation({
    mutationFn: ({ taskId, hours }: { taskId: string; hours: number }) =>
      apiFetch<{ logged_hours: number; remaining_hours: number }>(
        `/api/workitems/${taskId}/log-hours`,
        {
          method: 'POST',
          body: JSON.stringify({ hours }),
        },
      ),
    onSuccess: (data, { taskId }) => {
      const updated = {
        ...selectedTask,
        logged_hours: data.logged_hours,
        remaining_hours: data.remaining_hours,
      } as MyTask;
      setSelectedTask(updated);
      patchMyTasksCache((old) => old.map((t) => (t.id === taskId ? updated : t)));
      toast.success(`Logged ${data.logged_hours}h! Remaining: ${data.remaining_hours}h`);
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
      queryClient.invalidateQueries({ queryKey: ['workItems'] });
    },
    onError: () => toast.error('Failed to log hours'),
  });

  const saveEditedTaskMutation = useMutation({
    mutationFn: (taskId: string) =>
      apiFetch<MyTask>(`/api/workitems/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: editingTaskForm.title,
          description: editingTaskForm.description,
          priority: editingTaskForm.priority,
          status: editingTaskForm.status,
          due_date: editingTaskForm.due_date || null,
          type: editingTaskForm.type,
          story_points: editingTaskForm.story_points,
          assigned_hours: editingTaskForm.assigned_hours,
          logged_hours: editingTaskForm.logged_hours,
          remaining_hours: editingTaskForm.remaining_hours,
          assignee_id: editingTaskForm.assignee_id || null,
        }),
      }),
    onSuccess: (updatedTask) => {
      const mergedTask = { ...selectedTask, ...editingTaskForm, ...updatedTask } as MyTask;
      setSelectedTask(mergedTask);
      setIsEditingTask(false);
      patchMyTasksCache((old) => old.map((t) => (t.id === updatedTask.id ? mergedTask : t)));
      toast.success('Task updated successfully');
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
      queryClient.invalidateQueries({ queryKey: ['workItems'] });
    },
    onError: () => toast.error('Failed to update task'),
  });

  // Start editing selected task — now reads developers from the project query
  const startEditTask = () => {
    if (!selectedTask) return;
    setEditTaskProjectId(selectedTask.project_id);
    const developers = editTaskProjectQuery.data?.developers ?? [];
    let assigneeId: number | null = selectedTask.assignee_id || null;
    if (!assigneeId && selectedTask.assignee) {
      const matchedDev = developers.find((d) => d.name === selectedTask.assignee);
      if (matchedDev) assigneeId = matchedDev.id;
    }
    setEditTaskProjectDevelopers(developers);
    setEditingTaskForm({
      title: selectedTask.title,
      description: selectedTask.description || '',
      priority: selectedTask.priority,
      status: selectedTask.status,
      due_date: selectedTask.due_date || '',
      type: selectedTask.type || 'task',
      story_points: selectedTask.story_points || 0,
      assigned_hours: selectedTask.assigned_hours || 0,
      logged_hours: selectedTask.logged_hours || 0,
      remaining_hours: selectedTask.remaining_hours || 0,
      assignee_id: assigneeId,
    });
    setIsEditingTask(true);
  };

  // When the project query resolves (after edit opens), sync developers into form state
  const editTaskDevs = editTaskProjectQuery.data?.developers;
  if (isEditingTask && editTaskDevs && editTaskDevs !== editTaskProjectDevelopers) {
    // Use a timeout-0 to avoid setting state during render
  }

  // Log hours for a task
  const handleLogHours = (task: MyTask, hoursToLog: number) => {
    logHoursMutation.mutate({ taskId: task.id, hours: hoursToLog });
  };

  // Quick status change (optimistic)
  const handleStatusChange = (task: MyTask, newStatus: string) => {
    const updated = { ...task, status: newStatus } as MyTask;
    patchMyTasksCache((old) => old.map((t) => (t.id === task.id ? updated : t)));
    if (selectedTask?.id === task.id) setSelectedTask(updated);
    apiFetch(`/api/workitems/${task.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['workItems'] });
      })
      .catch(() => {
        toast.error('Failed to update status');
        queryClient.invalidateQueries({ queryKey: ['myTasks'] });
      });
  };

  // Quick due-date change from the inline calendar popover on each task row.
  // Pass an empty string to clear the due date. Routes to the right endpoint
  // based on whether it's a project work item or a personal task.
  const handleQuickDueDateChange = (task: MyTask & { is_personal?: boolean }, isoDate: string) => {
    const cleared = !isoDate;
    const dueValue = cleared ? null : isoDate;

    if (task.is_personal) {
      const realId = String(task.id).replace(/^personal-/, '');
      // Optimistic update to personalTasks via cache
      queryClient.setQueryData<PersonalTask[]>(['personalTasks'], (old) =>
        (old ?? []).map((p) =>
          String(p.id) === realId ? { ...p, due_date: dueValue || undefined } : p,
        ),
      );
      apiFetch(`/api/personal-tasks/${realId}`, {
        method: 'PUT',
        body: JSON.stringify({ due_date: dueValue }),
      })
        .then(() => {
          toast.success(cleared ? 'Due date cleared' : 'Due date updated');
        })
        .catch(() => {
          toast.error('Failed to update due date');
          queryClient.invalidateQueries({ queryKey: ['personalTasks'] });
        });
    } else {
      // Project work item — also recompute is_overdue locally so it moves
      // between Upcoming / Overdue tabs correctly without a refetch.
      let isOverdue = false;
      if (dueValue) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dueValue + 'T00:00:00');
        isOverdue = due < today && task.status !== 'done';
      }
      patchMyTasksCache((old) =>
        old.map((t) =>
          t.id === task.id ? { ...t, due_date: dueValue, is_overdue: isOverdue } : t,
        ),
      );
      apiFetch(`/api/workitems/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ due_date: dueValue }),
      })
        .then(() => {
          toast.success(cleared ? 'Due date cleared' : 'Due date updated');
          queryClient.invalidateQueries({ queryKey: ['workItems'] });
        })
        .catch(() => {
          toast.error('Failed to update due date');
          queryClient.invalidateQueries({ queryKey: ['myTasks'] });
        });
    }
  };

  // Render text with newlines preserved
  const renderTextWithNewlines = (text: string) => {
    if (!text) return null;
    return text
      .split('\n')
      .map((line, index) => [
        <span key={`line-${index}`}>{line}</span>,
        index < text.split('\n').length - 1 ? <br key={`br-${index}`} /> : null,
      ])
      .flat()
      .filter(Boolean);
  };

  // Handle comment input with @mention detection
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewComment(value);

    // Check for @mentions
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const textAfterAt = value.substring(lastAtIndex + 1);
      // Check if there's a space after @ (meaning mention is complete)
      if (!textAfterAt.includes(' ')) {
        setMentionFilter(textAfterAt);
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  // Insert mention
  const insertMention = (developer: { id: number; name: string }) => {
    const lastAtIndex = newComment.lastIndexOf('@');
    const beforeMention = newComment.substring(0, lastAtIndex);
    setNewComment(`${beforeMention}@${developer.name} `);
    setShowMentions(false);
    setMentionFilter('');
  };

  // Submit comment
  const handleSubmitComment = (
    commentType: 'comment' | 'blocker' | 'business_review' = 'comment',
  ) => {
    if (!selectedTask || !newComment.trim()) return;
    apiFetch<Comment>('/api/comments/', {
      method: 'POST',
      body: JSON.stringify({
        work_item_id: parseInt(selectedTask.id),
        content: newComment,
        author_id: user?.id || 1,
        comment_type: commentType,
      }),
    })
      .then((newCommentData: Comment) => {
        setComments((prev) => [newCommentData, ...prev]);
        if (selectedTask) commentCache.current.delete(selectedTask.id);
        setNewComment('');
        const messages = {
          blocker: 'Blocker reported!',
          business_review: 'Business Review comment added!',
          comment: 'Comment added!',
        };
        toast.success(messages[commentType]);
      })
      .catch(() => {
        toast.error('Failed to add comment');
      });
  };

  // Render comment with mentions highlighted and links as clickable
  const renderCommentContent = (content: string, mentions: number[] = []) => {
    // Build a map of developer IDs to names for quick lookup
    const devMap = new Map(allDevelopers.map((d) => [d.id, d.name]));

    // Replace @name with highlighted version for each mentioned developer
    let result = content;
    mentions.forEach((devId) => {
      const devName = devMap.get(devId);
      if (devName) {
        // Replace @devName with highlighted version
        const regex = new RegExp(`@${devName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
        result = result.replace(regex, `<<<MENTION_${devId}>>>`);
      }
    });

    // Also replace URLs with placeholders
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls: string[] = [];
    result = result.replace(urlRegex, (match) => {
      urls.push(match);
      return `<<<URL_${urls.length - 1}>>>`;
    });

    // Parse the result and highlight the placeholders
    const parts = result.split(/(<<<MENTION_\d+>>>|<<<URL_\d+>>>)/g);
    let elementIndex = 0;
    return parts.flatMap((part) => {
      const mentionMatch = part.match(/<<<MENTION_(\d+)>>>/);
      if (mentionMatch) {
        const devId = parseInt(mentionMatch[1]);
        const devName = devMap.get(devId);
        return (
          <span
            key={`mention-${elementIndex++}`}
            className="bg-[rgba(224,185,84,0.2)] text-[#E0B954] px-1.5 py-0.5 rounded-md font-medium"
          >
            @{devName}
          </span>
        );
      }

      const urlMatch = part.match(/<<<URL_(\d+)>>>/);
      if (urlMatch) {
        const urlIndex = parseInt(urlMatch[1]);
        const url = urls[urlIndex];
        return (
          <a
            key={`url-${elementIndex++}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#E0B954] hover:text-[#C79E3B] underline hover:no-underline transition-colors break-all"
          >
            {url}
          </a>
        );
      }

      // Handle newlines in text
      if (part.trim()) {
        return part
          .split('\n')
          .flatMap((line, lineIndex) => [
            <span key={`text-${elementIndex}-${lineIndex}`}>{line}</span>,
            lineIndex < part.split('\n').length - 1 ? (
              <br key={`br-${elementIndex}-${lineIndex}`} />
            ) : null,
          ])
          .filter(Boolean);
      }

      return part;
    });
  };

  const saveEditedTask = () => {
    if (!selectedTask) return;
    saveEditedTaskMutation.mutate(selectedTask.id);
  };

  // Cancel editing
  const cancelEditTask = () => {
    setIsEditingTask(false);
    setEditingTaskForm({
      title: '',
      description: '',
      priority: 'medium',
      status: 'todo',
      due_date: '',
      type: 'task',
      story_points: 0,
      assigned_hours: 0,
      logged_hours: 0,
      remaining_hours: 0,
    });
    setEditTaskProjectDevelopers([]);
  };

  // ── comments: fetched via useQuery, gated on selectedTask ─────────────────
  const commentsQuery = useQuery<Comment[]>({
    queryKey: ['workItem', selectedTask?.id, 'comments'],
    queryFn: async () => {
      // Use local cache first for instant feel, then use react-query's result
      const cached = commentCache.current.get(selectedTask!.id);
      if (cached !== undefined) return cached;
      const data = await apiFetch<Comment[]>(`/api/comments/workitem/${selectedTask!.id}`);
      commentCache.current.set(selectedTask!.id, data ?? []);
      return data ?? [];
    },
    enabled: !!selectedTask && !selectedTask.is_personal,
  });

  // Use query data as the source of truth for the comments list shown in JSX
  const displayComments = commentsQuery.data ?? comments;

  // Notepad: load from localStorage per user
  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`notepad_${user.id}`);
      if (saved !== null) setNotepadContent(saved);
    }
  }, [user?.id]);

  // Notepad: auto-save with debounce
  useEffect(() => {
    if (!user?.id) return;
    setNotepadSaved(false);
    const timer = setTimeout(() => {
      localStorage.setItem(`notepad_${user.id}`, notepadContent);
      setNotepadSaved(true);
    }, 800);
    return () => clearTimeout(timer);
  }, [notepadContent, user?.id]);

  // Computed chart data (used by My Overview stacked bar)
  const overviewStats = {
    total: myTasks.length,
    done: myTasks.filter((t) => t.status === 'done').length,
    in_progress: myTasks.filter((t) => t.status === 'in_progress').length,
    in_review: myTasks.filter((t) => t.status === 'in_review').length,
    todo: myTasks.filter((t) => t.status === 'todo').length,
    overdue: myTasks.filter((t) => t.is_overdue).length,
    completion_pct:
      myTasks.length > 0
        ? Math.round((myTasks.filter((t) => t.status === 'done').length / myTasks.length) * 100)
        : 0,
  };

  const STATUS_BARS = [
    { key: 'done', color: '#34D399', label: 'Done' },
    { key: 'in_progress', color: '#E0B954', label: 'In Progress' },
    { key: 'in_review', color: '#A78BFA', label: 'In Review' },
    { key: 'todo', color: '#60A5FA', label: 'To Do' },
  ] as const;

  const STATUS_COLOR: Record<string, string> = {
    todo: '#60A5FA',
    in_progress: '#E0B954',
    in_review: '#A78BFA',
    done: '#34D399',
    blocked: '#EF4444',
    backlog: '#555',
  };

  // Personal tasks coerced to MyTask shape so they render in the same list.
  // Marked with is_personal so the row click routes to /personal-tasks instead
  // of opening the project-workitem modal.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const personalAsMyTasks: (MyTask & { is_personal?: boolean })[] = personalTasks
    .filter((t) => !t.is_converted)
    .map((t) => {
      const due = t.due_date ? new Date(t.due_date) : null;
      return {
        id: `personal-${t.id}`,
        key: 'PERSONAL',
        title: t.title,
        type: 'personal',
        status: t.status,
        priority: t.priority,
        project_id: t.project_id ?? 0,
        project_name: 'Personal',
        due_date: t.due_date || null,
        estimated_hours: t.estimated_hours ?? null,
        logged_hours: null,
        remaining_hours: t.estimated_hours ?? null,
        is_overdue: due ? due < todayStart && t.status !== 'done' : false,
        description: t.description,
        tags: t.tags,
        is_personal: true,
      };
    });

  const handleAddDeveloper = () => {
    if (!selectedDeveloperId || !newRole.trim()) {
      toast.error('Please select a developer and enter a role');
      return;
    }

    const devId = parseInt(selectedDeveloperId);
    const alreadyAdded = selectedDevelopers.find((d) => d.developer_id === devId);
    if (alreadyAdded) {
      toast.error('Developer already added to this project');
      return;
    }

    const developer = availableDevelopers.find((d) => d.id === devId);

    setSelectedDevelopers((prev) => [
      ...prev,
      {
        developer_id: devId,
        role: newRole,
        responsibilities: newResponsibilities,
      },
    ]);

    toast.success(`${developer?.name} added as ${newRole}`);

    setSelectedDeveloperId('');
    setNewRole('');
    setNewResponsibilities('');
  };

  const handleRemoveDeveloper = (developerId: number) => {
    setSelectedDevelopers((prev) => prev.filter((d) => d.developer_id !== developerId));
  };

  const createProjectMutation = useMutation({
    mutationFn: () =>
      apiFetch<Project>('/api/projects/', {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name,
          description: createForm.description,
          github_repo_url: createForm.github_repo_url || undefined,
          developers: selectedDevelopers,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '', github_repo_url: '' });
      setSelectedDevelopers([]);
      toast.success('Project created successfully!');
    },
    onError: () => toast.error('Failed to create project'),
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: number) =>
      apiFetch<void>(`/api/projects/${projectId}/`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
    },
    onError: () => toast.error('Failed to delete project'),
  });

  const handleCreateProject = () => {
    if (!createForm.name.trim()) {
      toast.error('Project name is required');
      return;
    }
    createProjectMutation.mutate();
  };
  const isCreating = createProjectMutation.isPending;

  const handleDeleteProject = (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    if (!confirm('Delete this project and all its work items?')) return;
    deleteProjectMutation.mutate(projectId);
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalStats = {
    projects: projects.length,
    items: projects.reduce((sum, p) => sum + p.work_item_stats.total, 0),
    completed: projects.reduce((sum, p) => sum + p.work_item_stats.completed, 0),
    points: projects.reduce((sum, p) => sum + p.work_item_stats.total_points, 0),
  };

  return (
    <div className="min-h-screen bg-[#080808] text-[#F4F6FF]">
      <Toaster position="top-right" theme="dark" richColors />

      {/* Header */}
      <header className="border-b border-[rgba(255,255,255,0.05)] bg-[#080808]/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#E0B954] via-[#B8872A] to-[#4338CA] flex items-center justify-center shadow-lg shadow-[#B8872A]/25">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Arsenal Ops</h1>
              <p className="text-xs text-[#737373] font-medium">Project Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2 mr-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E0B954] to-[#B8872A] flex items-center justify-center text-[#080808] text-sm font-medium">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-[#a3a3a3] hidden md:block">{user.name}</span>
              </div>
            )}
            {user?.role.includes('admin') && (
              <Button
                variant="ghost"
                onClick={() => navigate('/admin')}
                className="text-[#737373] hover:text-white hover:bg-[rgba(244,246,255,0.05)] rounded-xl px-3"
              >
                <Settings className="w-4 h-4 mr-2" />
                Admin
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={logout}
              className="text-[#737373] hover:text-red-400 hover:bg-red-500/10 rounded-xl px-3"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
            <Badge
              variant="outline"
              className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 px-3 py-1"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2 animate-pulse" />
              Online
            </Badge>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-8 py-8">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: FolderKanban, label: 'Projects', value: totalStats.projects, color: '#E0B954' },
            { icon: Layers, label: 'Total Items', value: totalStats.items, color: '#F59E0B' },
            {
              icon: CheckCircle2,
              label: 'Completed',
              value: totalStats.completed,
              color: '#E0B954',
            },
            { icon: Zap, label: 'Story Points', value: totalStats.points, color: '#C79E3B' },
          ].map((stat) => (
            <div key={stat.label} className="relative group">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[rgba(224,185,84,0.08)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative bg-[rgba(255,255,255,0.025)] border border-[rgba(255,255,255,0.05)] rounded-2xl p-5 transition-all duration-300 group-hover:border-[rgba(224,185,84,0.2)]">
                <div className="flex items-center justify-between mb-3">
                  <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                  <TrendingUp className="w-3.5 h-3.5 text-[#334155] group-hover:text-[#737373] transition-colors" />
                </div>
                {isLoading ? (
                  <div className="h-9 w-16 bg-[rgba(255,255,255,0.06)] rounded-lg animate-pulse mb-1" />
                ) : (
                  <div className="text-3xl font-bold text-white tracking-tight">{stat.value}</div>
                )}
                <div className="text-xs text-[#737373] font-medium mt-1">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 2×2 Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* TOP-LEFT: MY TASKS BOX */}
          <MyTasksWidget
            myTasks={myTasks}
            myTasksLoading={myTasksLoading}
            personalTasks={personalTasks}
            personalAsMyTasks={personalAsMyTasks}
            user={user}
            setSelectedTask={setSelectedTask}
            setShowAddTaskDialog={setShowAddTaskDialog}
            togglePersonalTaskComplete={togglePersonalTaskComplete}
            startEditPersonalTask={startEditPersonalTask}
            deletePersonalTask={deletePersonalTask}
            setConvertingTask={setConvertingTask}
            setShowConvertDialog={setShowConvertDialog}
            handleStatusChange={handleStatusChange}
            handleQuickDueDateChange={handleQuickDueDateChange}
          />

          {/* TOP-RIGHT: PROJECTS BOX */}
          <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-2xl flex flex-col h-[460px]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.05)] flex-shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Projects</h2>
                <span className="text-xs text-[#737373] bg-[rgba(255,255,255,0.05)] px-2 py-0.5 rounded-full">
                  {filteredProjects.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#737373]" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 w-32 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-lg h-7 text-xs focus:border-[#E0B954]/50"
                  />
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-r from-[#E0B954] to-[#C79E3B] hover:opacity-90 text-[#080808] transition-opacity"
                  title="New Project"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-5 h-5 border-2 border-[#E0B954]/30 border-t-[#E0B954] rounded-full animate-spin" />
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <FolderKanban className="w-8 h-8 text-[#E0B954]/20 mx-auto mb-2" />
                  <p className="text-sm text-[#737373]">No projects found</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredProjects.map((project, idx) => {
                    const accentColors = [
                      '#E0B954',
                      '#F59E0B',
                      '#C79E3B',
                      '#B8872A',
                      '#EC4899',
                      '#06B6D4',
                    ];
                    const accent = accentColors[idx % accentColors.length];
                    return (
                      <div
                        key={project.id}
                        onClick={() => navigate(`/project/${project.id}`)}
                        className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[rgba(255,255,255,0.04)] cursor-pointer transition-all duration-200"
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-[#080808] flex-shrink-0"
                          style={{ backgroundColor: accent }}
                        >
                          {project.key_prefix.substring(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-white truncate">
                              {project.name}
                            </span>
                            <span className="text-xs text-[#737373] flex-shrink-0 ml-2">
                              {project.work_item_stats.completion_pct}%
                            </span>
                          </div>
                          <div className="h-1 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${project.work_item_stats.completion_pct}%`,
                                backgroundColor: accent,
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {user?.role.includes('admin') && (
                            <button
                              onClick={(e) => handleDeleteProject(e, project.id)}
                              className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-[#737373] hover:text-red-400 transition-all"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          <ArrowRight className="w-3.5 h-3.5 text-[#555] group-hover:text-[#E0B954] transition-colors" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* BOTTOM-LEFT: PRIVATE NOTEPAD BOX */}
          <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-2xl flex flex-col h-[460px]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.05)] flex-shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#a3a3a3]" />
                <h3 className="text-base font-semibold text-white">Private Notepad</h3>
                <Lock className="w-3.5 h-3.5 text-[#737373]" />
              </div>
              <span
                className={`text-xs transition-colors duration-300 ${
                  notepadSaved ? 'text-[#E0B954]' : 'text-[#737373]'
                }`}
              >
                {notepadSaved ? '✓ Saved' : 'Saving...'}
              </span>
            </div>
            <div className="flex-1 overflow-hidden p-5">
              <textarea
                value={notepadContent}
                onChange={(e) => setNotepadContent(e.target.value)}
                placeholder="Jot down a quick note, idea, or add a link to an important resource. Only you can see this."
                className="w-full h-full bg-transparent text-sm text-[#a3a3a3] placeholder:text-[#333] resize-none outline-none leading-relaxed"
              />
            </div>
          </div>

          {/* BOTTOM-RIGHT: MY OVERVIEW BOX */}
          <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-2xl flex flex-col h-[460px]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(255,255,255,0.05)] flex-shrink-0">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#E0B954]" />
                <h3 className="text-sm font-semibold text-white">My Overview</h3>
              </div>
              <span className="text-xs text-[#737373]">{overviewStats.total} tasks</span>
            </div>
            <div className="flex-1 min-h-0 p-4 overflow-y-auto space-y-4">
              {myTasksLoading ? (
                /* Skeleton while tasks load */
                <>
                  <div className="grid grid-cols-4 gap-2">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3 text-center"
                      >
                        <div className="h-7 w-8 bg-[rgba(255,255,255,0.07)] rounded-lg animate-pulse mx-auto mb-1" />
                        <div className="h-3 w-12 bg-[rgba(255,255,255,0.05)] rounded animate-pulse mx-auto" />
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <div className="h-3 w-20 bg-[rgba(255,255,255,0.05)] rounded animate-pulse" />
                      <div className="h-3 w-8 bg-[rgba(255,255,255,0.05)] rounded animate-pulse" />
                    </div>
                    <div className="h-2 bg-[rgba(255,255,255,0.05)] rounded-full animate-pulse" />
                  </div>
                  <div>
                    <div className="h-3 rounded-full bg-[rgba(255,255,255,0.05)] animate-pulse mb-2" />
                    <div className="flex gap-3">
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          className="h-3 w-16 bg-[rgba(255,255,255,0.04)] rounded animate-pulse"
                        />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[rgba(255,255,255,0.07)] animate-pulse flex-shrink-0" />
                        <div className="h-3 flex-1 bg-[rgba(255,255,255,0.05)] rounded animate-pulse" />
                        <div className="h-3 w-10 bg-[rgba(255,255,255,0.04)] rounded animate-pulse flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </>
              ) : myTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <BarChart3 className="w-10 h-10 text-[#E0B954]/20 mb-2" />
                  <p className="text-sm text-[#737373]">No task data yet</p>
                  <p className="text-xs text-[#555] mt-1">Tasks assigned to you will appear here</p>
                </div>
              ) : (
                <>
                  {/* Row 1 — 4 stat micro-cards */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Total', value: overviewStats.total, color: '#f5f5f5' },
                      { label: 'Done', value: overviewStats.done, color: '#34D399' },
                      { label: 'In Progress', value: overviewStats.in_progress, color: '#E0B954' },
                      { label: 'Overdue', value: overviewStats.overdue, color: '#EF4444' },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3 text-center"
                      >
                        <div className="text-xl font-bold" style={{ color: s.color }}>
                          {s.value}
                        </div>
                        <div className="text-xs text-[#737373] mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Row 2 — Completion progress bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-[#737373]">Completion</span>
                      <span className="text-xs font-semibold text-[#34D399]">
                        {overviewStats.completion_pct}%
                      </span>
                    </div>
                    <div className="h-2 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${overviewStats.completion_pct}%`,
                          background: 'linear-gradient(90deg, #34D399, #059669)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Row 3 — Stacked status bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-[#737373]">Status distribution</span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden flex w-full">
                      {STATUS_BARS.map((s) => {
                        const count = overviewStats[s.key as keyof typeof overviewStats] as number;
                        const pct =
                          overviewStats.total > 0 ? (count / overviewStats.total) * 100 : 0;
                        return pct > 0 ? (
                          <div
                            key={s.key}
                            style={{ width: `${pct}%`, backgroundColor: s.color }}
                            title={`${s.label}: ${count}`}
                          />
                        ) : null;
                      })}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {STATUS_BARS.map((s) => {
                        const count = overviewStats[s.key as keyof typeof overviewStats] as number;
                        return (
                          <div key={s.key} className="flex items-center gap-1.5">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: s.color }}
                            />
                            <span className="text-xs text-[#737373]">
                              {s.label} <span className="text-white font-medium">{count}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Row 4 — Next due */}
                  {(() => {
                    const allDue = myTasks
                      .filter((t) => t.due_date && t.status !== 'done')
                      .sort(
                        (a, b) =>
                          parseLocalDate(a.due_date!)!.getTime() -
                          parseLocalDate(b.due_date!)!.getTime(),
                      );
                    const dueSoon = showAllDueSoon ? allDue : allDue.slice(0, 4);
                    return allDue.length > 0 ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-[#737373] font-medium">Next due</span>
                          <span className="text-xs text-[#737373]">{allDue.length} upcoming</span>
                        </div>
                        <div className="space-y-1.5">
                          {dueSoon.map((t) => (
                            <div
                              key={t.id}
                              className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[rgba(255,255,255,0.02)] px-2 py-1 rounded-lg transition-colors"
                              onClick={() => setSelectedTask(t)}
                            >
                              <div
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: STATUS_COLOR[t.status] || '#555' }}
                              />
                              <span className="text-[#a3a3a3] truncate flex-1">{t.title}</span>
                              <span
                                className={`flex-shrink-0 ${t.is_overdue ? 'text-red-400' : 'text-[#737373]'}`}
                              >
                                {parseLocalDate(t.due_date!)?.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>
                          ))}
                        </div>
                        {allDue.length > 4 && (
                          <button
                            onClick={() => setShowAllDueSoon((p) => !p)}
                            className="w-full text-center text-xs text-[#737373] hover:text-[#E0B954] py-1.5 mt-1 transition-colors"
                          >
                            {showAllDueSoon ? 'Show less' : `Show ${allDue.length - 4} more`}
                          </button>
                        )}
                      </div>
                    ) : null;
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
        {/* end 2×2 grid */}
      </div>

      {/* Jira-style Ticket Slide-in Panel */}
      {selectedTask && (
        <Suspense fallback={<div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-[#080808] z-50 flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-[#E0B954] border-t-transparent rounded-full" /></div>}>
          <TaskDetailPanel
            selectedTask={selectedTask}
            isEditingTask={isEditingTask}
            editingTaskForm={editingTaskForm}
            setEditingTaskForm={setEditingTaskForm}
            editTaskProjectDevelopers={editTaskProjectDevelopers}
            showCalendarMyTask={showCalendarMyTask}
            setShowCalendarMyTask={setShowCalendarMyTask}
            displayComments={displayComments}
            allDevelopers={allDevelopers}
            newComment={newComment}
            showMentions={showMentions}
            mentionFilter={mentionFilter}
            taskSprints={taskSprints}
            setSelectedTask={setSelectedTask}
            setIsEditingTask={setIsEditingTask}
            startEditTask={startEditTask}
            cancelEditTask={cancelEditTask}
            saveEditedTask={saveEditedTask}
            handleLogHours={handleLogHours}
            handleStatusChange={handleStatusChange}
            handleMoveTaskToSprint={handleMoveTaskToSprint}
            getNextTaskSprint={getNextTaskSprint}
            handleCommentChange={handleCommentChange}
            handleSubmitComment={handleSubmitComment}
            insertMention={insertMention}
            renderTextWithNewlines={renderTextWithNewlines}
            renderCommentContent={renderCommentContent}
          />
        </Suspense>
      )}

      {/* Add Personal Task Dialog */}
      <Dialog
        open={showAddTaskDialog}
        onOpenChange={(open) => {
          setShowAddTaskDialog(open);
          if (!open) {
            setNewPersonalTask({
              title: '',
              description: '',
              priority: 'medium',
              due_date: '',
              project_id: '',
              assignee_developer_id: '',
              estimated_hours: '',
            });
            setMemberLookupProjectId('');
          }
        }}
      >
        <DialogContent className="bg-[#0d0d0d] border-[rgba(255,255,255,0.08)] text-white">
          <DialogHeader>
            <DialogTitle>Add Personal Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-[#737373] mb-1 block">Title *</label>
              <Input
                value={newPersonalTask.title}
                onChange={(e) => setNewPersonalTask({ ...newPersonalTask, title: e.target.value })}
                placeholder="What needs to be done?"
                className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white"
                onKeyDown={(e) => e.key === 'Enter' && createPersonalTask()}
              />
            </div>
            <div>
              <label className="text-xs text-[#737373] mb-1 block">Description</label>
              <Textarea
                value={newPersonalTask.description}
                onChange={(e) =>
                  setNewPersonalTask({ ...newPersonalTask, description: e.target.value })
                }
                placeholder="Add details..."
                className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white resize-none"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[#737373] mb-1 block">Priority</label>
                <Select
                  value={newPersonalTask.priority}
                  onValueChange={(v) => setNewPersonalTask({ ...newPersonalTask, priority: v })}
                >
                  <SelectTrigger className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d0d0d] border-[rgba(255,255,255,0.08)]">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-[#737373] mb-1 block">Due Date</label>
                <Popover open={showCalendarAddTask} onOpenChange={setShowCalendarAddTask}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white justify-start text-left font-normal hover:bg-[#0A0A14] hover:text-white"
                    >
                      {newPersonalTask.due_date
                        ? parseLocalDate(newPersonalTask.due_date)?.toLocaleDateString()
                        : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="start"
                    className="w-auto p-3 bg-[#0d0d0d] border border-[rgba(224,185,84,0.2)]"
                  >
                    <CalendarIcon
                      mode="single"
                      selected={parseLocalDate(newPersonalTask.due_date)}
                      onSelect={(date) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          const localDate = `${year}-${month}-${day}`;
                          setNewPersonalTask({ ...newPersonalTask, due_date: localDate });
                          setShowCalendarAddTask(false);
                        }
                      }}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      classNames={{
                        months: 'flex flex-col',
                        month: 'space-y-4',
                        caption: 'flex justify-between items-center px-0 pb-4 relative h-7 mb-2',
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
            {/* Project and Assignee dropdowns */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[#737373] mb-1 block">
                  Project <span className="text-[#555]">(optional)</span>
                </label>
                <Select
                  value={newPersonalTask.project_id}
                  onValueChange={(v) => {
                    setNewPersonalTask({
                      ...newPersonalTask,
                      project_id: v,
                      assignee_developer_id: '',
                    });
                    setMemberLookupProjectId(v || '');
                  }}
                >
                  <SelectTrigger className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white">
                    <SelectValue placeholder="Choose a project..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d0d0d] border-[rgba(255,255,255,0.08)]">
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {newPersonalTask.project_id && (
                <div>
                  <label className="text-xs text-[#737373] mb-1 block">
                    Assign To <span className="text-[#555]">(optional — defaults to you)</span>
                  </label>
                  <Select
                    value={newPersonalTask.assignee_developer_id}
                    onValueChange={(v) =>
                      setNewPersonalTask({ ...newPersonalTask, assignee_developer_id: v })
                    }
                  >
                    <SelectTrigger className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white">
                      <SelectValue placeholder="Select team member..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0d0d0d] border-[rgba(255,255,255,0.08)]">
                      {projectMembers.length === 0 ? (
                        <div className="p-2 text-xs text-[#737373]">
                          No team members in this project
                        </div>
                      ) : (
                        projectMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id.toString()}>
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#E0B954] to-[#C79E3B] flex items-center justify-center text-[#080808] text-xs font-bold">
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                              {member.name}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {newPersonalTask.project_id && (
              <div>
                <label className="text-xs text-[#737373] mb-1 block">
                  Estimated Hours <span className="text-[#555]">(optional)</span>
                </label>
                <Input
                  value={newPersonalTask.estimated_hours}
                  onChange={(e) =>
                    setNewPersonalTask({ ...newPersonalTask, estimated_hours: e.target.value })
                  }
                  className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white placeholder-[#444]"
                />
              </div>
            )}
            <Button
              onClick={createPersonalTask}
              disabled={addingTask || !newPersonalTask.title.trim()}
              className="w-full bg-gradient-to-r from-[#E0B954] to-[#C79E3B] text-[#080808] font-semibold hover:opacity-90"
            >
              {addingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Task'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Convert to Project Ticket Dialog */}
      <Dialog
        open={showConvertDialog}
        onOpenChange={(open) => {
          setShowConvertDialog(open);
          if (!open) {
            setConvertProjectId('');
            setConvertAssigneeId('');
            setConvertEstimatedHours('');
            setMemberLookupProjectId('');
          }
        }}
      >
        <DialogContent className="bg-[#0d0d0d] border-[rgba(255,255,255,0.08)] text-white">
          <DialogHeader>
            <DialogTitle>Tag to Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {convertingTask && (
              <div className="p-3 bg-[#0A0A14] rounded-lg border border-[rgba(255,255,255,0.05)]">
                <p className="text-white font-medium text-sm">{convertingTask.title}</p>
                <p className="text-[#737373] text-xs mt-0.5 capitalize">
                  {convertingTask.priority} priority
                </p>
              </div>
            )}
            <div>
              <label className="text-xs text-[#737373] mb-1 block">Select Project</label>
              <Select
                value={convertProjectId}
                onValueChange={(v) => {
                  setConvertProjectId(v);
                  setConvertAssigneeId('');
                  setMemberLookupProjectId(v);
                }}
              >
                <SelectTrigger className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white">
                  <SelectValue placeholder="Choose a project..." />
                </SelectTrigger>
                <SelectContent className="bg-[#0d0d0d] border-[rgba(255,255,255,0.08)]">
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-[#737373] mb-1 block">Estimated Hours</label>
              <Input
                value={convertEstimatedHours}
                onChange={(e) => setConvertEstimatedHours(e.target.value)}
                className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white"
              />
            </div>
            {convertProjectId && (
              <div>
                <label className="text-xs text-[#737373] mb-1 block">
                  Assign To <span className="text-[#555]">(optional — defaults to you)</span>
                </label>
                <Select value={convertAssigneeId} onValueChange={setConvertAssigneeId}>
                  <SelectTrigger className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white">
                    <SelectValue placeholder="Select team member..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d0d0d] border-[rgba(255,255,255,0.08)]">
                    {projectMembers.length === 0 ? (
                      <div className="p-2 text-xs text-[#737373]">
                        No team members in this project
                      </div>
                    ) : (
                      projectMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id.toString()}>
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#E0B954] to-[#C79E3B] flex items-center justify-center text-[#080808] text-xs font-bold">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                            {member.name}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              onClick={convertToTicket}
              disabled={convertingTicket || !convertProjectId}
              className="w-full bg-gradient-to-r from-[#E0B954] to-[#C79E3B] text-[#080808] font-semibold hover:opacity-90"
            >
              {convertingTicket ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Create Project Ticket'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Personal Task Dialog */}
      <Dialog
        open={isEditingPersonalTask}
        onOpenChange={(open) => {
          if (!open) cancelEditPersonalTask();
        }}
      >
        <DialogContent className="bg-[#0d0d0d] border-[rgba(255,255,255,0.08)] text-white">
          <DialogHeader>
            <DialogTitle>Edit Personal Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-[#737373] mb-1 block">Title</label>
              <Input
                value={editPersonalTaskForm.title}
                onChange={(e) =>
                  setEditPersonalTaskForm({ ...editPersonalTaskForm, title: e.target.value })
                }
                placeholder="What needs to be done?"
                className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white"
              />
            </div>
            <div>
              <label className="text-xs text-[#737373] mb-1 block">Description</label>
              <Textarea
                value={editPersonalTaskForm.description}
                onChange={(e) =>
                  setEditPersonalTaskForm({ ...editPersonalTaskForm, description: e.target.value })
                }
                placeholder="Add more details..."
                className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#737373] mb-1 block">Priority</label>
                <Select
                  value={editPersonalTaskForm.priority}
                  onValueChange={(value) =>
                    setEditPersonalTaskForm({ ...editPersonalTaskForm, priority: value })
                  }
                >
                  <SelectTrigger className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d0d0d] border-[rgba(255,255,255,0.08)]">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-[#737373] mb-1 block">Due Date</label>
                <Popover
                  open={showCalendarEditPersonalTask}
                  onOpenChange={setShowCalendarEditPersonalTask}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white hover:bg-[#0A0A14] hover:text-white"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      {editPersonalTaskForm.due_date
                        ? parseLocalDate(editPersonalTaskForm.due_date)?.toLocaleDateString()
                        : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-[#0A0A14] border-[rgba(255,255,255,0.08)]">
                    <CalendarIcon
                      mode="single"
                      selected={parseLocalDate(editPersonalTaskForm.due_date)}
                      onSelect={(date) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          const localDate = `${year}-${month}-${day}`;
                          setEditPersonalTaskForm({ ...editPersonalTaskForm, due_date: localDate });
                          setShowCalendarEditPersonalTask(false);
                        }
                      }}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      classNames={{
                        months: 'flex flex-col',
                        month: 'space-y-4',
                        caption: 'flex justify-between items-center px-0 pb-4 relative h-7 mb-2',
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
            <div className="flex gap-2 pt-2">
              <Button
                onClick={updatePersonalTask}
                disabled={addingTask}
                className="flex-1 bg-gradient-to-r from-[#E0B954] to-[#C79E3B] text-[#080808] font-semibold hover:opacity-90"
              >
                {addingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
              </Button>
              <Button
                onClick={cancelEditPersonalTask}
                disabled={addingTask}
                variant="outline"
                className="flex-1 bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white hover:bg-[#0A0A14] hover:text-white"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-[#0d0d0d] border border-[rgba(255,255,255,0.07)] rounded-2xl w-full max-w-lg shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.05)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E0B954] to-[#B8872A] flex items-center justify-center">
                  <FolderKanban className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">New Project</h2>
                  <p className="text-xs text-[#737373]">Create a project to organize your work</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-lg hover:bg-[rgba(244,246,255,0.05)] text-[#737373] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-sm font-medium text-[#a3a3a3] block mb-2">
                  Project Name *
                </label>
                <Input
                  placeholder="e.g. Mobile App Redesign"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl h-11 focus:border-[#E0B954]/50 placeholder:text-[#334155]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#a3a3a3] block mb-2">Description</label>
                <Textarea
                  placeholder="Brief description of the project goals..."
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl min-h-[80px] focus:border-[#E0B954]/50 placeholder:text-[#334155] resize-none"
                />
              </div>

              {/* GitHub Repository */}
              <div>
                <label className="text-sm font-medium text-[#a3a3a3] block mb-2">
                  GitHub Repository URL
                  <span className="text-[#737373] text-xs ml-2">
                    (Optional - for sending invitations)
                  </span>
                </label>
                <Input
                  placeholder="https://github.com/owner/repo"
                  value={createForm.github_repo_url}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, github_repo_url: e.target.value }))
                  }
                  className="bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl h-11 focus:border-[#E0B954]/50 placeholder:text-[#334155]"
                />
                <p className="text-xs text-[#737373] mt-1.5">
                  Enter the GitHub repo URL to automatically send invitations to assigned developers
                </p>
              </div>

              {/* Developer Assignment Section */}
              <div className="border-t border-[rgba(255,255,255,0.05)] pt-5">
                <label className="text-sm font-medium text-[#a3a3a3] block mb-3">
                  Assign Developers
                </label>

                {/* Add Developer Form */}
                <div className="space-y-3">
                  <Select value={selectedDeveloperId} onValueChange={setSelectedDeveloperId}>
                    <SelectTrigger className="bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl h-11 focus:border-[#E0B954]/50">
                      <SelectValue placeholder="Select a developer" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1d29] border-[rgba(255,255,255,0.07)]">
                      {availableDevelopers
                        .filter(
                          (dev) => !selectedDevelopers.find((sd) => sd.developer_id === dev.id),
                        )
                        .map((dev) => (
                          <SelectItem
                            key={dev.id}
                            value={String(dev.id)}
                            className="text-[#F4F6FF] focus:bg-[rgba(224,185,84,0.2)] focus:text-[#F4F6FF]"
                          >
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-[#737373]" />
                              <span>{dev.name}</span>
                              <span className="text-[#737373] text-xs">({dev.email})</span>
                              {dev.github_username && (
                                <span className="text-[#E0B954] text-xs ml-1">
                                  @{dev.github_username}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      {availableDevelopers.length === 0 && (
                        <SelectItem value="none" disabled className="text-[#737373]">
                          No developers available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Role (e.g. Frontend Developer, Tech Lead)"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl h-11 focus:border-[#E0B954]/50 placeholder:text-[#334155]"
                  />

                  <Textarea
                    placeholder="What will they be working on in this project?"
                    value={newResponsibilities}
                    onChange={(e) => setNewResponsibilities(e.target.value)}
                    className="bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl min-h-[60px] focus:border-[#E0B954]/50 placeholder:text-[#334155] resize-none"
                  />

                  <Button
                    type="button"
                    onClick={handleAddDeveloper}
                    disabled={!selectedDeveloperId || !newRole.trim()}
                    className="w-full bg-gradient-to-r from-[#E0B954] to-[#C79E3B] hover:opacity-90 text-[#080808] font-semibold rounded-xl font-medium shadow-lg shadow-[#B8872A]/20 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Developer
                  </Button>
                </div>

                {/* Selected Developers List */}
                {selectedDevelopers.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-[#737373] font-medium">Assigned Developers:</p>
                    {selectedDevelopers.map((dev) => {
                      const developerInfo = availableDevelopers.find(
                        (d) => d.id === dev.developer_id,
                      );
                      return (
                        <div
                          key={dev.developer_id}
                          className="bg-[rgba(255,255,255,0.025)] border border-[rgba(255,255,255,0.05)] rounded-xl p-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#E0B954]/20 to-[#B8872A]/10 flex items-center justify-center">
                                <User className="w-4 h-4 text-[#E0B954]" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[#F4F6FF]">
                                  {developerInfo?.name}
                                </p>
                                <p className="text-xs text-[#E0B954]">{dev.role}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveDeveloper(dev.developer_id)}
                              className="p-1 rounded hover:bg-red-500/10 text-[#737373] hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {dev.responsibilities && (
                            <p className="text-xs text-[#737373] mt-2 ml-10">
                              {dev.responsibilities}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-[rgba(255,255,255,0.05)]">
              <Button
                variant="ghost"
                onClick={() => setShowCreateModal(false)}
                disabled={isCreating}
                className="text-[#737373] hover:text-white rounded-xl px-6"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateProject}
                disabled={isCreating || !createForm.name.trim()}
                className="bg-gradient-to-r from-[#E0B954] to-[#C79E3B] hover:opacity-90 text-[#080808] font-semibold rounded-xl px-6 font-medium shadow-lg shadow-[#B8872A]/20 disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Create Project
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
