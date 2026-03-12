import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Plus,
    Sparkles,
    BookOpen,
    ClipboardList,
    Bug,
    Target,
    Clock,
    CheckCircle2,
    X,
    Save,
    Trash2,
    Pencil,
    Search,
    LayoutGrid,
    List,
    Layers,
    BarChart3,
    AlertCircle,
    MessageSquare,
    Upload,
    FileText,
    ArrowRight,
    Users,
    GitCommit,
    Inbox,
    Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast, Toaster } from 'sonner';
import ArchitectureCard from '@/components/ArchitectureCard';
import ArchitectureEditor from '@/components/ArchitectureEditor';
import { useAuth } from '@/contexts/AuthContext';

import { API_BASE_URL } from '@/config/api';

interface WorkItem {
    id: string;
    type: 'user_story' | 'task' | 'bug' | 'epic';
    title: string;
    description: string;
    status: 'todo' | 'in_progress' | 'in_review' | 'done';
    assigned_hours: number;
    remaining_hours: number;
    logged_hours: number;
    story_points: number;
    priority: 'high' | 'medium' | 'low' | 'critical';
    assignee: string;
    assignee_id: number | null;
    sprint: string;
    sprint_id: number | null;
    product_id: string;
    tags: string[];
    epic: string;
    created_at?: string;
    updated_at?: string;
}

interface Developer {
    id: number;
    name: string;
    email: string;
    github_username?: string;
    role: string;
    responsibilities?: string;
}

interface Project {
    id: number;
    name: string;
    description: string;
    key_prefix: string;
    status: string;
    created_at: string;
    work_item_stats: {
        total: number;
        by_status: Record<string, number>;
        total_points: number;
        completed: number;
        completion_pct: number;
    };
    developers?: Developer[];
}

interface Architecture {
    id: number;
    name: string;
    description: string;
    architecture_type: string;
    mermaid_code: string;
    pros: string[];
    cons: string[];
    estimated_cost: string;
    complexity: string;
    time_to_implement: string;
    is_selected: boolean;
}

interface PRDAnalysis {
    id: number;
    summary: string;
    key_features: string[];
    technical_requirements: string[];
    cost_analysis: any;
    recommended_tools: any;
    risks: any[];
    timeline: any[];
}

interface GeneratedTicket {
    title: string;
    description: string;
    type: string;
    priority: string;
    story_points: number;
    estimated_hours: number;
    assignee_name: string;
    assignee_id: number | null;
    assignee_reasoning: string;
    tags: string[];
    sprint_number?: number;
    sprint_name?: string;
}

interface Sprint {
    id: number;
    name: string;
    goal: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    capacity_hours: number | null;
    velocity: number | null;
    total_items: number;
    todo_count: number;
    in_progress_count: number;
    done_count: number;
    total_points: number;
    completed_points: number;
    completion_pct: number;
}

type AIStep = 'upload' | 'analyzing' | 'architectures' | 'preview' | 'committing' | 'done';

const STATUS_CONFIG = {
    backlog: { label: 'Backlog', color: '#64748B', icon: Inbox, gradient: 'from-[#64748B]/10' },
    todo: { label: 'To Do', color: '#6366F1', icon: Plus, gradient: 'from-[#6366F1]/10' },
    in_progress: { label: 'In Progress', color: '#F59E0B', icon: Clock, gradient: 'from-[#F59E0B]/10' },
    in_review: { label: 'In Review', color: '#8B5CF6', icon: AlertCircle, gradient: 'from-[#8B5CF6]/10' },
    done: { label: 'Done', color: '#10B981', icon: CheckCircle2, gradient: 'from-[#10B981]/10' },
} as const;

const TYPE_CONFIG = {
    user_story: { icon: BookOpen, color: '#6366F1', label: 'Story', bg: 'rgba(99,102,241,0.15)' },
    task: { icon: ClipboardList, color: '#F59E0B', label: 'Task', bg: 'rgba(245,158,11,0.15)' },
    bug: { icon: Bug, color: '#EF4444', label: 'Bug', bg: 'rgba(239,68,68,0.15)' },
    epic: { icon: Target, color: '#8B5CF6', label: 'Epic', bg: 'rgba(139,92,246,0.15)' },
};

