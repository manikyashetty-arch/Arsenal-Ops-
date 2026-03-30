import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    AlertCircle,
    ClipboardList,
    Bug,
    Target,
    ExternalLink,
    Tag,
    ChevronRight,
    Loader2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast, Toaster } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';

import { API_BASE_URL } from '@/config/api';

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
}

interface Project {
    id: number;
    name: string;
    description: string;
    key_prefix: string;
    status: string;
    github_repo_url?: string;
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
    description?: string;
    tags?: string[];
    acceptance_criteria?: string[];
    parent_id?: number | null;
    epic_id?: number | null;
    sprint_id?: number | null;
    parent_key?: string | null;
    epic_key?: string | null;
}

const ProjectsPage = () => {
    const navigate = useNavigate();
    const { user, token, logout } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [createForm, setCreateForm] = useState({
        name: '',
        description: '',
        github_repo_url: '',
    });
    const [isCreating, setIsCreating] = useState(false);
    
    // Developer management
    const [availableDevelopers, setAvailableDevelopers] = useState<Developer[]>([]);
    const [selectedDevelopers, setSelectedDevelopers] = useState<{ developer_id: number; role: string; responsibilities: string }[]>([]);
    const [selectedDeveloperId, setSelectedDeveloperId] = useState<string>('');
    const [newRole, setNewRole] = useState('');
    const [newResponsibilities, setNewResponsibilities] = useState('');

    // My Tasks
    const [myTasks, setMyTasks] = useState<MyTask[]>([]);
    const [myTaskTab, setMyTaskTab] = useState<'upcoming' | 'overdue' | 'completed' | 'personal'>('upcoming');
    const [myTasksLoading, setMyTasksLoading] = useState(false);
    const [showAllTasks, setShowAllTasks] = useState(false);
    const [showAllDueSoon, setShowAllDueSoon] = useState(false);
    const [selectedTask, setSelectedTask] = useState<MyTask | null>(null);

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
    const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>([]);
    const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
    const [showConvertDialog, setShowConvertDialog] = useState(false);
    const [convertingTask, setConvertingTask] = useState<PersonalTask | null>(null);
    const [convertProjectId, setConvertProjectId] = useState('');
    const [convertAssigneeId, setConvertAssigneeId] = useState('');
    const [projectMembers, setProjectMembers] = useState<{id: number; name: string; email: string}[]>([]);
    const [addingTask, setAddingTask] = useState(false);
    const [convertingTicket, setConvertingTicket] = useState(false);
    const [newPersonalTask, setNewPersonalTask] = useState({
        title: '', description: '', priority: 'medium', estimated_hours: 0, due_date: '', project_id: ''
    });

    // Private Notepad
    const [notepadContent, setNotepadContent] = useState('');
    const [notepadSaved, setNotepadSaved] = useState(true);

    // (box layout — no active tab needed)

    // Fetch projects
    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/projects/`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setProjects(data);
            }
        } catch (err) {
            console.error('Failed to fetch projects:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch available developers
    const fetchDevelopers = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/developers/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setAvailableDevelopers(data);
            }
        } catch (err) {
            console.error('Failed to fetch developers:', err);
        }
    };

    // Load developers when modal opens
    useEffect(() => {
        if (showCreateModal) {
            fetchDevelopers();
        }
    }, [showCreateModal]);

    // Fetch personal tasks
    const fetchPersonalTasks = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/personal-tasks/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setPersonalTasks(await res.json());
        } catch (err) { console.error('Failed to fetch personal tasks:', err); }
    };

    const createPersonalTask = async () => {
        if (!newPersonalTask.title.trim()) { toast.error('Title is required'); return; }
        setAddingTask(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/personal-tasks/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ ...newPersonalTask, due_date: newPersonalTask.due_date || undefined })
            });
            if (res.ok) {
                toast.success('Task created!');
                setShowAddTaskDialog(false);
                setNewPersonalTask({ title: '', description: '', priority: 'medium', estimated_hours: 0, due_date: '', project_id: '' });
                fetchPersonalTasks();
            } else { toast.error('Failed to create task'); }
        } catch { toast.error('Failed to create task'); }
        finally { setAddingTask(false); }
    };

    const fetchProjectMembers = async (projectId: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setProjectMembers(data.developers || []);
            }
        } catch { setProjectMembers([]); }
    };

    const convertToTicket = async () => {
        if (!convertingTask || !convertProjectId) return;
        setConvertingTicket(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/personal-tasks/${convertingTask.id}/convert-to-ticket`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    project_id: parseInt(convertProjectId),
                    type: 'task',
                    assignee_developer_id: convertAssigneeId ? parseInt(convertAssigneeId) : undefined
                })
            });
            if (res.ok) {
                const data = await res.json();
                const assigneeName = data.work_item.assignee_name ? ` → assigned to ${data.work_item.assignee_name}` : '';
                toast.success(`Ticket ${data.work_item.key} created!${assigneeName}`);
                setShowConvertDialog(false);
                setConvertingTask(null);
                setConvertProjectId('');
                setConvertAssigneeId('');
                setProjectMembers([]);
                fetchPersonalTasks();
            } else { toast.error('Failed to convert'); }
        } catch { toast.error('Failed to convert'); }
        finally { setConvertingTicket(false); }
    };

    const deletePersonalTask = async (taskId: number) => {
        if (!confirm('Delete this task?')) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/personal-tasks/${taskId}`, {
                method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) { toast.success('Task deleted'); fetchPersonalTasks(); }
        } catch { toast.error('Failed to delete task'); }
    };

    // Fetch my tasks
    const fetchMyTasks = async () => {
        setMyTasksLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/workitems/my-tasks`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setMyTasks(await res.json());
        } catch (err) {
            console.error('Failed to fetch my tasks:', err);
        } finally {
            setMyTasksLoading(false);
        }
    };

    // Load my tasks on mount
    useEffect(() => {
        if (token) { fetchMyTasks(); fetchPersonalTasks(); }
    }, [token]);

    // Load notepad from localStorage per user
    useEffect(() => {
        if (user?.id) {
            const saved = localStorage.getItem(`notepad_${user.id}`);
            if (saved !== null) setNotepadContent(saved);
        }
    }, [user?.id]);

    // Auto-save notepad with debounce
    useEffect(() => {
        if (!user?.id) return;
        setNotepadSaved(false);
        const timer = setTimeout(() => {
            localStorage.setItem(`notepad_${user.id}`, notepadContent);
            setNotepadSaved(true);
        }, 800);
        return () => clearTimeout(timer);
    }, [notepadContent]);

    // Computed chart data (used by My Overview stacked bar)
    const overviewStats = {
        total: myTasks.length,
        done: myTasks.filter(t => t.status === 'done').length,
        in_progress: myTasks.filter(t => t.status === 'in_progress').length,
        in_review: myTasks.filter(t => t.status === 'in_review').length,
        todo: myTasks.filter(t => t.status === 'todo').length,
        overdue: myTasks.filter(t => t.is_overdue).length,
        completion_pct: myTasks.length > 0
            ? Math.round(myTasks.filter(t => t.status === 'done').length / myTasks.length * 100)
            : 0,
    };

    const STATUS_BARS = [
        { key: 'done',        color: '#34D399', label: 'Done' },
        { key: 'in_progress', color: '#E0B954', label: 'In Progress' },
        { key: 'in_review',   color: '#A78BFA', label: 'In Review' },
        { key: 'todo',        color: '#60A5FA', label: 'To Do' },
    ] as const;

    const TASK_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string; bg: string }> = {
        user_story: { icon: BookOpen,     color: '#E0B954', label: 'Story', bg: 'rgba(224,185,84,0.15)' },
        task:       { icon: ClipboardList, color: '#F59E0B', label: 'Task',  bg: 'rgba(245,158,11,0.15)' },
        bug:        { icon: Bug,           color: '#EF4444', label: 'Bug',   bg: 'rgba(239,68,68,0.15)'  },
        epic:       { icon: Target,        color: '#A78BFA', label: 'Epic',  bg: 'rgba(167,139,250,0.15)' },
    };

    const PRIORITY_COLORS: Record<string, string> = {
        critical: '#EF4444',
        high:     '#F97316',
        medium:   '#F59E0B',
        low:      '#737373',
    };

    const STATUS_COLOR: Record<string, string> = {
        todo:        '#60A5FA',
        in_progress: '#E0B954',
        in_review:   '#A78BFA',
        done:        '#34D399',
        blocked:     '#EF4444',
        backlog:     '#555',
    };

    const filteredMyTasks = myTasks.filter(t => {
        if (myTaskTab === 'upcoming') return t.status !== 'done' && !t.is_overdue;
        if (myTaskTab === 'overdue') return t.is_overdue;
        return t.status === 'done';
    });

    const handleAddDeveloper = () => {
        if (!selectedDeveloperId || !newRole.trim()) {
            toast.error('Please select a developer and enter a role');
            return;
        }
        
        const devId = parseInt(selectedDeveloperId);
        const alreadyAdded = selectedDevelopers.find(d => d.developer_id === devId);
        if (alreadyAdded) {
            toast.error('Developer already added to this project');
            return;
        }
        
        setSelectedDevelopers(prev => [...prev, {
            developer_id: devId,
            role: newRole,
            responsibilities: newResponsibilities
        }]);
        
        setSelectedDeveloperId('');
        setNewRole('');
        setNewResponsibilities('');
    };

    const handleRemoveDeveloper = (developerId: number) => {
        setSelectedDevelopers(prev => prev.filter(d => d.developer_id !== developerId));
    };

    const handleCreateProject = async () => {
        if (!createForm.name.trim()) {
            toast.error('Project name is required');
            return;
        }
        setIsCreating(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/projects/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: createForm.name,
                    description: createForm.description,
                    github_repo_url: createForm.github_repo_url || undefined,
                    developers: selectedDevelopers,
                }),
            });
            if (response.ok) {
                const newProject = await response.json();
                setProjects(prev => [...prev, newProject]);
                setShowCreateModal(false);
                setCreateForm({ name: '', description: '', github_repo_url: '' });
                setSelectedDevelopers([]);
                toast.success('Project created successfully!');
            }
        } catch (err) {
            toast.error('Failed to create project');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteProject = async (e: React.MouseEvent, projectId: number) => {
        e.stopPropagation();
        if (!confirm('Delete this project and all its work items?')) return;
        try {
            await fetch(`${API_BASE_URL}/api/projects/${projectId}/`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setProjects(prev => prev.filter(p => p.id !== projectId));
            toast.success('Project deleted');
        } catch (err) {
            toast.error('Failed to delete project');
        }
    };

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
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
                        {user?.role === 'admin' && (
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
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 px-3 py-1">
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
                        { icon: CheckCircle2, label: 'Completed', value: totalStats.completed, color: '#E0B954' },
                        { icon: Zap, label: 'Story Points', value: totalStats.points, color: '#C79E3B' },
                    ].map(stat => (
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
                                        <span>{myTasks.filter(t => t.status === 'done').length} completed</span>
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
                                {(['upcoming', 'overdue', 'completed', 'personal'] as const).map(tab => {
                                    const count = tab === 'upcoming'
                                        ? myTasks.filter(t => t.status !== 'done' && !t.is_overdue).length
                                        : tab === 'overdue'
                                        ? myTasks.filter(t => t.is_overdue).length
                                        : tab === 'personal'
                                        ? personalTasks.filter(t => !t.is_converted).length
                                        : myTasks.filter(t => t.status === 'done').length;
                                    return (
                                        <button
                                            key={tab}
                                            onClick={() => { setMyTaskTab(tab); setShowAllTasks(false); }}
                                            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                                                myTaskTab === tab
                                                    ? 'border-[#E0B954] text-white'
                                                    : 'border-transparent text-[#737373] hover:text-[#a3a3a3]'
                                            }`}
                                        >
                                            {tab === 'overdue' && count > 0 ? (
                                                <span className="flex items-center gap-1.5">
                                                    Overdue
                                                    <span className="bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded-full">{count}</span>
                                                </span>
                                            ) : tab === 'personal' ? (
                                                <span className="flex items-center gap-1.5">
                                                    Personal
                                                    {count > 0 && <span className="bg-[#E0B954]/20 text-[#E0B954] text-xs px-1.5 py-0.5 rounded-full">{count}</span>}
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
                                    personalTasks.filter(t => !t.is_converted).length === 0 ? (
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
                                            {personalTasks.filter(t => !t.is_converted).map(task => (
                                                <div key={task.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[rgba(255,255,255,0.03)] transition-colors group">
                                                    <div className="w-4 h-4 rounded-full border-2 border-[#444] group-hover:border-[#E0B954]/50 flex-shrink-0" />
                                                    <span className="flex-1 text-sm text-[#f5f5f5] truncate">{task.title}</span>
                                                    {task.priority !== 'medium' && (
                                                        <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                                                            task.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                                                            task.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                                            'bg-gray-500/20 text-gray-400'
                                                        }`}>{task.priority}</span>
                                                    )}
                                                    <button
                                                        onClick={() => { setConvertingTask(task); setShowConvertDialog(true); }}
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
                                            {myTaskTab === 'completed' ? 'No completed tasks yet' : myTaskTab === 'overdue' ? 'No overdue tasks 🎉' : 'No upcoming tasks'}
                                        </p>
                                    </div>
                                ) : (
                                    (showAllTasks ? filteredMyTasks : filteredMyTasks.slice(0, 6)).map(task => (
                                        <div
                                            key={task.id}
                                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[rgba(255,255,255,0.03)] transition-colors cursor-pointer group"
                                            onClick={() => setSelectedTask(task)}
                                        >
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                                task.status === 'done' ? 'border-[#E0B954] bg-[#E0B954]' :
                                                task.is_overdue ? 'border-red-400' : 'border-[#444] group-hover:border-[#E0B954]/50'
                                            }`}>
                                                {task.status === 'done' && <CheckCircle2 className="w-3 h-3 text-[#080808]" />}
                                            </div>
                                            <span className={`flex-1 text-sm truncate ${
                                                task.status === 'done' ? 'line-through text-[#555]' : 'text-[#f5f5f5]'
                                            }`}>
                                                {task.title}
                                            </span>
                                            <span className="text-xs px-2 py-0.5 rounded-md bg-[rgba(224,185,84,0.08)] text-[#C79E3B] truncate max-w-[110px] flex-shrink-0">
                                                {task.project_name}
                                            </span>
                                            {task.is_overdue && (
                                                <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                                            )}
                                            {task.due_date && (
                                                <span className={`text-xs flex-shrink-0 ${
                                                    task.is_overdue ? 'text-red-400' : 'text-[#737373]'
                                                }`}>
                                                    {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </span>
                                            )}
                                        </div>
                                    ))
                                )}
                                {filteredMyTasks.length > 6 && (
                                    <button
                                        onClick={() => setShowAllTasks(p => !p)}
                                        className="w-full text-center text-xs text-[#737373] hover:text-[#E0B954] py-2.5 transition-colors"
                                    >
                                        {showAllTasks ? 'Show less' : `Show ${filteredMyTasks.length - 6} more`}
                                    </button>
                                )}
                            </div>
                    </div>

                    {/* TOP-RIGHT: PROJECTS BOX */}
                    <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-2xl flex flex-col h-[460px]">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.05)] flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-semibold text-white">Projects</h2>
                                <span className="text-xs text-[#737373] bg-[rgba(255,255,255,0.05)] px-2 py-0.5 rounded-full">{filteredProjects.length}</span>
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
                                {user?.role === 'admin' && (
                                    <button
                                        onClick={() => setShowCreateModal(true)}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-r from-[#E0B954] to-[#C79E3B] hover:opacity-90 text-[#080808] transition-opacity"
                                        title="New Project"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                )}
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
                                        const accentColors = ['#E0B954', '#F59E0B', '#C79E3B', '#B8872A', '#EC4899', '#06B6D4'];
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
                                                        <span className="text-sm font-medium text-white truncate">{project.name}</span>
                                                        <span className="text-xs text-[#737373] flex-shrink-0 ml-2">{project.work_item_stats.completion_pct}%</span>
                                                    </div>
                                                    <div className="h-1 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all"
                                                            style={{ width: `${project.work_item_stats.completion_pct}%`, backgroundColor: accent }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    {user?.role === 'admin' && (
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
                            <span className={`text-xs transition-colors duration-300 ${
                                notepadSaved ? 'text-[#E0B954]' : 'text-[#737373]'
                            }`}>
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
                                            <div key={i} className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3 text-center">
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
                                                <div key={i} className="h-3 w-16 bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />
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
                                        ].map(s => (
                                            <div key={s.label} className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3 text-center">
                                                <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                                                <div className="text-xs text-[#737373] mt-0.5">{s.label}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Row 2 — Completion progress bar */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs text-[#737373]">Completion</span>
                                            <span className="text-xs font-semibold text-[#34D399]">{overviewStats.completion_pct}%</span>
                                        </div>
                                        <div className="h-2 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${overviewStats.completion_pct}%`, background: 'linear-gradient(90deg, #34D399, #059669)' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Row 3 — Stacked status bar */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs text-[#737373]">Status distribution</span>
                                        </div>
                                        <div className="h-3 rounded-full overflow-hidden flex w-full">
                                            {STATUS_BARS.map(s => {
                                                const count = overviewStats[s.key as keyof typeof overviewStats] as number;
                                                const pct = overviewStats.total > 0 ? (count / overviewStats.total) * 100 : 0;
                                                return pct > 0 ? (
                                                    <div key={s.key} style={{ width: `${pct}%`, backgroundColor: s.color }} title={`${s.label}: ${count}`} />
                                                ) : null;
                                            })}
                                        </div>
                                        <div className="flex flex-wrap gap-3 mt-2">
                                            {STATUS_BARS.map(s => {
                                                const count = overviewStats[s.key as keyof typeof overviewStats] as number;
                                                return (
                                                    <div key={s.key} className="flex items-center gap-1.5">
                                                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                                                        <span className="text-xs text-[#737373]">{s.label} <span className="text-white font-medium">{count}</span></span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Row 4 — Next due */}
                                    {(() => {
                                        const allDue = myTasks
                                            .filter(t => t.due_date && t.status !== 'done')
                                            .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
                                        const dueSoon = showAllDueSoon ? allDue : allDue.slice(0, 4);
                                        return allDue.length > 0 ? (
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs text-[#737373] font-medium">Next due</span>
                                                    <span className="text-xs text-[#737373]">{allDue.length} upcoming</span>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {dueSoon.map(t => (
                                                        <div key={t.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[rgba(255,255,255,0.02)] px-2 py-1 rounded-lg transition-colors" onClick={() => setSelectedTask(t)}>
                                                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLOR[t.status] || '#555' }} />
                                                            <span className="text-[#a3a3a3] truncate flex-1">{t.title}</span>
                                                            <span className={`flex-shrink-0 ${t.is_overdue ? 'text-red-400' : 'text-[#737373]'}`}>
                                                                {new Date(t.due_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {allDue.length > 4 && (
                                                    <button
                                                        onClick={() => setShowAllDueSoon(p => !p)}
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

                </div>{/* end 2×2 grid */}
            </div>

            {/* Jira-style Ticket Slide-in Panel */}
            {selectedTask && (
                <>
                    <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSelectedTask(null)} />
                    <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-[#080808] border-l border-[rgba(255,255,255,0.07)] z-50 flex flex-col shadow-2xl shadow-black/50">
                        {/* Panel Header */}
                        <div className="flex items-start justify-between p-5 border-b border-[rgba(255,255,255,0.05)] sticky top-0 bg-[#080808] flex-shrink-0">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                {(() => {
                                    const tc = TASK_TYPE_CONFIG[selectedTask.type] || TASK_TYPE_CONFIG.task;
                                    return (
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium flex-shrink-0" style={{ backgroundColor: tc.bg, color: tc.color }}>
                                            <tc.icon className="w-4 h-4" />
                                            {tc.label}
                                        </div>
                                    );
                                })()}
                                <span className="text-xs font-mono text-[#E0B954] flex-shrink-0">{selectedTask.key}</span>
                                <button
                                    onClick={() => { navigate(`/project/${selectedTask.project_id}`); setSelectedTask(null); }}
                                    className="flex items-center gap-1 text-xs text-[#737373] hover:text-white ml-auto flex-shrink-0"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Open in project
                                </button>
                            </div>
                            <button onClick={() => setSelectedTask(null)} className="p-1.5 rounded-lg hover:bg-[rgba(244,246,255,0.05)] text-[#737373] hover:text-white ml-3 flex-shrink-0">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Panel Content (scrollable) */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                            {/* Title */}
                            <h2 className="text-lg font-semibold text-white leading-tight">{selectedTask.title}</h2>

                            {/* Breadcrumb (parent/epic) */}
                            {(selectedTask.epic_key || selectedTask.parent_key) && (
                                <div className="flex items-center gap-1.5 text-xs">
                                    {selectedTask.epic_key && (
                                        <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-[rgba(167,139,250,0.12)] text-[#A78BFA]">
                                            <Target className="w-3 h-3" />
                                            {selectedTask.epic_key}
                                        </span>
                                    )}
                                    {selectedTask.parent_key && (
                                        <>
                                            {selectedTask.epic_key && <ChevronRight className="w-3 h-3 text-[#555]" />}
                                            <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-[rgba(224,185,84,0.10)] text-[#E0B954]">
                                                <BookOpen className="w-3 h-3" />
                                                {selectedTask.parent_key}
                                            </span>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Stats grid 2×3 */}
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: 'Status', value: selectedTask.status.replace(/_/g, ' '), color: STATUS_COLOR[selectedTask.status] || '#f5f5f5' },
                                    { label: 'Priority', value: selectedTask.priority, color: PRIORITY_COLORS[selectedTask.priority] || '#f5f5f5' },
                                    { label: 'Story Points', value: String(selectedTask.story_points ?? '-'), color: '#f5f5f5' },
                                    { label: 'Est. Hours', value: selectedTask.assigned_hours ? `${selectedTask.assigned_hours}h` : '-', color: '#a3a3a3' },
                                    { label: 'Logged Hrs', value: selectedTask.logged_hours ? `${selectedTask.logged_hours}h` : '0h', color: '#a3a3a3' },
                                    { label: 'Remaining', value: selectedTask.remaining_hours ? `${selectedTask.remaining_hours}h` : '-', color: '#a3a3a3' },
                                ].map(({ label, value, color }) => (
                                    <div key={label} className="bg-[rgba(255,255,255,0.025)] rounded-xl p-3">
                                        <p className="text-xs text-[#737373] mb-1">{label}</p>
                                        <p className="text-sm font-semibold capitalize" style={{ color }}>{value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Assignee / Due Date / Project */}
                            <div className="space-y-0">
                                {[
                                    { label: 'Assignee', value: selectedTask.assignee || 'Unassigned' },
                                    { label: 'Due Date', value: selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set' },
                                    { label: 'Project', value: selectedTask.project_name },
                                ].map(({ label, value }) => (
                                    <div key={label} className="flex items-center justify-between py-2.5 border-b border-[rgba(255,255,255,0.04)]">
                                        <span className="text-xs text-[#737373]">{label}</span>
                                        <span className="text-sm text-[#f5f5f5]">{value}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Description */}
                            {selectedTask.description && (
                                <div>
                                    <p className="text-xs font-medium text-[#737373] mb-2">Description</p>
                                    <p className="text-sm text-[#a3a3a3] leading-relaxed bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-xl p-4">
                                        {selectedTask.description}
                                    </p>
                                </div>
                            )}

                            {/* Tags */}
                            {selectedTask.tags && selectedTask.tags.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <Tag className="w-3.5 h-3.5 text-[#737373]" />
                                        <p className="text-xs font-medium text-[#737373]">Tags</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedTask.tags.map(tag => (
                                            <span key={tag} className="px-2.5 py-1 rounded-lg bg-[rgba(255,255,255,0.05)] text-[#a3a3a3] text-xs">{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Acceptance Criteria */}
                            {selectedTask.acceptance_criteria && selectedTask.acceptance_criteria.length > 0 && (
                                <div>
                                    <p className="text-xs font-medium text-[#737373] mb-2">Acceptance Criteria</p>
                                    <div className="space-y-1.5">
                                        {selectedTask.acceptance_criteria.map((ac, i) => (
                                            <div key={i} className="flex items-start gap-2 text-sm text-[#a3a3a3]">
                                                <CheckCircle2 className="w-4 h-4 text-[#555] flex-shrink-0 mt-0.5" />
                                                <span className="leading-relaxed">{ac}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex-shrink-0 p-4 border-t border-[rgba(255,255,255,0.05)]">
                            <button
                                onClick={() => { navigate(`/project/${selectedTask.project_id}`); setSelectedTask(null); }}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-[#E0B954] to-[#C79E3B] text-[#080808] font-semibold text-sm hover:opacity-90 transition-opacity"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Open full ticket
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Add Personal Task Dialog */}
            <Dialog open={showAddTaskDialog} onOpenChange={setShowAddTaskDialog}>
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
                                onChange={(e) => setNewPersonalTask({ ...newPersonalTask, description: e.target.value })}
                                placeholder="Add details..."
                                className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white resize-none"
                                rows={3}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-[#737373] mb-1 block">Priority</label>
                                <Select value={newPersonalTask.priority} onValueChange={(v) => setNewPersonalTask({ ...newPersonalTask, priority: v })}>
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
                                <Input
                                    type="date"
                                    value={newPersonalTask.due_date}
                                    onChange={(e) => setNewPersonalTask({ ...newPersonalTask, due_date: e.target.value })}
                                    className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white"
                                />
                            </div>
                        </div>
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
            <Dialog open={showConvertDialog} onOpenChange={(open) => {
                setShowConvertDialog(open);
                if (!open) { setConvertProjectId(''); setConvertAssigneeId(''); setProjectMembers([]); }
            }}>
                <DialogContent className="bg-[#0d0d0d] border-[rgba(255,255,255,0.08)] text-white">
                    <DialogHeader>
                        <DialogTitle>Tag to Project</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        {convertingTask && (
                            <div className="p-3 bg-[#0A0A14] rounded-lg border border-[rgba(255,255,255,0.05)]">
                                <p className="text-white font-medium text-sm">{convertingTask.title}</p>
                                <p className="text-[#737373] text-xs mt-0.5 capitalize">{convertingTask.priority} priority</p>
                            </div>
                        )}
                        <div>
                            <label className="text-xs text-[#737373] mb-1 block">Select Project</label>
                            <Select value={convertProjectId} onValueChange={(v) => {
                                setConvertProjectId(v);
                                setConvertAssigneeId('');
                                fetchProjectMembers(v);
                            }}>
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
                        {projectMembers.length > 0 && (
                            <div>
                                <label className="text-xs text-[#737373] mb-1 block">Assign To <span className="text-[#555]">(optional — defaults to you)</span></label>
                                <Select value={convertAssigneeId} onValueChange={setConvertAssigneeId}>
                                    <SelectTrigger className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white">
                                        <SelectValue placeholder="Select team member..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#0d0d0d] border-[rgba(255,255,255,0.08)]">
                                        {projectMembers.map((member) => (
                                            <SelectItem key={member.id} value={member.id.toString()}>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#E0B954] to-[#C79E3B] flex items-center justify-center text-[#080808] text-xs font-bold">
                                                        {member.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    {member.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {convertAssigneeId && (
                                    <p className="text-xs text-[#E0B954] mt-1">An email notification will be sent to the assignee</p>
                                )}
                            </div>
                        )}
                        <Button
                            onClick={convertToTicket}
                            disabled={convertingTicket || !convertProjectId}
                            className="w-full bg-gradient-to-r from-[#E0B954] to-[#C79E3B] text-[#080808] font-semibold hover:opacity-90"
                        >
                            {convertingTicket ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Project Ticket'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Create Project Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
                    <div
                        className="bg-[#0d0d0d] border border-[rgba(255,255,255,0.07)] rounded-2xl w-full max-w-lg shadow-2xl shadow-black/50"
                        onClick={e => e.stopPropagation()}
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
                                <label className="text-sm font-medium text-[#a3a3a3] block mb-2">Project Name *</label>
                                <Input
                                    placeholder="e.g. Mobile App Redesign"
                                    value={createForm.name}
                                    onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl h-11 focus:border-[#E0B954]/50 placeholder:text-[#334155]"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-[#a3a3a3] block mb-2">Description</label>
                                <Textarea
                                    placeholder="Brief description of the project goals..."
                                    value={createForm.description}
                                    onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                                    className="bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl min-h-[80px] focus:border-[#E0B954]/50 placeholder:text-[#334155] resize-none"
                                />
                            </div>

                            {/* GitHub Repository */}
                            <div>
                                <label className="text-sm font-medium text-[#a3a3a3] block mb-2">
                                    GitHub Repository URL
                                    <span className="text-[#737373] text-xs ml-2">(Optional - for sending invitations)</span>
                                </label>
                                <Input
                                    placeholder="https://github.com/owner/repo"
                                    value={createForm.github_repo_url}
                                    onChange={(e) => setCreateForm(prev => ({ ...prev, github_repo_url: e.target.value }))}
                                    className="bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl h-11 focus:border-[#E0B954]/50 placeholder:text-[#334155]"
                                />
                                <p className="text-xs text-[#737373] mt-1.5">
                                    Enter the GitHub repo URL to automatically send invitations to assigned developers
                                </p>
                            </div>

                            {/* Developer Assignment Section */}
                            <div className="border-t border-[rgba(255,255,255,0.05)] pt-5">
                                <label className="text-sm font-medium text-[#a3a3a3] block mb-3">Assign Developers</label>
                                
                                {/* Add Developer Form */}
                                <div className="space-y-3">
                                    <Select value={selectedDeveloperId} onValueChange={setSelectedDeveloperId}>
                                        <SelectTrigger className="bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl h-11 focus:border-[#E0B954]/50">
                                            <SelectValue placeholder="Select a developer" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#1a1d29] border-[rgba(255,255,255,0.07)]">
                                            {availableDevelopers
                                                .filter(dev => !selectedDevelopers.find(sd => sd.developer_id === dev.id))
                                                .map(dev => (
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
                                                            <span className="text-[#E0B954] text-xs ml-1">@{dev.github_username}</span>
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
                                            const developerInfo = availableDevelopers.find(d => d.id === dev.developer_id);
                                            return (
                                                <div key={dev.developer_id} className="bg-[rgba(255,255,255,0.025)] border border-[rgba(255,255,255,0.05)] rounded-xl p-3">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#E0B954]/20 to-[#B8872A]/10 flex items-center justify-center">
                                                                <User className="w-4 h-4 text-[#E0B954]" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-[#F4F6FF]">{developerInfo?.name}</p>
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
                                                        <p className="text-xs text-[#737373] mt-2 ml-10">{dev.responsibilities}</p>
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
