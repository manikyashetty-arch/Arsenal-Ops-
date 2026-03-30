import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { API_BASE_URL } from '@/config/api';
import { Plus, Briefcase, CheckCircle2, Calendar, ArrowRight, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface PersonalTask {
    id: number;
    title: string;
    description: string;
    status: 'todo' | 'in_progress' | 'done';
    priority: 'low' | 'medium' | 'high' | 'critical';
    estimated_hours: number;
    due_date?: string;
    tags: string[];
    is_converted: boolean;
    project_id?: number;
    work_item_id?: number;
    created_at: string;
}

interface Project {
    id: number;
    name: string;
    key_prefix: string;
}

interface PersonalTasksProps {
    token: string;
}

export default function PersonalTasks({ token }: PersonalTasksProps) {
    const [tasks, setTasks] = useState<PersonalTask[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showConvertDialog, setShowConvertDialog] = useState(false);
    const [selectedTask, setSelectedTask] = useState<PersonalTask | null>(null);
    
    // Form states
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        priority: 'medium',
        estimated_hours: 0,
        due_date: '',
    });
    const [convertProjectId, setConvertProjectId] = useState('');

    useEffect(() => {
        fetchTasks();
        fetchProjects();
    }, []);

    const fetchTasks = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/personal-tasks/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setTasks(await res.json());
            }
        } catch (err) {
            console.error('Failed to fetch personal tasks:', err);
        }
    };

    const fetchProjects = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setProjects(await res.json());
            }
        } catch (err) {
            console.error('Failed to fetch projects:', err);
        }
    };

    const createTask = async () => {
        if (!newTask.title.trim()) {
            toast.error('Title is required');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/personal-tasks/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...newTask,
                    due_date: newTask.due_date || undefined,
                })
            });

            if (res.ok) {
                toast.success('Task created successfully');
                setShowAddDialog(false);
                setNewTask({ title: '', description: '', priority: 'medium', estimated_hours: 0, due_date: '' });
                fetchTasks();
            } else {
                toast.error('Failed to create task');
            }
        } catch (err) {
            toast.error('Failed to create task');
        } finally {
            setLoading(false);
        }
    };

    const convertToTicket = async () => {
        if (!selectedTask || !convertProjectId) return;

        setLoading(true);
        try {
            const res = await fetch(
                `${API_BASE_URL}/api/personal-tasks/${selectedTask.id}/convert-to-ticket`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        project_id: parseInt(convertProjectId),
                        type: 'task',
                    })
                }
            );

            if (res.ok) {
                const data = await res.json();
                toast.success(`Converted to ${data.work_item.key}`);
                setShowConvertDialog(false);
                setSelectedTask(null);
                setConvertProjectId('');
                fetchTasks();
            } else {
                toast.error('Failed to convert task');
            }
        } catch (err) {
            toast.error('Failed to convert task');
        } finally {
            setLoading(false);
        }
    };

    const deleteTask = async (taskId: number) => {
        if (!confirm('Are you sure you want to delete this task?')) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/personal-tasks/${taskId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                toast.success('Task deleted');
                fetchTasks();
            }
        } catch (err) {
            toast.error('Failed to delete task');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'done': return 'bg-green-500/20 text-green-400';
            case 'in_progress': return 'bg-yellow-500/20 text-yellow-400';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical': return 'bg-red-500/20 text-red-400';
            case 'high': return 'bg-orange-500/20 text-orange-400';
            case 'medium': return 'bg-yellow-500/20 text-yellow-400';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    const activeTasks = tasks.filter(t => !t.is_converted);
    const convertedTasks = tasks.filter(t => t.is_converted);

    return (
        <Card className="bg-[#0d0d0d] border-[rgba(255,255,255,0.08)]">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    My Personal Tasks
                </CardTitle>
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="bg-[#E0B954] hover:bg-[#C79E3B] text-black">
                            <Plus className="w-4 h-4 mr-1" />
                            Add Task
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#0d0d0d] border-[rgba(255,255,255,0.08)] text-white">
                        <DialogHeader>
                            <DialogTitle>Create Personal Task</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                            <div>
                                <label className="text-sm text-[#737373]">Title</label>
                                <Input
                                    value={newTask.title}
                                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                    placeholder="What needs to be done?"
                                    className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-[#737373]">Description</label>
                                <Textarea
                                    value={newTask.description}
                                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                    placeholder="Add details..."
                                    className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-[#737373]">Priority</label>
                                    <Select
                                        value={newTask.priority}
                                        onValueChange={(v) => setNewTask({ ...newTask, priority: v })}
                                    >
                                        <SelectTrigger className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white">
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
                                    <label className="text-sm text-[#737373]">Estimated Hours</label>
                                    <Input
                                        type="number"
                                        value={newTask.estimated_hours}
                                        onChange={(e) => setNewTask({ ...newTask, estimated_hours: parseInt(e.target.value) || 0 })}
                                        className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm text-[#737373]">Due Date</label>
                                <Input
                                    type="date"
                                    value={newTask.due_date}
                                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                                    className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white"
                                />
                            </div>
                            <Button
                                onClick={createTask}
                                disabled={loading}
                                className="w-full bg-[#E0B954] hover:bg-[#C79E3B] text-black"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Task'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                {/* Active Tasks */}
                <div className="space-y-3">
                    {activeTasks.length === 0 ? (
                        <div className="text-center py-8 text-[#737373]">
                            <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No personal tasks yet</p>
                            <p className="text-sm">Create a task to get started</p>
                        </div>
                    ) : (
                        activeTasks.map((task) => (
                            <div
                                key={task.id}
                                className="p-4 bg-[#0A0A14] rounded-lg border border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)] transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h4 className="text-white font-medium mb-1">{task.title}</h4>
                                        {task.description && (
                                            <p className="text-[#737373] text-sm mb-2 line-clamp-2">{task.description}</p>
                                        )}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge className={getStatusColor(task.status)}>
                                                {task.status}
                                            </Badge>
                                            <Badge className={getPriorityColor(task.priority)}>
                                                {task.priority}
                                            </Badge>
                                            {task.estimated_hours > 0 && (
                                                <span className="text-[#737373] text-xs">{task.estimated_hours}h</span>
                                            )}
                                            {task.due_date && (
                                                <span className="text-[#737373] text-xs flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(task.due_date).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedTask(task);
                                                setShowConvertDialog(true);
                                            }}
                                            className="text-[#E0B954] hover:text-[#C79E3B] hover:bg-[#E0B954]/10"
                                        >
                                            <ArrowRight className="w-4 h-4 mr-1" />
                                            Convert
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => deleteTask(task.id)}
                                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Converted Tasks */}
                {convertedTasks.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-[rgba(255,255,255,0.05)]">
                        <h4 className="text-[#737373] text-sm font-medium mb-3">Converted to Project Tickets</h4>
                        <div className="space-y-2">
                            {convertedTasks.map((task) => (
                                <div
                                    key={task.id}
                                    className="p-3 bg-[#0A0A14] rounded-lg border border-[rgba(255,255,255,0.05)] opacity-60"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-white line-through">{task.title}</span>
                                        <Badge className="bg-green-500/20 text-green-400">
                                            Converted
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>

            {/* Convert Dialog */}
            <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
                <DialogContent className="bg-[#0d0d0d] border-[rgba(255,255,255,0.08)] text-white">
                    <DialogHeader>
                        <DialogTitle>Convert to Project Ticket</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        {selectedTask && (
                            <div className="p-3 bg-[#0A0A14] rounded border border-[rgba(255,255,255,0.05)]">
                                <p className="text-white font-medium">{selectedTask.title}</p>
                                <p className="text-[#737373] text-sm">{selectedTask.estimated_hours}h · {selectedTask.priority}</p>
                            </div>
                        )}
                        <div>
                            <label className="text-sm text-[#737373]">Select Project</label>
                            <Select value={convertProjectId} onValueChange={setConvertProjectId}>
                                <SelectTrigger className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)] text-white">
                                    <SelectValue placeholder="Choose a project..." />
                                </SelectTrigger>
                                <SelectContent className="bg-[#0A0A14] border-[rgba(255,255,255,0.08)]">
                                    {projects.map((project) => (
                                        <SelectItem key={project.id} value={project.id.toString()}>
                                            {project.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            onClick={convertToTicket}
                            disabled={loading || !convertProjectId}
                            className="w-full bg-[#E0B954] hover:bg-[#C79E3B] text-black"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Convert to Ticket'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