const PRIORITY_COLORS = {
    critical: { border: 'border-red-500/60', text: 'text-red-400', bg: 'bg-red-500/10' },
    high: { border: 'border-orange-500/60', text: 'text-orange-400', bg: 'bg-orange-500/10' },
    medium: { border: 'border-yellow-500/50', text: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    low: { border: 'border-emerald-500/50', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
};

const ProjectBoard = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { token } = useAuth();
    const [project, setProject] = useState<Project | null>(null);
    const [workItems, setWorkItems] = useState<WorkItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<WorkItem>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterPriority, setFilterPriority] = useState<string>('all');
    const [draggedItem, setDraggedItem] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
    
    // AI Planning flow states
    const [showAIModal, setShowAIModal] = useState(false);
    const [aiStep, setAiStep] = useState<AIStep>('upload');
    const [prdFile, setPrdFile] = useState<File | null>(null);
    const [prdText, setPrdText] = useState('');
    const [additionalContext, setAdditionalContext] = useState('');
    const [analysis, setAnalysis] = useState<PRDAnalysis | null>(null);
    const [architectures, setArchitectures] = useState<Architecture[]>([]);
    const [selectedArchitectureId, setSelectedArchitectureId] = useState<number | null>(null);
    const [editingArchitecture, setEditingArchitecture] = useState<Architecture | null>(null);
    const [generatedTickets, setGeneratedTickets] = useState<GeneratedTicket[]>([]);
    const [ticketsSummary, setTicketsSummary] = useState<{ total_story_points: number; total_estimated_hours: number; sprint_recommendation: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Sprint and timeline states
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [sprints, setSprints] = useState<Sprint[]>([]);
    const [selectedSprintId, setSelectedSprintId] = useState<number | 'all' | 'backlog'>('all');
    const [showCreateSprintModal, setShowCreateSprintModal] = useState(false);
    const [newSprint, setNewSprint] = useState({ name: '', goal: '', start_date: '', end_date: '' });

    // Comments state
    const [comments, setComments] = useState<Array<{
        id: number;
        work_item_id: number;
        author_id: number | null;
        author_name: string;
        content: string;
        mentions: number[];
        comment_type: string;
        created_at: string;
        updated_at: string;
    }>>([]);
    const [newComment, setNewComment] = useState('');
    const [showMentions, setShowMentions] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [allDevelopers, setAllDevelopers] = useState<Array<{ id: number; name: string; email: string }>>([]);

    const [createForm, setCreateForm] = useState({
        type: 'user_story',
        title: '',
        description: '',
        priority: 'medium',
        story_points: 3,
        assignee_id: null as number | null,
        sprint: 'Backlog',
    });

    // Fetch project and work items
    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            try {
                const headers = { 'Authorization': `Bearer ${token}` };
                const [projRes, itemsRes, sprintsRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/projects/${id}`, { headers }),
                    fetch(`${API_BASE_URL}/api/workitems/?project_id=${id}`, { headers }),
                    fetch(`${API_BASE_URL}/api/workitems/projects/${id}/sprints`, { headers }),
                ]);
                if (projRes.ok) setProject(await projRes.json());
                if (itemsRes.ok) setWorkItems(await itemsRes.json());
                if (sprintsRes.ok) setSprints(await sprintsRes.json());
            } catch (err) {
                console.error('Failed to fetch data:', err);
                toast.error('Failed to load project data');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id, token]);

    // Refresh project stats
    const refreshProjectStats = useCallback(async () => {
        if (!id) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setProject(await res.json());
        } catch { /* ignore */ }
    }, [id, token]);

    // Filtered items
    const filteredItems = workItems.filter(item => {
        if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (filterType !== 'all' && item.type !== filterType) return false;
        if (filterPriority !== 'all' && item.priority !== filterPriority) return false;
        // Sprint filter
        if (selectedSprintId === 'backlog' && item.sprint_id !== null) return false;
        if (typeof selectedSprintId === 'number' && item.sprint_id !== selectedSprintId) return false;
        return true;
    });

    // Drag and drop handlers
    const handleDragStart = (itemId: string) => {
        setDraggedItem(itemId);
    };

    const handleDragOver = (e: React.DragEvent, status: string) => {
        e.preventDefault();
        setDragOverColumn(status);
    };

    const handleDragLeave = () => {
        setDragOverColumn(null);
    };

    const handleDrop = async (e: React.DragEvent, newStatus: string) => {
        e.preventDefault();
        setDragOverColumn(null);
        if (!draggedItem) return;

        // Optimistic update
        setWorkItems(prev => prev.map(item =>
            item.id === draggedItem ? { ...item, status: newStatus as WorkItem['status'] } : item
        ));

        try {
            await fetch(`${API_BASE_URL}/api/workitems/${draggedItem}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status: newStatus }),
            });
            refreshProjectStats();
        } catch {
            toast.error('Failed to update item status');
        }
        setDraggedItem(null);
    };

    // Create work item
    const handleCreateItem = async () => {
        if (!createForm.title.trim()) {
            toast.error('Title is required');
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/api/workitems/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    ...createForm,
                    project_id: id,
                    assigned_hours: createForm.story_points * 4,
                    remaining_hours: createForm.story_points * 4,
                    status: 'todo',
                    tags: [],
                }),
            });
            if (response.ok) {
                const newItem = await response.json();
                setWorkItems(prev => [...prev, newItem]);
                setShowCreateForm(false);
                setCreateForm({ type: 'user_story', title: '', description: '', priority: 'medium', story_points: 3, assignee_id: null, sprint: 'Backlog' });
                toast.success('Work item created!');
                refreshProjectStats();
            }
        } catch {
            toast.error('Failed to create item');
        }
    };

    // Move ticket to sprint
    const handleMoveToSprint = async (itemId: string, targetSprintId: number | null) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/workitems/${itemId}/move-sprint`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ target_sprint_id: targetSprintId }),
            });
            if (response.ok) {
                const updated = await response.json();
                setWorkItems(prev => prev.map(wi => wi.id === itemId ? updated : wi));
                if (selectedItem?.id === itemId) {
                    setSelectedItem(updated);
                }
                toast.success(targetSprintId ? 'Moved to sprint' : 'Moved to backlog');
                // Refresh sprints
                const sprintsRes = await fetch(`${API_BASE_URL}/api/workitems/projects/${id}/sprints`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (sprintsRes.ok) {
                    setSprints(await sprintsRes.json());
                }
            }
        } catch {
            toast.error('Failed to move ticket');
        }
    };

    // Get next sprint
    const getNextSprint = (currentSprintId: number | null): number | null => {
        if (!currentSprintId || sprints.length === 0) return null;
        const currentIndex = sprints.findIndex(s => s.id === currentSprintId);
        if (currentIndex >= 0 && currentIndex < sprints.length - 1) {
            return sprints[currentIndex + 1].id;
        }
        return null;
    };

    // Create sprint
    const handleCreateSprint = async () => {
        if (!newSprint.name.trim()) {
            toast.error('Sprint name is required');
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/api/workitems/sprints/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    project_id: parseInt(id!),
                    name: newSprint.name,
                    goal: newSprint.goal,
                    start_date: newSprint.start_date || null,
                    end_date: newSprint.end_date || null,
                }),
            });
            if (response.ok) {
                toast.success('Sprint created!');
                setShowCreateSprintModal(false);
                setNewSprint({ name: '', goal: '', start_date: '', end_date: '' });
                // Refresh sprints
                const sprintsRes = await fetch(`${API_BASE_URL}/api/workitems/projects/${id}/sprints`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (sprintsRes.ok) {
                    setSprints(await sprintsRes.json());
                }
            }
        } catch {
            toast.error('Failed to create sprint');
        }
    };

    // Fetch all developers for @mentions
    useEffect(() => {
        const fetchAllDevelopers = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/developers/`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    setAllDevelopers(await response.json());
                }
            } catch (error) {
                console.error('Failed to fetch developers:', error);
            }
        };
        fetchAllDevelopers();
    }, [token]);

    // Fetch comments when selectedItem changes
    useEffect(() => {
        const fetchComments = async () => {
            if (!selectedItem) {
                setComments([]);
                return;
            }
            try {
                const response = await fetch(`${API_BASE_URL}/api/comments/workitem/${selectedItem.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    setComments(await response.json());
                }
            } catch (error) {
                console.error('Failed to fetch comments:', error);
            }
        };
        fetchComments();
    }, [selectedItem]);

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
        setNewComment(`${beforeMention}@${developer.id} `);
        setShowMentions(false);
        setMentionFilter('');
    };

    // Submit comment
    const handleSubmitComment = async (isBlocker: boolean = false) => {
        if (!selectedItem || !newComment.trim()) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/comments/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    work_item_id: parseInt(selectedItem.id),
                    content: newComment,
                    author_id: project?.developers?.[0]?.id || 1, // TODO: Use actual logged-in user
                    comment_type: isBlocker ? 'blocker' : 'comment',
                }),
            });
            if (response.ok) {
                const newCommentData = await response.json();
                setComments(prev => [newCommentData, ...prev]);
                setNewComment('');
                toast.success(isBlocker ? 'Blocker reported!' : 'Comment added!');
            }
        } catch {
            toast.error('Failed to add comment');
        }
    };

    // Render comment with mentions highlighted
    const renderCommentContent = (content: string) => {
        const parts = content.split(/(@\d+)/g);
        return parts.map((part, index) => {
            if (part.startsWith('@') && !isNaN(parseInt(part.substring(1)))) {
                const devId = parseInt(part.substring(1));
                const dev = allDevelopers.find(d => d.id === devId);
                return (
                    <span key={index} className="bg-[rgba(99,102,241,0.2)] text-[#818CF8] px-1.5 py-0.5 rounded-md font-medium">
                        @{dev?.name || devId}
                    </span>
                );
            }
            return part;
        });
    };

    // Save edited item
    const handleSaveEdit = async () => {
        if (!selectedItem) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/workitems/${selectedItem.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(editForm),
            });
            if (response.ok) {
                const updated = await response.json();
                setWorkItems(prev => prev.map(wi => wi.id === selectedItem.id ? updated : wi));
                setSelectedItem(updated);
                setIsEditing(false);
                setEditForm({});
                toast.success('Item updated!');
                refreshProjectStats();
            }
        } catch {
            toast.error('Failed to update item');
        }
    };

    // Delete item
    const handleDeleteItem = async (itemId: string) => {
        if (!confirm('Delete this work item?')) return;
        try {
            await fetch(`${API_BASE_URL}/api/workitems/${itemId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setWorkItems(prev => prev.filter(wi => wi.id !== itemId));
            setSelectedItem(null);
            toast.success('Item deleted');
            refreshProjectStats();
        } catch {
            toast.error('Failed to delete item');
        }
    };

    // Log hours to a work item
    const handleLogHours = async (item: WorkItem, hoursToLog: number) => {
        try {
            const newLoggedHours = (item.logged_hours || 0) + hoursToLog;
            const newRemainingHours = Math.max(0, item.remaining_hours - hoursToLog);
            
            const response = await fetch(`${API_BASE_URL}/api/workitems/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    logged_hours: newLoggedHours,
                    remaining_hours: newRemainingHours,
                }),
            });
            if (response.ok) {
                const updated = await response.json();
                setWorkItems(prev => prev.map(wi => wi.id === item.id ? updated : wi));
                setSelectedItem(updated);
                toast.success(`Logged ${hoursToLog}h! Remaining: ${newRemainingHours}h`);
                refreshProjectStats();
            }
        } catch {
            toast.error('Failed to log hours');
        }
    };

    // AI Generate - Open the AI Planning Modal
    const handleAIGenerate = () => {
        setShowAIModal(true);
        setAiStep('upload');
        setPrdFile(null);
        setPrdText('');
        setAdditionalContext('');
        setAnalysis(null);
        setArchitectures([]);
        setSelectedArchitectureId(null);
        setGeneratedTickets([]);
        setTicketsSummary(null);
    };

    // Handle file upload
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'];
            if (!validTypes.includes(file.type)) {
                toast.error('Please upload a PDF, Word, or text file');
                return;
            }
            setPrdFile(file);
        }
    };

    // Analyze PRD
    const handleAnalyzePRD = async () => {
        if (!project || (!prdFile && !prdText.trim())) {
            toast.error('Please upload a file or enter PRD content');
            return;
        }

        setAiStep('analyzing');
        setIsGenerating(true);

        try {
            let response;
            
            if (prdFile) {
                // File upload
                const formData = new FormData();
                formData.append('file', prdFile);
                formData.append('project_id', String(project.id));
                formData.append('additional_context', additionalContext);
                
                response = await fetch(`${API_BASE_URL}/api/prd/analyze-file`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData,
                });
            } else {
                // Text input
                response = await fetch(`${API_BASE_URL}/api/prd/analyze-text`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        project_id: project.id,
                        prd_content: prdText,
                        additional_context: additionalContext,
                    }),
                });
            }

            if (response.ok) {
                const data = await response.json();
                setAnalysis(data.analysis);
                setArchitectures(data.architectures);
                setAiStep('architectures');
                toast.success('PRD analyzed successfully!');
            } else {
                const error = await response.json();
                toast.error(error.detail || 'Failed to analyze PRD');
                setAiStep('upload');
            }
        } catch (err) {
            toast.error('Failed to analyze PRD');
            setAiStep('upload');
        } finally {
            setIsGenerating(false);
        }
    };

    // Select architecture
    const handleSelectArchitecture = async (archId: number) => {
        setSelectedArchitectureId(archId);
        try {
            await fetch(`${API_BASE_URL}/api/prd/architectures/${archId}/select`, { 
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (err) {
            console.error('Failed to select architecture:', err);
        }
    };

    // Save architecture edits
    const handleSaveArchitecture = async (archId: number, updates: { mermaid_code?: string; name?: string; description?: string }): Promise<void> => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/prd/architectures/${archId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(updates),
            });
            if (response.ok) {
                const updated = await response.json();
                setArchitectures(prev => prev.map(a => a.id === archId ? updated : a));
                toast.success('Architecture saved!');
                setEditingArchitecture(null);
            }
        } catch (err) {
            toast.error('Failed to save architecture');
        }
    };

    // Preview generated tickets
    const handlePreviewTickets = async () => {
        if (!project || !selectedArchitectureId) return;
        
        setAiStep('preview');
        setIsGenerating(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/prd/projects/${project.id}/generate-tickets-preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ architecture_id: selectedArchitectureId }),
            });

            if (response.ok) {
                const data = await response.json();
                setGeneratedTickets(data.tickets);
                setTicketsSummary({
                    total_story_points: data.total_story_points,
                    total_estimated_hours: data.total_estimated_hours,
                    sprint_recommendation: data.sprint_recommendation,
                });
            } else {
                toast.error('Failed to generate tickets preview');
                setAiStep('architectures');
            }
        } catch (err) {
            toast.error('Failed to generate tickets');
            setAiStep('architectures');
        } finally {
            setIsGenerating(false);
        }
    };

    // Commit architecture and create tickets
    const handleCommitArchitecture = async () => {
        if (!project || !selectedArchitectureId) return;

        setAiStep('committing');
        setIsGenerating(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/prd/projects/${project.id}/commit-architecture`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    architecture_id: selectedArchitectureId,
                    start_date: startDate || null,
                    end_date: endDate || null,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setAiStep('done');
                toast.success(`Created ${data.tickets_created} tickets${data.sprints?.length ? ` in ${data.sprints.length} sprints` : ''}!`);
                
                // Refresh work items and sprints
                const [itemsRes, sprintsRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/workitems/?project_id=${project.id}`),
                    fetch(`${API_BASE_URL}/api/workitems/projects/${project.id}/sprints`),
                ]);
                if (itemsRes.ok) {
                    setWorkItems(await itemsRes.json());
                }
                if (sprintsRes.ok) {
                    setSprints(await sprintsRes.json());
                }
                refreshProjectStats();
                
                // Close modal after delay
                setTimeout(() => {
                    setShowAIModal(false);
                }, 2000);
            } else {
                const error = await response.json();
                toast.error(error.detail || 'Failed to commit architecture');
                setAiStep('preview');
            }
        } catch (err) {
            toast.error('Failed to commit architecture');
            setAiStep('preview');
        } finally {
            setIsGenerating(false);
        }
    };

    // Quick status change
    const handleStatusChange = async (item: WorkItem, newStatus: string) => {
        const updated = { ...item, status: newStatus as WorkItem['status'] };
        setWorkItems(prev => prev.map(wi => wi.id === item.id ? updated : wi));
        if (selectedItem?.id === item.id) setSelectedItem(updated);
        try {
            await fetch(`${API_BASE_URL}/api/workitems/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            refreshProjectStats();
        } catch {
            toast.error('Failed to update status');
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#05060B] flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-[#6366F1]/30 border-t-[#6366F1] rounded-full animate-spin" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="min-h-screen bg-[#05060B] flex flex-col items-center justify-center text-center">
                <h2 className="text-xl font-bold text-white mb-2">Project not found</h2>
                <Button onClick={() => navigate('/')} variant="ghost" className="text-[#6366F1]">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Projects
                </Button>
            </div>
        );
    }

    // Stats
    const totalPoints = workItems.reduce((sum, i) => sum + i.story_points, 0);
    const completedCount = workItems.filter(i => i.status === 'done').length;
    const remainingHours = workItems.filter(i => i.status !== 'done').reduce((sum, i) => sum + i.remaining_hours, 0);

    return (
        <div className="min-h-screen bg-[#05060B] text-[#F4F6FF] flex flex-col">
            <Toaster position="top-right" theme="dark" richColors />

            {/* Top Header */}
            <header className="border-b border-[rgba(244,246,255,0.06)] bg-[#05060B]/90 backdrop-blur-xl sticky top-0 z-40">
                <div className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate('/')}
                            className="text-[#64748B] hover:text-white hover:bg-[rgba(244,246,255,0.05)] rounded-lg gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Projects
                        </Button>
                        <div className="w-px h-6 bg-[rgba(244,246,255,0.08)]" />
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#4F46E5] flex items-center justify-center text-xs font-bold text-white">
                                {project.key_prefix.substring(0, 2)}
                            </div>
                            <div>
                                <h1 className="text-base font-semibold text-white">{project.name}</h1>
                                <p className="text-xs text-[#475569] font-mono">{project.key_prefix}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={handleAIGenerate}
                            disabled={isGenerating}
                            size="sm"
                            className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:from-[#5558E6] hover:to-[#4338CA] text-white rounded-lg font-medium shadow-lg shadow-[#4F46E5]/20 h-9"
                        >
                            {isGenerating ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-3.5 h-3.5 mr-2" />
                                    AI Generate
                                </>
                            )}
                        </Button>
                        <Button
                            onClick={() => setShowCreateForm(true)}
                            size="sm"
                            className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:from-[#5558E6] hover:to-[#4338CA] text-white rounded-lg font-medium shadow-lg shadow-[#4F46E5]/20 h-9"
                        >
                            <Plus className="w-3.5 h-3.5 mr-2" />
                            New Item
                        </Button>
                    </div>
                </div>

                {/* Stats + Filters Bar */}
                <div className="px-6 py-2.5 flex items-center justify-between border-t border-[rgba(244,246,255,0.04)]">
                    <div className="flex items-center gap-6">
                        {[
                            { label: 'Items', value: workItems.length, icon: Layers },
                            { label: 'Points', value: totalPoints, icon: BarChart3 },
                            { label: 'Done', value: completedCount, icon: CheckCircle2 },
                            { label: 'Hours Left', value: `${remainingHours}h`, icon: Clock },
                        ].map(s => (
                            <div key={s.label} className="flex items-center gap-2 text-xs">
                                <s.icon className="w-3.5 h-3.5 text-[#475569]" />
                                <span className="text-[#64748B]">{s.label}</span>
                                <span className="text-white font-semibold">{s.value}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#475569]" />
                            <Input
                                placeholder="Search items..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 h-8 w-48 text-xs bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.06)] text-[#F4F6FF] rounded-lg focus:border-[#6366F1]/50 placeholder:text-[#334155]"
                            />
                        </div>
                        {/* Type Filter */}
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="h-8 text-xs bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.06)] text-[#94A3B8] rounded-lg px-2 appearance-none cursor-pointer hover:border-[rgba(244,246,255,0.12)] transition-colors"
                        >
                            <option value="all">All Types</option>
                            <option value="user_story">Stories</option>
                            <option value="task">Tasks</option>
                            <option value="bug">Bugs</option>
                            <option value="epic">Epics</option>
                        </select>
                        {/* Priority Filter */}
                        <select
                            value={filterPriority}
                            onChange={(e) => setFilterPriority(e.target.value)}
                            className="h-8 text-xs bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.06)] text-[#94A3B8] rounded-lg px-2 appearance-none cursor-pointer hover:border-[rgba(244,246,255,0.12)] transition-colors"
                        >
                            <option value="all">All Priorities</option>
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                        {/* Sprint Filter */}
                        <div className="flex items-center gap-2">
                            <select
                                value={selectedSprintId}
                                onChange={(e) => setSelectedSprintId(e.target.value === 'all' ? 'all' : e.target.value === 'backlog' ? 'backlog' : parseInt(e.target.value))}
                                className="h-8 text-xs bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.06)] text-[#94A3B8] rounded-lg px-2 appearance-none cursor-pointer hover:border-[rgba(244,246,255,0.12)] transition-colors"
                            >
                                <option value="all">All Items</option>
                                <option value="backlog">📋 Backlog (No Sprint)</option>
                                {sprints.map(sprint => (
                                    <option key={sprint.id} value={sprint.id}>
                                        🏃 {sprint.name}
                                    </option>
                                ))}
                            </select>
                            <Button
                                onClick={() => setShowCreateSprintModal(true)}
                                size="sm"
                                className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:from-[#5558E6] hover:to-[#4338CA] text-white rounded-lg font-medium shadow-lg shadow-[#4F46E5]/20 h-8 px-3 text-xs"
                            >
                                <Plus className="w-3 h-3 mr-1" />
                                New Sprint
                            </Button>
                        </div>
                        {/* View Toggle */}
                        <div className="flex bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.06)] rounded-lg p-0.5">
                            <button
                                onClick={() => setViewMode('board')}
                                className={`p-1.5 rounded-md transition-colors ${viewMode === 'board' ? 'bg-[#6366F1] text-white' : 'text-[#475569] hover:text-white'}`}
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[#6366F1] text-white' : 'text-[#475569] hover:text-white'}`}
                            >
                                <List className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Board Content */}
            <div className="flex-1 overflow-x-auto">
                {viewMode === 'board' ? (
                    /* KANBAN BOARD VIEW */
                    <div className="flex gap-4 p-6 min-h-[calc(100vh-140px)]">
                        {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map((status) => {
                            const config = STATUS_CONFIG[status];
                            const columnItems = filteredItems.filter(item => item.status === status);
                            const isDropTarget = dragOverColumn === status;

                            return (
                                <div
                                    key={status}
                                    className={`flex-1 min-w-[280px] max-w-[360px] flex flex-col rounded-2xl border transition-all duration-200 ${isDropTarget
                                        ? 'border-[#6366F1]/40 bg-[#6366F1]/5 shadow-lg shadow-[#6366F1]/10'
                                        : 'border-[rgba(244,246,255,0.06)] bg-[rgba(244,246,255,0.02)]'
                                        }`}
                                    onDragOver={(e) => handleDragOver(e, status)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, status)}
                                >
                                    {/* Column Header */}
                                    <div className="px-4 py-3 border-b border-[rgba(244,246,255,0.06)] flex items-center justify-between flex-shrink-0">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: config.color, boxShadow: `0 0 8px ${config.color}44` }} />
                                            <span className="font-semibold text-sm text-white">{config.label}</span>
                                        </div>
                                        <Badge className="bg-[rgba(244,246,255,0.06)] text-[#64748B] border-0 text-xs font-medium px-2 py-0.5">
                                            {columnItems.length}
                                        </Badge>
                                    </div>

                                    {/* Cards */}
                                    <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
                                        {columnItems.map((item) => {
                                            const typeInfo = TYPE_CONFIG[item.type] || TYPE_CONFIG.task;
                                            const TypeIcon = typeInfo.icon;
                                            const priorityStyle = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium;
                                            const hoursProgress = item.assigned_hours > 0
                                                ? ((item.assigned_hours - item.remaining_hours) / item.assigned_hours) * 100
                                                : 0;

                                            return (
                                                <div
                                                    key={item.id}
                                                    draggable
                                                    onDragStart={() => handleDragStart(item.id)}
                                                    onClick={() => { setSelectedItem(item); setIsEditing(false); setEditForm({}); }}
                                                    className={`group bg-[rgba(244,246,255,0.03)] rounded-xl border border-[rgba(244,246,255,0.06)] p-3.5 cursor-pointer transition-all duration-200 hover:border-[rgba(244,246,255,0.15)] hover:bg-[rgba(244,246,255,0.05)] hover:shadow-lg hover:shadow-black/20 ${draggedItem === item.id ? 'opacity-40 scale-95' : ''
                                                        }`}
                                                >
                                                    {/* Type + ID */}
                                                    <div className="flex items-center gap-2 mb-2.5">
                                                        <div
                                                            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
                                                            style={{ backgroundColor: typeInfo.bg, color: typeInfo.color }}
                                                        >
                                                            <TypeIcon className="w-3 h-3" />
                                                            {typeInfo.label}
                                                        </div>
                                                        <span className="text-[10px] text-[#475569] font-mono">{item.id}</span>
                                                    </div>

                                                    {/* Title */}
                                                    <h4 className="text-sm font-medium text-[#E2E8F0] mb-3 line-clamp-2 leading-snug">
                                                        {item.title}
                                                    </h4>

                                                    {/* Progress Bar */}
                                                    <div className="mb-3">
                                                        <div className="flex justify-between text-[10px] text-[#475569] mb-1">
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="w-2.5 h-2.5" />
                                                                {item.remaining_hours}h left
                                                            </span>
                                                            <span className="flex items-center gap-2">
                                                                <span className="text-[#10B981]">{item.logged_hours || 0}h logged</span>
                                                                <span>/ {item.assigned_hours}h</span>
                                                            </span>
                                                        </div>
                                                        <div className="h-1 bg-[rgba(244,246,255,0.06)] rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full transition-all duration-500"
                                                                style={{
                                                                    width: `${hoursProgress}%`,
                                                                    background: `linear-gradient(90deg, ${config.color}, ${config.color}AA)`,
                                                                }}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Bottom: Points + Priority + Assignee */}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-md bg-[#6366F1]/15 flex items-center justify-center">
                                                                <span className="text-[10px] font-bold text-[#6366F1]">{item.story_points}</span>
                                                            </div>
                                                            <Badge
                                                                variant="outline"
                                                                className={`text-[10px] px-1.5 py-0 h-5 ${priorityStyle.border} ${priorityStyle.text}`}
                                                            >
                                                                {item.priority}
                                                            </Badge>
                                                        </div>
                                                        {item.assignee && item.assignee !== 'Unassigned' && (
                                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#6366F1] to-[#4F46E5] flex items-center justify-center" title={item.assignee}>
                                                                <span className="text-[10px] font-semibold text-white">
                                                                    {item.assignee?.charAt?.(0)?.toUpperCase() || '?'}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Tags */}
                                                    {item.tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {item.tags.slice(0, 2).map(tag => (
                                                                <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-md bg-[rgba(244,246,255,0.06)] text-[#64748B]">{tag}</span>
                                                            ))}
                                                            {item.tags.length > 2 && (
                                                                <span className="text-[9px] text-[#475569]">+{item.tags.length - 2}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Empty state */}
                                        {columnItems.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                                <div className="w-10 h-10 rounded-xl bg-[rgba(244,246,255,0.04)] flex items-center justify-center mb-2">
                                                    <config.icon className="w-5 h-5 text-[#334155]" />
                                                </div>
                                                <p className="text-xs text-[#334155]">No items</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* LIST VIEW */
                    <div className="p-6">
                        <div className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-2xl overflow-hidden">
                            {/* Table Header */}
                            <div className="grid grid-cols-[1fr_120px_100px_100px_100px_120px] gap-4 px-5 py-3 border-b border-[rgba(244,246,255,0.06)] text-xs text-[#475569] font-semibold uppercase tracking-wider">
                                <span>Title</span>
                                <span>Type</span>
                                <span>Status</span>
                                <span>Priority</span>
                                <span>Points</span>
                                <span>Assignee</span>
                            </div>
                            {/* Table Rows */}
                            {filteredItems.length === 0 ? (
                                <div className="py-16 text-center text-[#475569] text-sm">No items found</div>
                            ) : (
                                filteredItems.map(item => {
                                    const typeInfo = TYPE_CONFIG[item.type] || TYPE_CONFIG.task;
                                    const TypeIcon = typeInfo.icon;
                                    const statusConf = STATUS_CONFIG[item.status] || STATUS_CONFIG.todo;
                                    const priorityStyle = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium;

                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => { setSelectedItem(item); setIsEditing(false); setEditForm({}); }}
                                            className="grid grid-cols-[1fr_120px_100px_100px_100px_120px] gap-4 px-5 py-3.5 border-b border-[rgba(244,246,255,0.04)] hover:bg-[rgba(244,246,255,0.03)] cursor-pointer transition-colors group"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="text-[10px] text-[#475569] font-mono shrink-0">{item.id}</span>
                                                <span className="text-sm text-[#E2E8F0] truncate group-hover:text-white transition-colors">{item.title}</span>
                                            </div>
                                            <div className="flex items-center">
                                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs" style={{ backgroundColor: typeInfo.bg, color: typeInfo.color }}>
                                                    <TypeIcon className="w-3 h-3" />
                                                    {typeInfo.label}
                                                </div>
                                            </div>
                                            <div className="flex items-center">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusConf.color }} />
                                                    <span className="text-xs text-[#94A3B8]">{statusConf.label}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center">
                                                <Badge variant="outline" className={`text-[10px] ${priorityStyle.border} ${priorityStyle.text}`}>
                                                    {item.priority}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center">
                                                <span className="text-sm font-semibold text-[#6366F1]">{item.story_points}</span>
                                            </div>
                                            <div className="flex items-center">
                                                <span className="text-xs text-[#64748B] truncate">{item.assignee}</span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Slide-in Drawer */}
            {selectedItem && (
                <>
                    <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSelectedItem(null)} />
                    <div className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-[#0B0D14] border-l border-[rgba(244,246,255,0.08)] z-50 flex flex-col shadow-2xl shadow-black/50 animate-in slide-in-from-right duration-300">
                        {/* Drawer Header */}
                        <div className="flex items-center justify-between p-5 border-b border-[rgba(244,246,255,0.06)]">
                            <div className="flex items-center gap-3">
                                {(() => {
                                    const ti = TYPE_CONFIG[selectedItem.type] || TYPE_CONFIG.task;
                                    return (
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium"
                                            style={{ backgroundColor: ti.bg, color: ti.color }}>
                                            <ti.icon className="w-4 h-4" />
                                            {ti.label}
                                        </div>
                                    );
                                })()}
                                <span className="text-sm text-[#475569] font-mono">{selectedItem.id}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Button size="sm" variant="ghost" onClick={() => { setIsEditing(!isEditing); if (!isEditing) setEditForm(selectedItem); }}
                                    className="text-[#64748B] hover:text-white rounded-lg h-8 px-2.5">
                                    <Pencil className="w-3.5 h-3.5 mr-1" />{isEditing ? 'Cancel' : 'Edit'}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDeleteItem(selectedItem.id)}
                                    className="text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg h-8 px-2.5">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setSelectedItem(null)}
                                    className="text-[#64748B] hover:text-white rounded-lg h-8 px-2.5">
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Drawer Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-6">
                            {isEditing ? (
                                /* Edit Form */
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-medium text-[#64748B] block mb-1.5">Title</label>
                                        <Input defaultValue={selectedItem.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                                            className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-[#64748B] block mb-1.5">Description</label>
                                        <Textarea defaultValue={selectedItem.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                            className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl min-h-[120px] resize-none" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-[#64748B] block mb-1.5">Type</label>
                                            <select defaultValue={selectedItem.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value as WorkItem['type'] }))}
                                                className="w-full h-10 bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.08)] text-[#E2E8F0] rounded-xl px-3 text-sm">
                                                <option value="user_story">Story</option>
                                                <option value="task">Task</option>
                                                <option value="bug">Bug</option>
                                                <option value="epic">Epic</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-[#64748B] block mb-1.5">Priority</label>
                                            <select defaultValue={selectedItem.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value as WorkItem['priority'] }))}
                                                className="w-full h-10 bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.08)] text-[#E2E8F0] rounded-xl px-3 text-sm">
                                                <option value="critical">Critical</option>
                                                <option value="high">High</option>
                                                <option value="medium">Medium</option>
                                                <option value="low">Low</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-[#64748B] block mb-1.5">Story Points</label>
                                            <Input type="number" defaultValue={selectedItem.story_points} onChange={e => setEditForm(f => ({ ...f, story_points: parseInt(e.target.value) || 0 }))}
                                                className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-[#64748B] block mb-1.5">Allocated Hours</label>
                                            <Input type="number" defaultValue={selectedItem.assigned_hours} onChange={e => setEditForm(f => ({ ...f, assigned_hours: parseInt(e.target.value) || 0 }))}
                                                className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-[#64748B] block mb-1.5">Logged Hours</label>
                                            <Input type="number" defaultValue={selectedItem.logged_hours || 0} onChange={e => setEditForm(f => ({ ...f, logged_hours: parseInt(e.target.value) || 0 }))}
                                                className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-[#64748B] block mb-1.5">Remaining Hours</label>
                                            <Input type="number" defaultValue={selectedItem.remaining_hours} onChange={e => setEditForm(f => ({ ...f, remaining_hours: parseInt(e.target.value) || 0 }))}
                                                className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-[#64748B] block mb-1.5">Assignee</label>
                                        <select
                                            value={editForm.assignee_id ?? selectedItem.assignee_id ?? ''}
                                            onChange={e => setEditForm(f => ({ ...f, assignee_id: e.target.value ? parseInt(e.target.value) : null }))}
                                            className="w-full h-10 bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl px-3 text-sm"
                                        >
                                            <option value="">Unassigned</option>
                                            {project?.developers?.map(dev => (
                                                <option key={dev.id} value={dev.id}>
                                                    {dev.name} ({dev.role})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-[#64748B] block mb-1.5">Sprint</label>
                                        <Input defaultValue={selectedItem.sprint} onChange={e => setEditForm(f => ({ ...f, sprint: e.target.value }))}
                                            className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl" />
                                    </div>
                                    <Button onClick={handleSaveEdit} className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white rounded-xl w-full h-10">
                                        <Save className="w-4 h-4 mr-2" /> Save Changes
                                    </Button>
                                </div>
                            ) : (
                                /* View Mode */
                                <>
                                    <div>
                                        <h2 className="text-xl font-bold text-white mb-3">{selectedItem.title}</h2>
                                        <p className="text-sm text-[#94A3B8] leading-relaxed">{selectedItem.description || 'No description provided.'}</p>
                                    </div>

                                    {/* Detail Stats */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { label: 'Story Points', value: selectedItem.story_points, color: '#6366F1' },
                                            { label: 'Allocated Hours', value: `${selectedItem.assigned_hours}h`, color: '#6366F1' },
                                            { label: 'Logged Hours', value: `${selectedItem.logged_hours || 0}h`, color: '#10B981' },
                                            { label: 'Remaining Hours', value: `${selectedItem.remaining_hours}h`, color: '#F59E0B' },
                                            { label: 'Status', value: (STATUS_CONFIG[selectedItem.status] || STATUS_CONFIG.todo).label, color: (STATUS_CONFIG[selectedItem.status] || STATUS_CONFIG.todo).color },
                                            { label: 'Priority', value: selectedItem.priority.charAt(0).toUpperCase() + selectedItem.priority.slice(1), color: (PRIORITY_COLORS[selectedItem.priority] || PRIORITY_COLORS.medium).text.replace('text-', '').includes('red') ? '#EF4444' : (PRIORITY_COLORS[selectedItem.priority] || PRIORITY_COLORS.medium).text.includes('orange') ? '#F97316' : (PRIORITY_COLORS[selectedItem.priority] || PRIORITY_COLORS.medium).text.includes('yellow') ? '#F59E0B' : '#10B981' },
                                        ].map(d => (
                                            <div key={d.label} className="bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.06)] rounded-xl p-3.5">
                                                <div className="text-[10px] text-[#475569] font-medium uppercase tracking-wider mb-1">{d.label}</div>
                                                <div className="text-lg font-bold" style={{ color: d.color }}>{d.value}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Metadata */}
                                    <div className="space-y-3">
                                        {[
                                            { label: 'Assignee', value: selectedItem.assignee },
                                            { label: 'Sprint', value: selectedItem.sprint },
                                            ...(selectedItem.epic ? [{ label: 'Epic', value: selectedItem.epic }] : []),
                                        ].map(m => (
                                            <div key={m.label} className="flex items-center justify-between py-2 border-b border-[rgba(244,246,255,0.04)]">
                                                <span className="text-xs text-[#475569]">{m.label}</span>
                                                <span className="text-sm text-[#E2E8F0]">{m.value}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Tags */}
                                    {selectedItem.tags.length > 0 && (
                                        <div>
                                            <div className="text-xs text-[#475569] mb-2 font-medium">Tags</div>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedItem.tags.map(tag => (
                                                    <span key={tag} className="px-2.5 py-1 rounded-lg bg-[rgba(244,246,255,0.06)] text-[#94A3B8] text-xs">{tag}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Log Hours Section */}
                                    <div className="pt-4 border-t border-[rgba(244,246,255,0.06)]">
                                        <div className="text-xs text-[#475569] mb-3 font-medium">Log Work Hours</div>
                                        <div className="flex items-center gap-3">
                                            <Input
                                                type="number"
                                                placeholder="Hours"
                                                min="0"
                                                className="w-24 h-9 bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl"
                                                id="log-hours-input"
                                            />
                                            <Button
                                                size="sm"
                                                onClick={() => {
                                                    const input = document.getElementById('log-hours-input') as HTMLInputElement;
                                                    const hours = parseInt(input?.value || '0');
                                                    if (hours > 0) {
                                                        handleLogHours(selectedItem, hours);
                                                        input.value = '';
                                                    }
                                                }}
                                                className="bg-[#10B981] hover:bg-[#059669] text-white rounded-xl h-9"
                                            >
                                                <Clock className="w-3.5 h-3.5 mr-1.5" />
                                                Log Hours
                                            </Button>
                                        </div>
                                        <p className="text-[10px] text-[#475569] mt-2">
                                            Current: {selectedItem.logged_hours || 0}h logged · {selectedItem.remaining_hours}h remaining
                                        </p>
                                    </div>

                                    {/* Status Buttons */}
                                    <div className="pt-4 border-t border-[rgba(244,246,255,0.06)]">
                                        <div className="text-xs text-[#475569] mb-3 font-medium">Move to</div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map(status => (
                                                <Button
                                                    key={status}
                                                    size="sm"
                                                    onClick={() => handleStatusChange(selectedItem, status)}
                                                    className={`rounded-lg text-xs h-9 transition-all ${selectedItem.status === status
                                                        ? 'text-white shadow-lg'
                                                        : 'bg-transparent border border-[rgba(244,246,255,0.08)] text-[#64748B] hover:text-white hover:border-[rgba(244,246,255,0.15)]'
                                                        }`}
                                                    style={selectedItem.status === status ? { backgroundColor: STATUS_CONFIG[status].color, boxShadow: `0 4px 12px ${STATUS_CONFIG[status].color}33` } : {}}
                                                >
                                                    {STATUS_CONFIG[status].label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Sprint Movement */}
                                    {sprints.length > 0 && (
                                        <div className="pt-4 border-t border-[rgba(244,246,255,0.06)]">
                                            <div className="text-xs text-[#475569] mb-3 font-medium">Sprint Actions</div>
                                            <div className="flex flex-wrap gap-2">
                                                {/* Move to next sprint */}
                                                {selectedItem.sprint_id && getNextSprint(selectedItem.sprint_id) && selectedItem.status !== 'done' && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleMoveToSprint(selectedItem.id, getNextSprint(selectedItem.sprint_id))}
                                                        className="rounded-lg text-xs h-9 bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.3)] text-[#F59E0B] hover:bg-[rgba(245,158,11,0.2)]"
                                                    >
                                                        <ArrowRight className="w-3 h-3 mr-1" />
                                                        Push to Next Sprint
                                                    </Button>
                                                )}
                                                {/* Move to backlog */}
                                                {selectedItem.sprint_id && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleMoveToSprint(selectedItem.id, null)}
                                                        className="rounded-lg text-xs h-9 bg-transparent border border-[rgba(244,246,255,0.08)] text-[#64748B] hover:text-white hover:border-[rgba(244,246,255,0.15)]"
                                                    >
                                                        <Inbox className="w-3 h-3 mr-1" />
                                                        Move to Backlog
                                                    </Button>
                                                )}
                                                {/* Move to sprint dropdown */}
                                                {!selectedItem.sprint_id && (
                                                    <select
                                                        onChange={(e) => {
                                                            if (e.target.value) {
                                                                handleMoveToSprint(selectedItem.id, parseInt(e.target.value));
                                                                e.target.value = '';
                                                            }
                                                        }}
                                                        className="h-9 text-xs bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.08)] text-[#94A3B8] rounded-lg px-3 appearance-none cursor-pointer hover:border-[rgba(244,246,255,0.15)]"
                                                        defaultValue=""
                                                    >
                                                        <option value="">Add to Sprint...</option>
                                                        {sprints.map(sprint => (
                                                            <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Comments Section */}
                                    <div className="pt-4 border-t border-[rgba(244,246,255,0.06)]">
                                        <div className="text-xs text-[#475569] mb-3 font-medium">Activity & Comments</div>
                                        
                                        {/* Comment Input */}
                                        <div className="relative mb-4">
                                            <Textarea
                                                value={newComment}
                                                onChange={handleCommentChange}
                                                placeholder="Add a comment... Use @ to mention someone"
                                                className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl min-h-[80px] placeholder:text-[#334155] resize-none pr-20"
                                            />
                                            {/* @Mentions Dropdown */}
                                            {showMentions && (
                                                <div className="absolute left-0 right-0 top-full mt-1 bg-[#1A1D26] border border-[rgba(244,246,255,0.1)] rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                                                    {allDevelopers
                                                        .filter(d => d.name.toLowerCase().includes(mentionFilter.toLowerCase()))
                                                        .slice(0, 5)
                                                        .map(dev => (
                                                            <button
                                                                key={dev.id}
                                                                onClick={() => insertMention(dev)}
                                                                className="w-full px-3 py-2 text-left text-sm text-[#E2E8F0] hover:bg-[rgba(99,102,241,0.1)] flex items-center gap-2"
                                                            >
                                                                <div className="w-6 h-6 rounded-full bg-[rgba(99,102,241,0.2)] flex items-center justify-center text-xs text-[#818CF8]">
                                                                    {dev.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <span>{dev.name}</span>
                                                                <span className="text-[#475569] text-xs ml-auto">{dev.email}</span>
                                                            </button>
                                                        ))}
                                                    {allDevelopers.filter(d => d.name.toLowerCase().includes(mentionFilter.toLowerCase())).length === 0 && (
                                                        <div className="px-3 py-2 text-sm text-[#475569]">No matching developers</div>
                                                    )}
                                                </div>
                                            )}
                                            <div className="flex gap-2 mt-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleSubmitComment(false)}
                                                    disabled={!newComment.trim()}
                                                    className="bg-[rgba(99,102,241,0.1)] border border-[rgba(99,102,241,0.3)] text-[#6366F1] hover:bg-[rgba(99,102,241,0.2)] rounded-lg text-xs h-8"
                                                >
                                                    <MessageSquare className="w-3 h-3 mr-1" />
                                                    Comment
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleSubmitComment(true)}
                                                    disabled={!newComment.trim()}
                                                    className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[#EF4444] hover:bg-[rgba(239,68,68,0.2)] rounded-lg text-xs h-8"
                                                >
                                                    <AlertCircle className="w-3 h-3 mr-1" />
                                                    Report Blocker
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Comments List */}
                                        <div className="space-y-3 max-h-64 overflow-y-auto">
                                            {comments.length === 0 ? (
                                                <div className="text-center py-6 text-[#475569] text-sm">
                                                    No comments yet. Be the first to comment!
                                                </div>
                                            ) : (
                                                comments.map(comment => (
                                                    <div key={comment.id} className={`p-3 rounded-xl ${
                                                        comment.comment_type === 'blocker' 
                                                            ? 'bg-[rgba(239,68,68,0.05)] border border-[rgba(239,68,68,0.2)]' 
                                                            : 'bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)]'
                                                    }`}>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                                                                comment.comment_type === 'blocker' 
                                                                    ? 'bg-[rgba(239,68,68,0.2)] text-[#EF4444]' 
                                                                    : 'bg-[rgba(99,102,241,0.2)] text-[#818CF8]'
                                                            }`}>
                                                                {comment.author_name?.charAt?.(0)?.toUpperCase() || '?'}
                                                            </div>
                                                            <span className="text-sm font-medium text-[#E2E8F0]">{comment.author_name}</span>
                                                            {comment.comment_type === 'blocker' && (
                                                                <span className="px-1.5 py-0.5 rounded-md bg-[rgba(239,68,68,0.2)] text-[#EF4444] text-[10px] font-medium">BLOCKER</span>
                                                            )}
                                                            <span className="text-xs text-[#475569] ml-auto">
                                                                {new Date(comment.created_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-[#94A3B8] leading-relaxed">
                                                            {renderCommentContent(comment.content)}
                                                        </p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Create Item Modal */}
            {showCreateForm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreateForm(false)}>
                    <div className="bg-[#0F1118] border border-[rgba(244,246,255,0.08)] rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-[rgba(244,246,255,0.06)]">
                            <h2 className="text-lg font-bold text-white">Create Work Item</h2>
                            <button onClick={() => setShowCreateForm(false)} className="p-2 rounded-lg hover:bg-[rgba(244,246,255,0.05)] text-[#475569] hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="text-xs font-medium text-[#64748B] block mb-1.5">Type</label>
                                <select value={createForm.type} onChange={e => setCreateForm(f => ({ ...f, type: e.target.value }))}
                                    className="w-full h-10 bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.08)] text-[#E2E8F0] rounded-xl px-3 text-sm">
                                    <option value="user_story">User Story</option>
                                    <option value="task">Task</option>
                                    <option value="bug">Bug</option>
                                    <option value="epic">Epic</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-[#64748B] block mb-1.5">Title *</label>
                                <Input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                                    placeholder="Enter a concise title..."
                                    className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl h-10 placeholder:text-[#334155]" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-[#64748B] block mb-1.5">Description</label>
                                <Textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Describe the requirements..."
                                    className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl min-h-[100px] placeholder:text-[#334155] resize-none" />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-[#64748B] block mb-1.5">Priority</label>
                                    <select value={createForm.priority} onChange={e => setCreateForm(f => ({ ...f, priority: e.target.value }))}
                                        className="w-full h-10 bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.08)] text-[#E2E8F0] rounded-xl px-3 text-sm">
                                        <option value="critical">Critical</option>
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-[#64748B] block mb-1.5">Points</label>
                                    <Input type="number" value={createForm.story_points} onChange={e => setCreateForm(f => ({ ...f, story_points: parseInt(e.target.value) || 0 }))}
                                        className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl h-10" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-[#64748B] block mb-1.5">Assignee</label>
                                    <select
                                        value={createForm.assignee_id || ''}
                                        onChange={e => setCreateForm(f => ({ ...f, assignee_id: e.target.value ? parseInt(e.target.value) : null }))}
                                        className="w-full h-10 bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl px-3 text-sm"
                                    >
                                        <option value="">Unassigned</option>
                                        {project?.developers?.map(dev => (
                                            <option key={dev.id} value={dev.id}>
                                                {dev.name} ({dev.role})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 p-5 border-t border-[rgba(244,246,255,0.06)]">
                            <Button variant="ghost" onClick={() => setShowCreateForm(false)} className="text-[#64748B] rounded-xl px-5">Cancel</Button>
                            <Button onClick={handleCreateItem} disabled={!createForm.title.trim()}
                                className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white rounded-xl px-6 font-medium shadow-lg shadow-[#4F46E5]/20 disabled:opacity-50">
                                <Plus className="w-4 h-4 mr-2" /> Create Item
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Planning Modal */}
            {showAIModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#0F1118] border border-[rgba(244,246,255,0.08)] rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 border-b border-[rgba(244,246,255,0.06)] flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#4F46E5] flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">AI Project Planning</h2>
                                    <p className="text-xs text-[#64748B]">
                                        {aiStep === 'upload' && 'Upload PRD or enter project details'}
                                        {aiStep === 'analyzing' && 'Analyzing project requirements...'}
                                        {aiStep === 'architectures' && 'Select your preferred architecture'}
                                        {aiStep === 'preview' && 'Review generated tickets'}
                                        {aiStep === 'committing' && 'Creating tickets...'}
                                        {aiStep === 'done' && 'Tickets created successfully!'}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowAIModal(false)} 
                                className="p-2 rounded-lg hover:bg-[rgba(244,246,255,0.05)] text-[#475569] hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-5">
                            {/* Step: Upload */}
                            {aiStep === 'upload' && (
                                <div className="space-y-6">
                                    {/* File Upload Zone */}
                                    <div>
                                        <label className="text-sm font-medium text-[#94A3B8] block mb-3">Upload PRD Document</label>
                                        <div 
                                            onClick={() => fileInputRef.current?.click()}
                                            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                                                prdFile 
                                                    ? 'border-[#6366F1] bg-[#6366F1]/5' 
                                                    : 'border-[rgba(244,246,255,0.1)] hover:border-[#6366F1]/50 hover:bg-[rgba(244,246,255,0.02)]'
                                            }`}
                                        >
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".pdf,.doc,.docx,.txt"
                                                onChange={handleFileUpload}
                                                className="hidden"
                                            />
                                            {prdFile ? (
                                                <div className="flex items-center justify-center gap-3">
                                                    <div className="w-12 h-12 rounded-xl bg-[#6366F1]/20 flex items-center justify-center">
                                                        <FileText className="w-6 h-6 text-[#6366F1]" />
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-white font-medium">{prdFile.name}</p>
                                                        <p className="text-xs text-[#64748B]">{(prdFile.size / 1024).toFixed(1)} KB</p>
                                                    </div>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setPrdFile(null); }}
                                                        className="p-2 rounded-lg hover:bg-[rgba(244,246,255,0.1)] text-[#64748B] hover:text-red-400"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <Upload className="w-10 h-10 text-[#475569] mx-auto mb-3" />
                                                    <p className="text-[#94A3B8] mb-1">Click to upload or drag and drop</p>
                                                    <p className="text-xs text-[#475569]">PDF, Word, or Text files</p>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* OR Divider */}
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 h-px bg-[rgba(244,246,255,0.08)]" />
                                        <span className="text-xs text-[#475569] font-medium">OR</span>
                                        <div className="flex-1 h-px bg-[rgba(244,246,255,0.08)]" />
                                    </div>

                                    {/* Text Input */}
                                    <div>
                                        <label className="text-sm font-medium text-[#94A3B8] block mb-3">Enter PRD Content Manually</label>
                                        <Textarea
                                            value={prdText}
                                            onChange={(e) => setPrdText(e.target.value)}
                                            placeholder="Describe your project requirements, features, user stories, technical specifications..."
                                            className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl min-h-[180px] placeholder:text-[#334155] resize-none"
                                        />
                                    </div>

                                    {/* Additional Context */}
                                    <div>
                                        <label className="text-sm font-medium text-[#94A3B8] block mb-3">Additional Context (Optional)</label>
                                        <Textarea
                                            value={additionalContext}
                                            onChange={(e) => setAdditionalContext(e.target.value)}
                                            placeholder="Budget constraints, team size, timeline, preferred technologies, existing infrastructure..."
                                            className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl min-h-[100px] placeholder:text-[#334155] resize-none"
                                        />
                                    </div>

                                    {/* Timeline */}
                                    <div>
                                        <label className="text-sm font-medium text-[#94A3B8] block mb-3">
                                            <Calendar className="w-4 h-4 inline mr-2" />
                                            Project Timeline (Optional)
                                        </label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-[#64748B] block mb-1.5">Start Date</label>
                                                <Input
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl h-10"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-[#64748B] block mb-1.5">End Date</label>
                                                <Input
                                                    type="date"
                                                    value={endDate}
                                                    onChange={(e) => setEndDate(e.target.value)}
                                                    className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl h-10"
                                                />
                                            </div>
                                        </div>
                                        {startDate && endDate && (
                                            <p className="text-xs text-[#64748B] mt-2">
                                                {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 7))} weeks 
                                                = ~{Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 14)))} sprints (2-week each)
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Step: Analyzing */}
                            {aiStep === 'analyzing' && (
                                <div className="flex flex-col items-center justify-center py-16">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#4F46E5] flex items-center justify-center mb-6 animate-pulse">
                                        <Sparkles className="w-8 h-8 text-white" />
                                    </div>
                                    <div className="w-12 h-12 border-3 border-[#6366F1]/30 border-t-[#6366F1] rounded-full animate-spin mb-6" />
                                    <h3 className="text-xl font-semibold text-white mb-2">AI is analyzing your project</h3>
                                    <p className="text-[#64748B] text-center max-w-md">
                                        Performing cost analysis, recommending tools, and generating architecture options...
                                    </p>
                                </div>
                            )}

                            {/* Step: Architecture Selection */}
                            {aiStep === 'architectures' && (
                                <div className="space-y-6">
                                    {/* Analysis Summary */}
                                    {analysis && (
                                        <div className="bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.08)] rounded-xl p-5">
                                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                                <Target className="w-4 h-4 text-[#6366F1]" />
                                                PRD Analysis Summary
                                            </h3>
                                            <p className="text-sm text-[#94A3B8] mb-4">{analysis.summary}</p>
                                            
                                            {analysis.key_features && analysis.key_features.length > 0 && (
                                                <div className="mb-4">
                                                    <p className="text-xs text-[#64748B] font-medium mb-2">Key Features</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {analysis.key_features.slice(0, 6).map((feature, i) => (
                                                            <span key={i} className="px-2.5 py-1 rounded-lg bg-[#6366F1]/10 text-[#6366F1] text-xs">
                                                                {feature}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {analysis.recommended_tools && (
                                                <div>
                                                    <p className="text-xs text-[#64748B] font-medium mb-2">Recommended Tools</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.entries(analysis.recommended_tools).slice(0, 6).map(([category, tool]) => (
                                                            <span key={category} className="px-2.5 py-1 rounded-lg bg-[rgba(244,246,255,0.06)] text-[#94A3B8] text-xs">
                                                                {category}: {String(tool)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Architecture Cards */}
                                    <div>
                                        <h3 className="text-sm font-semibold text-white mb-4">Select Architecture</h3>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {architectures.map((arch) => (
                                                <ArchitectureCard
                                                    key={arch.id}
                                                    architecture={arch}
                                                    isSelected={selectedArchitectureId === arch.id}
                                                    onSelect={() => handleSelectArchitecture(arch.id)}
                                                    onViewFullScreen={() => setEditingArchitecture(arch)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step: Preview Tickets */}
                            {aiStep === 'preview' && (
                                <div className="space-y-6">
                                    {/* Summary Stats */}
                                    {ticketsSummary && (
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.08)] rounded-xl p-4 text-center">
                                                <p className="text-2xl font-bold text-[#6366F1]">{generatedTickets.length}</p>
                                                <p className="text-xs text-[#64748B]">Tickets</p>
                                            </div>
                                            <div className="bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.08)] rounded-xl p-4 text-center">
                                                <p className="text-2xl font-bold text-[#F59E0B]">{ticketsSummary.total_story_points}</p>
                                                <p className="text-xs text-[#64748B]">Total Points</p>
                                            </div>
                                            <div className="bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.08)] rounded-xl p-4 text-center">
                                                <p className="text-2xl font-bold text-[#10B981]">{ticketsSummary.total_estimated_hours}h</p>
                                                <p className="text-xs text-[#64748B]">Estimated Hours</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sprint Recommendation */}
                                    {ticketsSummary?.sprint_recommendation && (
                                        <div className="bg-[#6366F1]/10 border border-[#6366F1]/20 rounded-xl p-4">
                                            <p className="text-sm text-[#6366F1] font-medium">Sprint Recommendation</p>
                                            <p className="text-xs text-[#94A3B8] mt-1">{ticketsSummary.sprint_recommendation}</p>
                                        </div>
                                    )}

                                    {/* Tickets List */}
                                    <div>
                                        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                                            <ClipboardList className="w-4 h-4 text-[#6366F1]" />
                                            Generated Tickets
                                        </h3>
                                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                            {generatedTickets.map((ticket, index) => {
                                                const typeInfo = TYPE_CONFIG[ticket.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.task;
                                                const TypeIcon = typeInfo.icon;
                                                return (
                                                    <div key={index} className="bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.08)] rounded-xl p-4">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium" style={{ backgroundColor: typeInfo.bg, color: typeInfo.color }}>
                                                                        <TypeIcon className="w-3 h-3" />
                                                                        {typeInfo.label}
                                                                    </div>
                                                                    <Badge variant="outline" className={`text-[10px] ${
                                                                        ticket.priority === 'critical' ? 'border-red-500/60 text-red-400' :
                                                                        ticket.priority === 'high' ? 'border-orange-500/60 text-orange-400' :
                                                                        ticket.priority === 'medium' ? 'border-yellow-500/50 text-yellow-400' :
                                                                        'border-emerald-500/50 text-emerald-400'
                                                                    }`}>
                                                                        {ticket.priority}
                                                                    </Badge>
                                                                </div>
                                                                <h4 className="text-sm font-medium text-white mb-1">{ticket.title}</h4>
                                                                <p className="text-xs text-[#64748B] line-clamp-2">{ticket.description}</p>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-[#64748B]">{ticket.story_points} pts</span>
                                                                    <span className="text-xs text-[#64748B]">{ticket.estimated_hours}h</span>
                                                                </div>
                                                                {ticket.assignee_name && (
                                                                    <div className="flex items-center gap-2 bg-[rgba(244,246,255,0.05)] rounded-lg px-2 py-1">
                                                                        <Users className="w-3 h-3 text-[#6366F1]" />
                                                                        <span className="text-xs text-[#94A3B8]">{ticket.assignee_name}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {ticket.assignee_reasoning && (
                                                            <p className="text-[10px] text-[#475569] mt-2 italic">Assignment: {ticket.assignee_reasoning}</p>
                                                        )}
                                                        {ticket.tags && ticket.tags.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-2">
                                                                {ticket.tags.map(tag => (
                                                                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md bg-[rgba(244,246,255,0.06)] text-[#64748B]">{tag}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step: Committing */}
                            {aiStep === 'committing' && (
                                <div className="flex flex-col items-center justify-center py-16">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#4F46E5] flex items-center justify-center mb-6">
                                        <GitCommit className="w-8 h-8 text-white" />
                                    </div>
                                    <div className="w-12 h-12 border-3 border-[#6366F1]/30 border-t-[#6366F1] rounded-full animate-spin mb-6" />
                                    <h3 className="text-xl font-semibold text-white mb-2">Creating Tickets</h3>
                                    <p className="text-[#64748B] text-center max-w-md">
                                        Adding tickets to your board and assigning to team members...
                                    </p>
                                </div>
                            )}

                            {/* Step: Done */}
                            {aiStep === 'done' && (
                                <div className="flex flex-col items-center justify-center py-16">
                                    <div className="w-20 h-20 rounded-full bg-[#10B981]/20 flex items-center justify-center mb-6">
                                        <CheckCircle2 className="w-10 h-10 text-[#10B981]" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">All Done!</h3>
                                    <p className="text-[#64748B] text-center max-w-md mb-6">
                                        {generatedTickets.length} tickets have been created and assigned to your team.
                                    </p>
                                    <Button
                                        onClick={() => setShowAIModal(false)}
                                        className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white rounded-xl px-8"
                                    >
                                        View Board
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        {(aiStep === 'upload' || aiStep === 'architectures' || aiStep === 'preview') && (
                            <div className="flex items-center justify-between p-5 border-t border-[rgba(244,246,255,0.06)] flex-shrink-0">
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        if (aiStep === 'architectures') setAiStep('upload');
                                        else if (aiStep === 'preview') setAiStep('architectures');
                                        else setShowAIModal(false);
                                    }}
                                    className="text-[#64748B] rounded-xl"
                                >
                                    {aiStep === 'upload' ? 'Cancel' : 'Back'}
                                </Button>

                                {aiStep === 'upload' && (
                                    <Button
                                        onClick={handleAnalyzePRD}
                                        disabled={!prdFile && !prdText.trim()}
                                        className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white rounded-xl px-6 font-medium shadow-lg shadow-[#4F46E5]/20 disabled:opacity-50"
                                    >
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Analyze PRD
                                    </Button>
                                )}

                                {aiStep === 'architectures' && (
                                    <Button
                                        onClick={handlePreviewTickets}
                                        disabled={!selectedArchitectureId}
                                        className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white rounded-xl px-6 font-medium shadow-lg shadow-[#4F46E5]/20 disabled:opacity-50"
                                    >
                                        <ArrowRight className="w-4 h-4 mr-2" />
                                        Preview Tickets
                                    </Button>
                                )}

                                {aiStep === 'preview' && (
                                    <Button
                                        onClick={handleCommitArchitecture}
                                        className="bg-gradient-to-r from-[#10B981] to-[#059669] text-white rounded-xl px-6 font-medium shadow-lg shadow-[#10B981]/20"
                                    >
                                        <GitCommit className="w-4 h-4 mr-2" />
                                        Commit & Create Tickets
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create Sprint Modal */}
            {showCreateSprintModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreateSprintModal(false)}>
                    <div className="bg-[#0F1118] border border-[rgba(244,246,255,0.08)] rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-[rgba(244,246,255,0.06)]">
                            <h2 className="text-lg font-bold text-white">Create New Sprint</h2>
                            <button onClick={() => setShowCreateSprintModal(false)} className="p-2 rounded-lg hover:bg-[rgba(244,246,255,0.05)] text-[#475569] hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="text-xs font-medium text-[#64748B] block mb-1.5">Sprint Name *</label>
                                <Input
                                    value={newSprint.name}
                                    onChange={(e) => setNewSprint(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g., Sprint 1: Foundation"
                                    className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl h-10 placeholder:text-[#334155]"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-[#64748B] block mb-1.5">Sprint Goal</label>
                                <Textarea
                                    value={newSprint.goal}
                                    onChange={(e) => setNewSprint(f => ({ ...f, goal: e.target.value }))}
                                    placeholder="What do we want to achieve in this sprint?"
                                    className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl min-h-[80px] placeholder:text-[#334155] resize-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-[#64748B] block mb-1.5">Start Date</label>
                                    <Input
                                        type="date"
                                        value={newSprint.start_date}
                                        onChange={(e) => setNewSprint(f => ({ ...f, start_date: e.target.value }))}
                                        className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl h-10"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-[#64748B] block mb-1.5">End Date</label>
                                    <Input
                                        type="date"
                                        value={newSprint.end_date}
                                        onChange={(e) => setNewSprint(f => ({ ...f, end_date: e.target.value }))}
                                        className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl h-10"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 p-5 border-t border-[rgba(244,246,255,0.06)]">
                            <Button variant="ghost" onClick={() => setShowCreateSprintModal(false)} className="text-[#64748B] rounded-xl px-5">Cancel</Button>
                            <Button
                                onClick={handleCreateSprint}
                                disabled={!newSprint.name.trim()}
                                className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white rounded-xl px-6 font-medium shadow-lg shadow-[#4F46E5]/20 disabled:opacity-50"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Create Sprint
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Architecture Editor Modal */}
            {editingArchitecture && (
                <ArchitectureEditor
                    architecture={editingArchitecture}
                    onSave={handleSaveArchitecture}
                    onClose={() => setEditingArchitecture(null)}
                />
            )}
        </div>
    );
};

export default ProjectBoard;
