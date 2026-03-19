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
} from 'lucide-react';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
    Tooltip, ResponsiveContainer, Legend
} from 'recharts';
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
    is_overdue: boolean;
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
    const [myTaskTab, setMyTaskTab] = useState<'upcoming' | 'overdue' | 'completed'>('upcoming');
    const [myTasksLoading, setMyTasksLoading] = useState(false);
    const [showAllTasks, setShowAllTasks] = useState(false);

    // Private Notepad
    const [notepadContent, setNotepadContent] = useState('');
    const [notepadSaved, setNotepadSaved] = useState(true);

    // Analytics
    const [analyticsTab, setAnalyticsTab] = useState<'status' | 'priority' | 'projects'>('status');

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
        if (token) fetchMyTasks();
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

    // Computed chart data
    const statusChartData = [
        { name: 'Done', value: myTasks.filter(t => t.status === 'done').length, color: '#E0B954' },
        { name: 'In Progress', value: myTasks.filter(t => t.status === 'in_progress').length, color: '#F59E0B' },
        { name: 'In Review', value: myTasks.filter(t => t.status === 'in_review').length, color: '#C79E3B' },
        { name: 'To Do', value: myTasks.filter(t => t.status === 'todo').length, color: '#737373' },
        { name: 'Backlog', value: myTasks.filter(t => t.status === 'backlog').length, color: '#444' },
    ].filter(d => d.value > 0);

    const priorityChartData = [
        { name: 'Critical', count: myTasks.filter(t => t.priority === 'critical').length, color: '#EF4444' },
        { name: 'High', count: myTasks.filter(t => t.priority === 'high').length, color: '#F97316' },
        { name: 'Medium', count: myTasks.filter(t => t.priority === 'medium').length, color: '#F59E0B' },
        { name: 'Low', count: myTasks.filter(t => t.priority === 'low').length, color: '#737373' },
    ].filter(d => d.count > 0);

    const projectChartData = Object.entries(
        myTasks.reduce((acc, t) => {
            acc[t.project_name] = (acc[t.project_name] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)
    ).map(([name, tasks]) => ({ name: name.length > 14 ? name.substring(0, 14) + '…' : name, tasks })).slice(0, 6);

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
                                <div className="text-3xl font-bold text-white tracking-tight">{stat.value}</div>
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
                                <div className="flex items-center gap-2 text-xs text-[#737373]">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[#E0B954]" />
                                    <span>{myTasks.filter(t => t.status === 'done').length} completed</span>
                                </div>
                            </div>

                            {/* Sub-tabs */}
                            <div className="flex gap-0 px-5 border-b border-[rgba(255,255,255,0.05)] flex-shrink-0">
                                {(['upcoming', 'overdue', 'completed'] as const).map(tab => {
                                    const count = tab === 'upcoming'
                                        ? myTasks.filter(t => t.status !== 'done' && !t.is_overdue).length
                                        : tab === 'overdue'
                                        ? myTasks.filter(t => t.is_overdue).length
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
                                            ) : (
                                                <span className="capitalize">{tab}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Task list */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-0.5">
                                {myTasksLoading ? (
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
                                            onClick={() => navigate(`/project/${task.project_id}`)}
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
                                    {user?.role === 'admin' && (
                                        <button
                                            onClick={() => setShowCreateModal(true)}
                                            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border border-dashed border-[rgba(255,255,255,0.06)] hover:border-[#E0B954]/30 hover:bg-[#E0B954]/5 transition-all group"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.03)] flex items-center justify-center group-hover:bg-[#E0B954]/10 transition-colors flex-shrink-0">
                                                <Plus className="w-4 h-4 text-[#737373] group-hover:text-[#E0B954]" />
                                            </div>
                                            <span className="text-sm text-[#737373] group-hover:text-[#E0B954] transition-colors">Create project</span>
                                        </button>
                                    )}
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
                                <div className="flex gap-1">
                                    {(['status', 'priority', 'projects'] as const).map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setAnalyticsTab(t)}
                                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                                analyticsTab === t
                                                    ? 'bg-[#E0B954]/15 text-[#E0B954]'
                                                    : 'text-[#737373] hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
                                            }`}
                                        >
                                            {t === 'status' ? 'By Status' : t === 'priority' ? 'By Priority' : 'By Project'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex-1 min-h-0 p-4">
                                {myTasks.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <BarChart3 className="w-10 h-10 text-[#E0B954]/20 mb-2" />
                                        <p className="text-sm text-[#737373]">No task data yet</p>
                                        <p className="text-xs text-[#555] mt-1">Tasks assigned to you will appear here</p>
                                    </div>
                                ) : analyticsTab === 'status' ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                                                {statusChartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ background: '#121212', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#f5f5f5', fontSize: '12px' }} />
                                            <Legend wrapperStyle={{ color: '#a3a3a3', fontSize: '11px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : analyticsTab === 'priority' ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={priorityChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                            <XAxis dataKey="name" tick={{ fill: '#737373', fontSize: 11 }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fill: '#737373', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <Tooltip contentStyle={{ background: '#121212', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#f5f5f5', fontSize: '12px' }} />
                                            <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Tasks">
                                                {priorityChartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={projectChartData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                                            <XAxis type="number" tick={{ fill: '#737373', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <YAxis type="category" dataKey="name" tick={{ fill: '#a3a3a3', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                                            <Tooltip contentStyle={{ background: '#121212', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#f5f5f5', fontSize: '12px' }} />
                                            <Bar dataKey="tasks" fill="#E0B954" radius={[0, 4, 4, 0]} name="Tasks" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                    </div>

                </div>{/* end 2×2 grid */}
            </div>

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
