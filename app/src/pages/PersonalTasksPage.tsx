import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    CheckCircle2,
    Circle,
    Trash2,
    Edit2,
    ArrowLeft,
    Calendar,
    Flag,
    Search,
    Filter,
    LogOut,
    Settings,
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
import { API_BASE_URL } from '@/config/api';

// Helper function to parse YYYY-MM-DD string to local Date object (avoids UTC timezone issues)
const parseLocalDate = (dateString: string | undefined): Date | undefined => {
    if (!dateString) return undefined;
    const [year, month, day] = dateString.split('-');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
};

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
    created_at: string;
}

const PersonalTasksPage = () => {
    const navigate = useNavigate();
    const { user, token, logout } = useAuth();
    const [tasks, setTasks] = useState<PersonalTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'todo' | 'done'>('all');
    const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'priority'>('date-desc');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingTask, setEditingTask] = useState<PersonalTask | null>(null);
    const [showDatePickerAdd, setShowDatePickerAdd] = useState(false);
    const [showDatePickerEdit, setShowDatePickerEdit] = useState(false);
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        priority: 'medium',
        due_date: '',
    });

    const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
        critical: { color: '#EF4444', label: 'Critical' },
        high: { color: '#F97316', label: 'High' },
        medium: { color: '#F59E0B', label: 'Medium' },
        low: { color: '#737373', label: 'Low' },
    };

    // Fetch tasks
    const fetchTasks = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/personal-tasks/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setTasks(await response.json());
            }
        } catch (err) {
            console.error('Failed to fetch tasks:', err);
            toast.error('Failed to load tasks');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchTasks();
        }
    }, [token]);

    // Toggle task completion
    const toggleTaskComplete = async (task: PersonalTask) => {
        if (task.is_converted) {
            toast.error('Cannot modify a converted task');
            return;
        }

        const newStatus = task.status === 'done' ? 'todo' : 'done';
        try {
            const response = await fetch(`${API_BASE_URL}/api/personal-tasks/${task.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                setTasks(tasks.map(t => 
                    t.id === task.id ? { ...t, status: newStatus } : t
                ));
                toast.success(newStatus === 'done' ? 'Task completed! 🎉' : 'Task reopened');
            } else {
                toast.error('Failed to update task');
            }
        } catch (err) {
            toast.error('Failed to update task');
        }
    };

    // Create task
    const createTask = async () => {
        if (!newTask.title.trim()) {
            toast.error('Title is required');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/personal-tasks/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: newTask.title,
                    description: newTask.description,
                    priority: newTask.priority,
                    due_date: newTask.due_date || undefined
                })
            });

            if (response.ok) {
                const createdTask = await response.json();
                setTasks([createdTask, ...tasks]);
                setNewTask({ title: '', description: '', priority: 'medium', due_date: '' });
                setShowAddDialog(false);
                toast.success('Task created!');
            }
        } catch (err) {
            toast.error('Failed to create task');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Update task
    const updateTask = async () => {
        if (!editingTask || !newTask.title.trim()) {
            toast.error('Title is required');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/personal-tasks/${editingTask.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: newTask.title,
                    description: newTask.description,
                    priority: newTask.priority,
                    due_date: newTask.due_date || undefined
                })
            });

            if (response.ok) {
                const updatedTask = await response.json();
                setTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t));
                resetForm();
                toast.success('Task updated!');
            }
        } catch (err) {
            toast.error('Failed to update task');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Delete task
    const deleteTask = async (taskId: number) => {
        if (!confirm('Delete this task?')) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/personal-tasks/${taskId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                setTasks(tasks.filter(t => t.id !== taskId));
                toast.success('Task deleted');
            }
        } catch (err) {
            toast.error('Failed to delete task');
        }
    };

    const resetForm = () => {
        setNewTask({ title: '', description: '', priority: 'medium', due_date: '' });
        setEditingTask(null);
        setShowEditDialog(false);
    };

    const startEdit = (task: PersonalTask) => {
        setEditingTask(task);
        setNewTask({
            title: task.title,
            description: task.description,
            priority: task.priority,
            due_date: task.due_date || '',
        });
        setShowEditDialog(true);
    };

    // Filter and sort tasks
    let filteredTasks = tasks.filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
        const notConverted = !t.is_converted;
        return matchesSearch && matchesStatus && notConverted;
    });

    if (sortBy === 'date-asc') {
        filteredTasks.sort((a, b) => {
            // Completed tasks always last
            if (a.status === 'done' && b.status !== 'done') return 1;
            if (a.status !== 'done' && b.status === 'done') return -1;
            return new Date(a.due_date || '9999-12-31').getTime() - new Date(b.due_date || '9999-12-31').getTime();
        });
    } else if (sortBy === 'date-desc') {
        filteredTasks.sort((a, b) => {
            // Completed tasks always last
            if (a.status === 'done' && b.status !== 'done') return 1;
            if (a.status !== 'done' && b.status === 'done') return -1;
            return new Date(b.due_date || '9999-12-31').getTime() - new Date(a.due_date || '9999-12-31').getTime();
        });
    } else if (sortBy === 'priority') {
        const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        filteredTasks.sort((a, b) => {
            // Completed tasks always last
            if (a.status === 'done' && b.status !== 'done') return 1;
            if (a.status !== 'done' && b.status === 'done') return -1;
            const aPriority = priorityOrder[a.priority?.toLowerCase() || 'medium'] ?? 999;
            const bPriority = priorityOrder[b.priority?.toLowerCase() || 'medium'] ?? 999;
            return aPriority - bPriority;
        });
    }

    const stats = {
        total: tasks.filter(t => !t.is_converted).length,
        completed: tasks.filter(t => t.status === 'done' && !t.is_converted).length,
        pending: tasks.filter(t => t.status !== 'done' && !t.is_converted).length,
    };

    return (
        <div className="min-h-screen bg-[#080808] text-[#F4F6FF]">
            <Toaster position="top-right" theme="dark" richColors />

            {/* Header */}
            <header className="border-b border-[rgba(255,255,255,0.05)] bg-[#080808]/90 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-[1400px] mx-auto px-8 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/')}
                            className="p-2 rounded-lg hover:bg-[rgba(244,246,255,0.05)] text-[#737373] hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-white">Personal Tasks</h1>
                            <p className="text-xs text-[#737373] font-medium">Manage your personal tasks</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {user && (
                            <div className="flex items-center gap-2 mr-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E0B954] to-[#B8872A] flex items-center justify-center text-[#080808] text-sm font-medium">
                                    {user.name?.charAt(0).toUpperCase()}
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
                    </div>
                </div>
            </header>

            <div className="max-w-[1200px] mx-auto px-8 py-8">
                {/* Stats Bar */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    {[
                        { label: 'Total Tasks', value: stats.total, color: '#E0B954' },
                        { label: 'Pending', value: stats.pending, color: '#F59E0B' },
                        { label: 'Completed', value: stats.completed, color: '#34D399' },
                    ].map(stat => (
                        <div key={stat.label} className="relative group">
                            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[rgba(224,185,84,0.08)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className="relative bg-[rgba(255,255,255,0.025)] border border-[rgba(255,255,255,0.05)] rounded-2xl p-5 transition-all duration-300 group-hover:border-[rgba(224,185,84,0.2)]">
                                <div className="text-sm text-[#737373] font-medium mb-2">{stat.label}</div>
                                <div className="text-3xl font-bold" style={{ color: stat.color }}>
                                    {stat.value}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Toolbar */}
                <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 mb-8">
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                        <div className="flex-1 flex flex-col md:flex-row gap-3 w-full md:w-auto">
                            {/* Search */}
                            <div className="relative flex-1 md:flex-initial md:w-48">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
                                <Input
                                    placeholder="Search tasks..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-lg h-10 text-sm focus:border-[#E0B954]/50"
                                />
                            </div>

                            {/* Filter */}
                            <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                                <SelectTrigger className="w-full md:w-40 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] h-10">
                                    <Filter className="w-4 h-4 mr-2" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1a1a1a] border-[rgba(255,255,255,0.07)]">
                                    <SelectItem value="all">All Tasks</SelectItem>
                                    <SelectItem value="todo">Pending</SelectItem>
                                    <SelectItem value="done">Completed</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Sort */}
                            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                                <SelectTrigger className="w-full md:w-40 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] h-10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1a1a1a] border-[rgba(255,255,255,0.07)]">
                                    <SelectItem value="date-desc">Newest First</SelectItem>
                                    <SelectItem value="date-asc">Oldest First</SelectItem>
                                    <SelectItem value="priority">By Priority</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            onClick={() => {
                                resetForm();
                                setShowAddDialog(true);
                            }}
                            className="w-full md:w-auto bg-gradient-to-r from-[#E0B954] to-[#C79E3B] text-[#080808] font-semibold hover:opacity-90 rounded-xl"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            New Task
                        </Button>
                    </div>
                </div>

                {/* Task List */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-6 h-6 border-2 border-[#E0B954]/30 border-t-[#E0B954] rounded-full animate-spin" />
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <div className="text-center py-20">
                        <CheckCircle2 className="w-12 h-12 text-[#E0B954]/30 mx-auto mb-3" />
                        <p className="text-[#737373]">
                            {tasks.length === 0 ? 'No tasks yet. Create one to get started!' : 'No tasks match your filters.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredTasks.map(task => (
                            <div
                                key={task.id}
                                className={`group relative bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 transition-all duration-300 hover:border-[rgba(224,185,84,0.2)] hover:bg-[rgba(255,255,255,0.035)] ${
                                    task.status === 'done' ? 'opacity-60' : ''
                                }`}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Checkbox */}
                                    <button
                                        onClick={() => toggleTaskComplete(task)}
                                        className="flex-shrink-0 mt-1 text-[#737373] hover:text-[#E0B954] transition-colors"
                                        title={task.status === 'done' ? 'Mark as pending' : 'Mark as complete'}
                                    >
                                        {task.status === 'done' ? (
                                            <CheckCircle2 className="w-5 h-5" />
                                        ) : (
                                            <Circle className="w-5 h-5" />
                                        )}
                                    </button>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`font-semibold text-white ${task.status === 'done' ? 'line-through text-[#737373]' : ''}`}>
                                            {task.title}
                                        </h3>
                                        {task.description && (
                                            <p className="text-sm text-[#a3a3a3] mt-1 line-clamp-2">
                                                {task.description}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {task.due_date && (
                                                <div className="flex items-center gap-1 text-xs text-[#737373]">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(task.due_date).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}
                                                </div>
                                            )}
                                            {task.estimated_hours > 0 && (
                                                <Badge variant="outline" className="text-xs bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)]">
                                                    {task.estimated_hours}h
                                                </Badge>
                                            )}
                                            <Badge
                                                variant="outline"
                                                className="text-xs"
                                                style={{
                                                    borderColor: PRIORITY_CONFIG[task.priority]?.color + '40',
                                                    color: PRIORITY_CONFIG[task.priority]?.color,
                                                    backgroundColor: PRIORITY_CONFIG[task.priority]?.color + '15',
                                                }}
                                            >
                                                <Flag className="w-3 h-3 mr-1" />
                                                {PRIORITY_CONFIG[task.priority]?.label}
                                            </Badge>
                                            {task.is_converted && (
                                                <Badge className="text-xs bg-[#34D399]/20 text-[#34D399] border-0">
                                                    Converted
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    {!task.is_converted && (
                                        <div className="flex-shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => startEdit(task)}
                                                className="p-2 rounded-lg hover:bg-[rgba(244,246,255,0.08)] text-[#737373] hover:text-[#E0B954] transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => deleteTask(task.id)}
                                                className="p-2 rounded-lg hover:bg-red-500/10 text-[#737373] hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Task Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="bg-[#0d0d0d] border-[rgba(255,255,255,0.08)] text-white">
                    <DialogHeader>
                        <DialogTitle>Create Personal Task</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="text-xs text-[#737373] mb-1 block">Title *</label>
                            <Input
                                value={newTask.title}
                                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                placeholder="What needs to be done?"
                                className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-[#737373] mb-1 block">Description</label>
                            <Textarea
                                value={newTask.description}
                                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                placeholder="Add details..."
                                className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white resize-none"
                                rows={3}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-[#737373] mb-1 block">Priority</label>
                                <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                                    <SelectTrigger className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white h-10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)]">
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="critical">Critical</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs text-[#737373] mb-1 block">Due Date</label>
                                <Popover open={showDatePickerAdd} onOpenChange={setShowDatePickerAdd}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start text-left font-normal bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white hover:bg-[#0A0A14] hover:text-white h-10"
                                        >
                                            <Calendar className="w-4 h-4 mr-2" />
                                            {newTask.due_date ? parseLocalDate(newTask.due_date)?.toLocaleDateString() : 'Pick a date'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 bg-[#0A0A14] border-[rgba(255,255,255,0.08)]">
                                        <CalendarIcon
                                            mode="single"
                                            selected={parseLocalDate(newTask.due_date)}
                                            onSelect={(date) => {
                                                if (date) {
                                                    const year = date.getFullYear();
                                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                                    const day = String(date.getDate()).padStart(2, '0');
                                                    const localDate = `${year}-${month}-${day}`;
                                                    setNewTask({ ...newTask, due_date: localDate });
                                                    setShowDatePickerAdd(false);
                                                }
                                            }}
                                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                            classNames={{
                                                months: "flex flex-col",
                                                month: "space-y-4",
                                                caption: "flex justify-between items-center px-0 pb-4 relative h-7 mb-2",
                                                caption_label: "text-sm font-medium text-white",
                                                nav: "space-x-1 flex items-center",
                                                nav_button: "text-white hover:bg-[rgba(224,185,84,0.1)] rounded p-1",
                                                nav_button_previous: "absolute left-0",
                                                nav_button_next: "absolute right-0",
                                                table: "w-full border-collapse space-y-1",
                                                head_row: "flex",
                                                head_cell: "text-white rounded-md w-9 font-normal text-[0.8rem]",
                                                row: "flex w-full mt-2",
                                                cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-slate-900/20 [&:has([aria-selected])]:bg-slate-900 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                                                day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-md text-white hover:bg-[rgba(224,185,84,0.2)]",
                                                day_range_end: "day-range-end",
                                                day_selected: "bg-[#E0B954] text-black hover:bg-[#E0B954] hover:text-black focus:bg-[#E0B954] focus:text-black",
                                                day_today: "bg-[rgba(224,185,84,0.2)] text-white",
                                                day_outside: "day-outside text-slate-500 aria-selected:bg-slate-900/20 aria-selected:text-slate-400",
                                                day_disabled: "text-slate-500",
                                                day_range_middle: "aria-selected:bg-slate-900 aria-selected:text-white",
                                            }}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        <Button
                            onClick={createTask}
                            disabled={isSubmitting || !newTask.title.trim()}
                            className="w-full bg-gradient-to-r from-[#E0B954] to-[#C79E3B] text-[#080808] font-semibold hover:opacity-90"
                        >
                            {isSubmitting ? 'Creating...' : 'Create Task'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Task Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="bg-[#0d0d0d] border-[rgba(255,255,255,0.08)] text-white">
                    <DialogHeader>
                        <DialogTitle>Edit Personal Task</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="text-xs text-[#737373] mb-1 block">Title *</label>
                            <Input
                                value={newTask.title}
                                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                placeholder="What needs to be done?"
                                className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-[#737373] mb-1 block">Description</label>
                            <Textarea
                                value={newTask.description}
                                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                placeholder="Add details..."
                                className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white resize-none"
                                rows={3}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-[#737373] mb-1 block">Priority</label>
                                <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                                    <SelectTrigger className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white h-10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)]">
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="critical">Critical</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs text-[#737373] mb-1 block">Due Date</label>
                                <Popover open={showDatePickerEdit} onOpenChange={setShowDatePickerEdit}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start text-left font-normal bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white hover:bg-[#0A0A14] hover:text-white h-10"
                                        >
                                            <Calendar className="w-4 h-4 mr-2" />
                                            {newTask.due_date ? parseLocalDate(newTask.due_date)?.toLocaleDateString() : 'Pick a date'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 bg-[#0A0A14] border-[rgba(255,255,255,0.08)]">
                                        <CalendarIcon
                                            mode="single"
                                            selected={parseLocalDate(newTask.due_date)}
                                            onSelect={(date) => {
                                                if (date) {
                                                    const year = date.getFullYear();
                                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                                    const day = String(date.getDate()).padStart(2, '0');
                                                    const localDate = `${year}-${month}-${day}`;
                                                    setNewTask({ ...newTask, due_date: localDate });
                                                    setShowDatePickerEdit(false);
                                                }
                                            }}
                                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                            classNames={{
                                                months: "flex flex-col",
                                                month: "space-y-4",
                                                caption: "flex justify-between items-center px-0 pb-4 relative h-7 mb-2",
                                                caption_label: "text-sm font-medium text-white",
                                                nav: "space-x-1 flex items-center",
                                                nav_button: "text-white hover:bg-[rgba(224,185,84,0.1)] rounded p-1",
                                                nav_button_previous: "absolute left-0",
                                                nav_button_next: "absolute right-0",
                                                table: "w-full border-collapse space-y-1",
                                                head_row: "flex",
                                                head_cell: "text-white rounded-md w-9 font-normal text-[0.8rem]",
                                                row: "flex w-full mt-2",
                                                cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-slate-900/20 [&:has([aria-selected])]:bg-slate-900 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                                                day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-md text-white hover:bg-[rgba(224,185,84,0.2)]",
                                                day_range_end: "day-range-end",
                                                day_selected: "bg-[#E0B954] text-black hover:bg-[#E0B954] hover:text-black focus:bg-[#E0B954] focus:text-black",
                                                day_today: "bg-[rgba(224,185,84,0.2)] text-white",
                                                day_outside: "day-outside text-slate-500 aria-selected:bg-slate-900/20 aria-selected:text-slate-400",
                                                day_disabled: "text-slate-500",
                                                day_range_middle: "aria-selected:bg-slate-900 aria-selected:text-white",
                                            }}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button
                                onClick={updateTask}
                                disabled={isSubmitting}
                                className="flex-1 bg-gradient-to-r from-[#E0B954] to-[#C79E3B] text-[#080808] font-semibold hover:opacity-90"
                            >
                                {isSubmitting ? 'Saving...' : 'Save Changes'}
                            </Button>
                            <Button
                                onClick={resetForm}
                                disabled={isSubmitting}
                                variant="outline"
                                className="flex-1 bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white hover:bg-[#0A0A14] hover:text-white"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default PersonalTasksPage;
