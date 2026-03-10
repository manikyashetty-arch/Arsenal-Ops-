import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Users,
    Github,
    Info,
    Pencil,
    Save,
    X,
    Plus,
    Trash2,
    ExternalLink,
    Mail,
    CheckCircle2,
    AlertCircle,
    LayoutGrid,
    Layers,
    Sparkles,
    ShieldAlert,
    Zap,
    Clock,
    DollarSign,
    Target,
    TrendingUp,
    AlertTriangle,
    Wrench,
    Calendar,
    FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast, Toaster } from 'sonner';
import MermaidRenderer from '@/components/MermaidRenderer';
import ArchitectureEditor from '@/components/ArchitectureEditor';
import { useAuth } from '@/contexts/AuthContext';

import { API_BASE_URL } from '@/config/api';

interface Developer {
    id: number;
    name: string;
    email: string;
    github_username: string;
    avatar_url?: string;
}

interface ProjectDeveloper {
    id: number;
    name: string;
    email: string;
    github_username: string;
    role: string;
    responsibilities: string;
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
    created_at: string;
    updated_at: string;
    cost_analysis?: {
        infrastructure?: { monthly: string; annual: string; breakdown: { item: string; cost: string }[] };
        development?: { total: string; breakdown: { item: string; cost: string }[] };
        total_estimated?: string;
    };
    tools_recommended?: {
        frontend?: string[];
        backend?: string[];
        database?: string[];
        devops?: string[];
        [key: string]: string[] | undefined;
    };
}

interface PRDAnalysis {
    id: number;
    summary: string;
    key_features: string[];
    technical_requirements: string[];
    cost_analysis?: {
        infrastructure?: { monthly: string; annual: string; breakdown: { item: string; cost: string }[] };
        development?: { total: string; breakdown: { item: string; cost: string }[] };
        total_estimated?: string;
    };
    recommended_tools?: {
        frontend?: string[];
        backend?: string[];
        database?: string[];
        devops?: string[];
        [key: string]: string[] | undefined;
    };
    risks: { risk: string; impact: string; mitigation: string }[];
    timeline: { phase: string; duration: string; tasks: string[] }[];
}

interface Sprint {
    id: number;
    name: string;
    goal: string;
    status: 'planned' | 'active' | 'completed';
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

interface Project {
    id: number;
    name: string;
    description: string;
    key_prefix: string;
    status: string;
    github_repo_url: string;
    github_repo_name?: string;
    created_at: string;
    developers: ProjectDeveloper[];
    selected_architecture?: Architecture;
    architectures: Architecture[];
}

type TabType = 'overview' | 'developers' | 'github';

const ProjectDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { token } = useAuth();
    const [project, setProject] = useState<Project | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Project>>({});
    const [allDevelopers, setAllDevelopers] = useState<Developer[]>([]);
    const [showAddDeveloper, setShowAddDeveloper] = useState(false);
    const [newDeveloper, setNewDeveloper] = useState({
        developer_id: '',
        role: '',
        responsibilities: '',
    });
    const [githubStatus, setGithubStatus] = useState<{ has_repo: boolean; developer_count: number; sent_count: number } | null>(null);
    const [isSendingInvites, setIsSendingInvites] = useState(false);
    const [accessDenied, setAccessDenied] = useState(false);
    const [prdAnalysis, setPrdAnalysis] = useState<PRDAnalysis | null>(null);
    const [sprints, setSprints] = useState<Sprint[]>([]);
    
    // Architecture editing state
    const [editingArchitecture, setEditingArchitecture] = useState<Architecture | null>(null);

    // Fetch project data
    useEffect(() => {
        if (!id) return;
        fetchProject();
        fetchAllDevelopers();
        fetchSprints();
    }, [id]);

    const fetchProject = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setProject(data);
                setEditForm(data);
                setAccessDenied(false);
            } else if (res.status === 403) {
                setAccessDenied(true);
                toast.error('You do not have access to this project');
            } else {
                toast.error('Failed to load project');
            }
        } catch (err) {
            toast.error('Failed to load project');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAllDevelopers = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/developers/`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                setAllDevelopers(await res.json());
            }
        } catch (err) {
            console.error('Failed to fetch developers:', err);
        }
    };

    const fetchGithubStatus = async () => {
        if (!id) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/${id}/github-status`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                setGithubStatus(await res.json());
            }
        } catch (err) {
            console.error('Failed to fetch GitHub status:', err);
        }
    };

    const fetchSprints = async () => {
        if (!id) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/workitems/projects/${id}/sprints`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                setSprints(await res.json());
            }
        } catch (err) {
            console.error('Failed to fetch sprints:', err);
        }
    };

    const fetchPrdAnalysis = async () => {
        if (!id) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/prd/projects/${id}/analysis`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setPrdAnalysis(data);
            }
        } catch (err) {
            console.error('Failed to fetch PRD analysis:', err);
        }
    };

    useEffect(() => {
        if (activeTab === 'github') {
            fetchGithubStatus();
        }
    }, [activeTab]);

    // Fetch PRD analysis when project loads
    useEffect(() => {
        if (project) {
            fetchPrdAnalysis();
        }
    }, [project]);

    // Save project edits
    const handleSaveEdit = async () => {
        if (!project) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/${project.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(editForm),
            });
            if (res.ok) {
                const updated = await res.json();
                setProject(updated);
                setIsEditing(false);
                toast.success('Project updated!');
            }
        } catch {
            toast.error('Failed to update project');
        }
    };

    // Add developer to project
    const handleAddDeveloper = async () => {
        if (!project || !newDeveloper.developer_id) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/${project.id}/developers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    developer_id: parseInt(newDeveloper.developer_id),
                    role: newDeveloper.role,
                    responsibilities: newDeveloper.responsibilities,
                }),
            });
            if (res.ok) {
                toast.success('Developer added!');
                setShowAddDeveloper(false);
                setNewDeveloper({ developer_id: '', role: '', responsibilities: '' });
                fetchProject();
            }
        } catch {
            toast.error('Failed to add developer');
        }
    };

    // Remove developer from project
    const handleRemoveDeveloper = async (developerId: number) => {
        if (!project) return;
        if (!confirm('Remove this developer from the project?')) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/${project.id}/developers/${developerId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success('Developer removed!');
                fetchProject();
            }
        } catch {
            toast.error('Failed to remove developer');
        }
    };

    // Select architecture
    const handleSelectArchitecture = async (architectureId: number) => {
        if (!project) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/prd/architectures/${architectureId}/select`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success('Architecture selected!');
                fetchProject();
            } else {
                toast.error('Failed to select architecture');
            }
        } catch {
            toast.error('Failed to select architecture');
        }
    };

    // Save architecture changes
    const handleSaveArchitecture = async (id: number, updates: { mermaid_code?: string; name?: string; description?: string }) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/prd/architectures/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(updates),
            });
            if (res.ok) {
                toast.success('Architecture updated!');
                setEditingArchitecture(null);
                fetchProject();
            } else {
                toast.error('Failed to update architecture');
            }
        } catch {
            toast.error('Failed to update architecture');
        }
    };

    // Send GitHub invitations
    const handleSendGitHubInvites = async () => {
        if (!project || !project.github_repo_url) {
            toast.error('No GitHub repository configured');
            return;
        }
        setIsSendingInvites(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/${project.id}/github-invite?role=push`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`Sent ${data.successful_invitations} GitHub invitations!`);
                fetchGithubStatus();
            } else {
                toast.error(data.detail || 'Failed to send invitations');
            }
        } catch {
            toast.error('Failed to send invitations');
        } finally {
            setIsSendingInvites(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#05060B] flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-[#6366F1]/30 border-t-[#6366F1] rounded-full animate-spin" />
            </div>
        );
    }

    if (accessDenied) {
        return (
            <div className="min-h-screen bg-[#05060B] flex flex-col items-center justify-center text-center p-4">
                <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
                    <ShieldAlert className="w-10 h-10 text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
                <p className="text-[#64748B] max-w-md mb-6">
                    You do not have permission to view this project. Only assigned developers and admins can access project details.
                </p>
                <Button onClick={() => navigate('/')} className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white rounded-xl px-6">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Projects
                </Button>
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

    const tabs = [
        { id: 'overview' as TabType, label: 'Overview', icon: Info },
        { id: 'developers' as TabType, label: 'Developers', icon: Users },
        { id: 'github' as TabType, label: 'GitHub', icon: Github },
    ];

    // Filter out developers already in project
    const availableDevelopers = allDevelopers.filter(
        d => !project.developers.some(pd => pd.id === d.id)
    );

    return (
        <div className="min-h-screen bg-[#05060B] text-[#F4F6FF]">
            <Toaster position="top-right" theme="dark" richColors />

            {/* Header */}
            <header className="border-b border-[rgba(244,246,255,0.06)] bg-[#05060B]/90 backdrop-blur-xl sticky top-0 z-40">
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
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
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#4F46E5] flex items-center justify-center text-sm font-bold text-white">
                                    {project.key_prefix.substring(0, 2)}
                                </div>
                                <div>
                                    <h1 className="text-lg font-semibold text-white">{project.name}</h1>
                                    <p className="text-xs text-[#475569] font-mono">{project.key_prefix}</p>
                                </div>
                            </div>
                        </div>
                        <Button
                            onClick={() => navigate(`/project/${project.id}/board`)}
                            className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:from-[#5558E6] hover:to-[#4338CA] text-white rounded-lg"
                        >
                            <LayoutGrid className="w-4 h-4 mr-2" />
                            Open Board
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-6 flex gap-1 border-t border-[rgba(244,246,255,0.04)]">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === tab.id
                                        ? 'text-[#6366F1] border-[#6366F1]'
                                        : 'text-[#64748B] border-transparent hover:text-white hover:border-[rgba(244,246,255,0.1)]'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </header>

            {/* Content */}
            <main className="p-6 max-w-5xl mx-auto">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        <div className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-white">Project Information</h2>
                                {!isEditing ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsEditing(true)}
                                        className="text-[#64748B] hover:text-white"
                                    >
                                        <Pencil className="w-4 h-4 mr-2" />
                                        Edit
                                    </Button>
                                ) : (
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => { setIsEditing(false); setEditForm(project); }}
                                            className="text-[#64748B] hover:text-white"
                                        >
                                            <X className="w-4 h-4 mr-2" />
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleSaveEdit}
                                            className="bg-[#6366F1] hover:bg-[#5558E6] text-white"
                                        >
                                            <Save className="w-4 h-4 mr-2" />
                                            Save
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {isEditing ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-medium text-[#64748B] block mb-1.5">Project Name</label>
                                        <Input
                                            value={editForm.name || ''}
                                            onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                                            className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-[#64748B] block mb-1.5">Description</label>
                                        <Textarea
                                            value={editForm.description || ''}
                                            onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))}
                                            className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl min-h-[120px]"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-[#64748B] block mb-1.5">GitHub Repository URL</label>
                                        <Input
                                            value={editForm.github_repo_url || ''}
                                            onChange={(e) => setEditForm(f => ({ ...f, github_repo_url: e.target.value }))}
                                            placeholder="https://github.com/username/repo"
                                            className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-medium text-[#64748B] block mb-1">Description</label>
                                        <p className="text-sm text-[#E2E8F0] leading-relaxed">
                                            {project.description || 'No description provided.'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-[#64748B] block mb-1">GitHub Repository</label>
                                        {project.github_repo_url ? (
                                            <a
                                                href={project.github_repo_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 text-sm text-[#6366F1] hover:underline"
                                            >
                                                <Github className="w-4 h-4" />
                                                {project.github_repo_url}
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        ) : (
                                            <p className="text-sm text-[#475569]">No repository configured</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-6 pt-4 border-t border-[rgba(244,246,255,0.06)]">
                                        <div>
                                            <span className="text-xs text-[#64748B]">Created</span>
                                            <p className="text-sm text-[#E2E8F0]">{new Date(project.created_at).toLocaleDateString()}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-[#64748B]">Status</span>
                                            <Badge className="bg-[#6366F1]/20 text-[#6366F1] border-0 ml-2">
                                                {project.status}
                                            </Badge>
                                        </div>
                                        <div>
                                            <span className="text-xs text-[#64748B]">Team Size</span>
                                            <p className="text-sm text-[#E2E8F0]">{project.developers.length} developers</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-xl p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[#6366F1]/10 flex items-center justify-center">
                                        <Users className="w-5 h-5 text-[#6366F1]" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-white">{project.developers.length}</p>
                                        <p className="text-xs text-[#64748B]">Developers</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-xl p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                                        <Github className="w-5 h-5 text-[#10B981]" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-white">
                                            {project.github_repo_url ? 'Yes' : 'No'}
                                        </p>
                                        <p className="text-xs text-[#64748B]">GitHub Repo</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-xl p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
                                        <Info className="w-5 h-5 text-[#F59E0B]" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-white">{project.key_prefix}</p>
                                        <p className="text-xs text-[#64748B]">Key Prefix</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* PRD Analysis Section */}
                        {prdAnalysis && (
                            <div className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-2xl p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#4F46E5] flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white">AI Project Analysis</h3>
                                        <p className="text-xs text-[#64748B]">Generated from PRD</p>
                                    </div>
                                </div>

                                {/* Summary */}
                                <div className="mb-6">
                                    <h4 className="text-sm font-medium text-[#94A3B8] mb-2">Summary</h4>
                                    <p className="text-sm text-[#E2E8F0] leading-relaxed">{prdAnalysis.summary}</p>
                                </div>

                                {/* Key Features */}
                                {prdAnalysis.key_features && prdAnalysis.key_features.length > 0 && (
                                    <div className="mb-6">
                                        <h4 className="text-sm font-medium text-[#94A3B8] mb-3 flex items-center gap-2">
                                            <Target className="w-4 h-4 text-[#6366F1]" />
                                            Key Features
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {prdAnalysis.key_features.map((feature, idx) => (
                                                <Badge key={idx} className="bg-[#6366F1]/10 text-[#818CF8] border border-[#6366F1]/20 hover:bg-[#6366F1]/20">
                                                    {feature}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Technical Requirements */}
                                {prdAnalysis.technical_requirements && prdAnalysis.technical_requirements.length > 0 && (
                                    <div className="mb-6">
                                        <h4 className="text-sm font-medium text-[#94A3B8] mb-3 flex items-center gap-2">
                                            <Wrench className="w-4 h-4 text-[#10B981]" />
                                            Technical Requirements
                                        </h4>
                                        <ul className="space-y-2">
                                            {prdAnalysis.technical_requirements.map((req, idx) => (
                                                <li key={idx} className="flex items-start gap-2 text-sm text-[#E2E8F0]">
                                                    <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 flex-shrink-0" />
                                                    {req}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Recommended Tools */}
                                <div className="mb-6">
                                    <h4 className="text-sm font-medium text-[#94A3B8] mb-3 flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-[#F59E0B]" />
                                        Recommended Tools
                                    </h4>
                                    {prdAnalysis.recommended_tools && Object.keys(prdAnalysis.recommended_tools).length > 0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {Object.entries(prdAnalysis.recommended_tools).map(([category, tools]) => (
                                                tools && Array.isArray(tools) && tools.length > 0 && (
                                                    <div key={category} className="bg-[rgba(244,246,255,0.03)] rounded-xl p-3">
                                                        <p className="text-xs font-medium text-[#64748B] capitalize mb-2">{category}</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {tools.slice(0, 3).map((tool, idx) => (
                                                                <span key={idx} className="text-xs bg-[rgba(99,102,241,0.1)] text-[#818CF8] px-2 py-0.5 rounded">
                                                                    {tool}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-xl p-4 text-center">
                                            <p className="text-sm text-[#64748B]">No recommended tools data available. Re-analyze PRD to generate.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Cost Analysis */}
                                <div className="mb-6">
                                    <h4 className="text-sm font-medium text-[#94A3B8] mb-3 flex items-center gap-2">
                                        <DollarSign className="w-4 h-4 text-[#10B981]" />
                                        Cost Analysis
                                    </h4>
                                    {prdAnalysis.cost_analysis && (prdAnalysis.cost_analysis.infrastructure || prdAnalysis.cost_analysis.development) ? (
                                        <div className="grid grid-cols-2 gap-4">
                                            {prdAnalysis.cost_analysis.infrastructure && (
                                                <div className="bg-[rgba(16,185,129,0.05)] border border-[rgba(16,185,129,0.2)] rounded-xl p-4">
                                                    <p className="text-xs text-[#64748B] mb-1">Infrastructure (Monthly)</p>
                                                    <p className="text-xl font-bold text-[#10B981]">{prdAnalysis.cost_analysis.infrastructure.monthly || 'N/A'}</p>
                                                    {prdAnalysis.cost_analysis.infrastructure.breakdown && prdAnalysis.cost_analysis.infrastructure.breakdown.length > 0 && (
                                                        <div className="mt-2 space-y-1">
                                                            {prdAnalysis.cost_analysis.infrastructure.breakdown.slice(0, 3).map((item, idx) => (
                                                                <div key={idx} className="flex justify-between text-xs">
                                                                    <span className="text-[#64748B]">{item.item}</span>
                                                                    <span className="text-[#94A3B8]">{item.cost}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {prdAnalysis.cost_analysis.development && (
                                                <div className="bg-[rgba(99,102,241,0.05)] border border-[rgba(99,102,241,0.2)] rounded-xl p-4">
                                                    <p className="text-xs text-[#64748B] mb-1">Development</p>
                                                    <p className="text-xl font-bold text-[#6366F1]">{prdAnalysis.cost_analysis.development.total || 'N/A'}</p>
                                                    {prdAnalysis.cost_analysis.development.breakdown && prdAnalysis.cost_analysis.development.breakdown.length > 0 && (
                                                        <div className="mt-2 space-y-1">
                                                            {prdAnalysis.cost_analysis.development.breakdown.slice(0, 3).map((item, idx) => (
                                                                <div key={idx} className="flex justify-between text-xs">
                                                                    <span className="text-[#64748B]">{item.item}</span>
                                                                    <span className="text-[#94A3B8]">{item.cost}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {prdAnalysis.cost_analysis.total_estimated && (
                                                <div className="col-span-2 bg-[rgba(99,102,241,0.05)] border border-[rgba(99,102,241,0.2)] rounded-xl p-3 text-center">
                                                    <p className="text-sm text-[#64748B]">Total Estimated: <span className="text-lg font-bold text-[#6366F1]">{prdAnalysis.cost_analysis.total_estimated}</span></p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-xl p-4 text-center">
                                            <p className="text-sm text-[#64748B]">No cost analysis data available. Re-analyze PRD to generate.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Risks */}
                                {prdAnalysis.risks && prdAnalysis.risks.length > 0 && (
                                    <div className="mb-6">
                                        <h4 className="text-sm font-medium text-[#94A3B8] mb-3 flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                                            Risk Assessment
                                        </h4>
                                        <div className="space-y-3">
                                            {prdAnalysis.risks.map((risk, idx) => (
                                                <div key={idx} className="bg-[rgba(245,158,11,0.05)] border border-[rgba(245,158,11,0.2)] rounded-xl p-4">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <p className="text-sm font-medium text-[#F59E0B]">{risk.risk}</p>
                                                        <Badge className="bg-[#F59E0B]/10 text-[#F59E0B] border-0 text-xs">
                                                            {risk.impact}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-[#94A3B8]">
                                                        <span className="text-[#64748B]">Mitigation:</span> {risk.mitigation}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Active Sprints Section */}
                                {sprints.length > 0 && (
                                    <div className="mb-6">
                                        <h4 className="text-sm font-medium text-[#94A3B8] mb-3 flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-[#10B981]" />
                                            Active Sprints ({sprints.length})
                                        </h4>
                                        <div className="space-y-3">
                                            {sprints.map((sprint) => (
                                                <div key={sprint.id} className={`bg-[rgba(244,246,255,0.03)] border rounded-xl p-4 ${
                                                    sprint.status === 'active' ? 'border-[#10B981]/30 bg-[#10B981]/5' : 
                                                    sprint.status === 'completed' ? 'border-[#6366F1]/30' : 'border-[rgba(244,246,255,0.06)]'
                                                }`}>
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-2 h-2 rounded-full ${
                                                                sprint.status === 'active' ? 'bg-[#10B981] animate-pulse' :
                                                                sprint.status === 'completed' ? 'bg-[#6366F1]' : 'bg-[#64748B]'
                                                            }`} />
                                                            <p className="text-sm font-medium text-white">{sprint.name}</p>
                                                            <Badge className={`text-xs border-0 ${
                                                                sprint.status === 'active' ? 'bg-[#10B981]/20 text-[#10B981]' :
                                                                sprint.status === 'completed' ? 'bg-[#6366F1]/20 text-[#6366F1]' :
                                                                'bg-[#64748B]/20 text-[#64748B]'
                                                            }`}>
                                                                {sprint.status}
                                                            </Badge>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs text-[#64748B]">
                                                                {sprint.start_date && sprint.end_date ? (
                                                                    `${new Date(sprint.start_date).toLocaleDateString()} - ${new Date(sprint.end_date).toLocaleDateString()}`
                                                                ) : 'Dates not set'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {sprint.goal && (
                                                        <p className="text-xs text-[#94A3B8] mb-3">{sprint.goal}</p>
                                                    )}
                                                    {/* Progress Bar */}
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="flex-1 h-2 bg-[rgba(244,246,255,0.06)] rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full bg-gradient-to-r from-[#6366F1] to-[#10B981] rounded-full transition-all"
                                                                style={{ width: `${sprint.completion_pct}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs font-medium text-[#10B981]">{sprint.completion_pct}%</span>
                                                    </div>
                                                    {/* Stats */}
                                                    <div className="flex items-center gap-4 text-xs">
                                                        <span className="text-[#64748B]">{sprint.total_items} items</span>
                                                        <span className="text-[#10B981]">{sprint.done_count} done</span>
                                                        <span className="text-[#F59E0B]">{sprint.in_progress_count} in progress</span>
                                                        <span className="text-[#64748B]">{sprint.total_points} pts</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Timeline */}
                                <div>
                                    <h4 className="text-sm font-medium text-[#94A3B8] mb-3 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-[#6366F1]" />
                                        Project Timeline
                                    </h4>
                                    {prdAnalysis.timeline && prdAnalysis.timeline.length > 0 ? (
                                        <div className="space-y-3">
                                            {prdAnalysis.timeline.map((phase, idx) => (
                                                <div key={idx} className="flex items-start gap-4">
                                                    <div className="w-8 h-8 rounded-full bg-[#6366F1]/10 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-xs font-bold text-[#6366F1]">{idx + 1}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <p className="text-sm font-medium text-white">{phase.phase}</p>
                                                            <span className="text-xs text-[#6366F1]">{phase.duration}</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {phase.tasks && phase.tasks.slice(0, 3).map((task, taskIdx) => (
                                                                <span key={taskIdx} className="text-xs bg-[rgba(244,246,255,0.03)] text-[#94A3B8] px-2 py-0.5 rounded">
                                                                    {task}
                                                                </span>
                                                            ))}
                                                            {phase.tasks && phase.tasks.length > 3 && (
                                                                <span className="text-xs text-[#64748B]">+{phase.tasks.length - 3} more</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-xl p-4 text-center">
                                            <p className="text-sm text-[#64748B]">No timeline data available. Provide a PRD with timeline details to generate phases.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Architecture Section */}
                        {project.selected_architecture && (() => {
                            const arch = project.selected_architecture!;
                            return (
                            <div className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-2xl overflow-hidden">
                                <div className="p-4 border-b border-[rgba(244,246,255,0.06)] flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Layers className="w-5 h-5 text-[#6366F1]" />
                                        <div>
                                            <h3 className="font-semibold text-white">Selected Architecture</h3>
                                            <p className="text-xs text-[#64748B]">{arch.name}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setEditingArchitecture(arch)}
                                            className="text-[#64748B] hover:text-white"
                                        >
                                            <Pencil className="w-4 h-4 mr-2" />
                                            Edit
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => navigate(`/project/${project.id}/board`)}
                                            className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:from-[#5558E6] hover:to-[#4338CA] text-white"
                                        >
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            AI Generate
                                        </Button>
                                    </div>
                                </div>
                                <div className="p-4 bg-[#0B0D14] min-h-[400px]">
                                    <MermaidRenderer 
                                        code={arch.mermaid_code} 
                                        className="w-full h-full min-h-[350px]"
                                    />
                                </div>
                                
                                {/* Architecture Details */}
                                <div className="p-4 border-t border-[rgba(244,246,255,0.06)] space-y-4">
                                    {/* Quick Stats Row */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-[rgba(244,246,255,0.02)] rounded-xl p-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <TrendingUp className="w-4 h-4 text-[#F59E0B]" />
                                                <span className="text-xs text-[#64748B]">Complexity</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-lg font-bold text-[#F59E0B] capitalize">{arch.complexity}</p>
                                                <div className="flex gap-0.5">
                                                    {[1, 2, 3].map((level) => (
                                                        <div 
                                                            key={level}
                                                            className={`w-2 h-2 rounded-full ${
                                                                arch.complexity === 'high' ? 'bg-[#F59E0B]' :
                                                                arch.complexity === 'medium' && level <= 2 ? 'bg-[#F59E0B]' :
                                                                arch.complexity === 'low' && level === 1 ? 'bg-[#F59E0B]' :
                                                                'bg-[#334155]'
                                                            }`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-[rgba(244,246,255,0.02)] rounded-xl p-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Clock className="w-4 h-4 text-[#6366F1]" />
                                                <span className="text-xs text-[#64748B]">Timeline</span>
                                            </div>
                                            <p className="text-lg font-bold text-[#6366F1]">{arch.time_to_implement}</p>
                                        </div>
                                        <div className="bg-[rgba(244,246,255,0.02)] rounded-xl p-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <DollarSign className="w-4 h-4 text-[#10B981]" />
                                                <span className="text-xs text-[#64748B]">Est. Cost</span>
                                            </div>
                                            <p className="text-lg font-bold text-[#10B981]">{arch.estimated_cost}</p>
                                        </div>
                                    </div>

                                    {/* Pros & Cons */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {arch.pros && arch.pros.length > 0 && (
                                            <div>
                                                <h4 className="text-xs font-medium text-[#10B981] mb-2 flex items-center gap-1">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Advantages
                                                </h4>
                                                <ul className="space-y-1">
                                                    {arch.pros.map((pro, idx) => (
                                                        <li key={idx} className="text-xs text-[#94A3B8] flex items-start gap-2">
                                                            <span className="text-[#10B981] mt-1">•</span>
                                                            {pro}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {arch.cons && arch.cons.length > 0 && (
                                            <div>
                                                <h4 className="text-xs font-medium text-[#EF4444] mb-2 flex items-center gap-1">
                                                    <AlertCircle className="w-3.5 h-3.5" />
                                                    Considerations
                                                </h4>
                                                <ul className="space-y-1">
                                                    {arch.cons.map((con, idx) => (
                                                        <li key={idx} className="text-xs text-[#94A3B8] flex items-start gap-2">
                                                            <span className="text-[#EF4444] mt-1">•</span>
                                                            {con}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>

                                    {/* Tools Recommended */}
                                    {arch.tools_recommended && Object.keys(arch.tools_recommended).length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-medium text-[#94A3B8] mb-2 flex items-center gap-1">
                                                <Wrench className="w-3.5 h-3.5 text-[#F59E0B]" />
                                                Recommended Tools
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                {Object.entries(arch.tools_recommended).map(([category, tools]) => (
                                                    tools && Array.isArray(tools) && tools.map((tool, idx) => (
                                                        <span key={`${category}-${idx}`} className="text-xs bg-[rgba(99,102,241,0.1)] text-[#818CF8] px-2 py-1 rounded-lg">
                                                            {tool}
                                                        </span>
                                                    ))
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            );
                        })()}

                        {/* All Architectures History */}
                        {project.architectures && project.architectures.length > 0 && (
                            <div className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-2xl p-6">
                                <h3 className="font-semibold text-white mb-4">Architecture History</h3>
                                <div className="space-y-3">
                                    {project.architectures.map((arch) => (
                                        <div 
                                            key={arch.id} 
                                            className={`p-4 rounded-xl border ${arch.is_selected ? 'border-[#6366F1] bg-[#6366F1]/10' : 'border-[rgba(244,246,255,0.06)] bg-[rgba(244,246,255,0.02)]'}`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-medium text-white">{arch.name}</h4>
                                                        {arch.is_selected && (
                                                            <Badge className="bg-[#6366F1] text-white border-0 text-[10px]">
                                                                Selected
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-[#64748B] mt-1">
                                                        {new Date(arch.created_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setEditingArchitecture(arch)}
                                                        className="text-[#64748B] hover:text-white h-8"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5 mr-1" />
                                                        Edit
                                                    </Button>
                                                    {!arch.is_selected && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleSelectArchitecture(arch.id)}
                                                            className="bg-gradient-to-r from-[#475569] to-[#334155] hover:from-[#6366F1] hover:to-[#4F46E5] text-white h-8"
                                                        >
                                                            Select
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Developers Tab */}
                {activeTab === 'developers' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">Project Team</h2>
                            <Button
                                onClick={() => setShowAddDeveloper(true)}
                                className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:from-[#5558E6] hover:to-[#4338CA] text-white font-medium shadow-lg shadow-[#4F46E5]/20 disabled:opacity-50"
                                disabled={availableDevelopers.length === 0}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Developer
                            </Button>
                        </div>

                        {/* Developers List */}
                        <div className="space-y-3">
                            {project.developers.length === 0 ? (
                                <div className="text-center py-12 bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-2xl">
                                    <Users className="w-12 h-12 text-[#334155] mx-auto mb-3" />
                                    <p className="text-[#64748B]">No developers assigned yet</p>
                                    <Button
                                        onClick={() => setShowAddDeveloper(true)}
                                        variant="ghost"
                                        className="text-[#6366F1] mt-2"
                                    >
                                        Add your first developer
                                    </Button>
                                </div>
                            ) : (
                                project.developers.map((dev) => (
                                    <div
                                        key={dev.id}
                                        className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-xl p-4 flex items-start justify-between"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6366F1] to-[#4F46E5] flex items-center justify-center text-white font-semibold">
                                                {dev.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-white">{dev.name}</h3>
                                                <p className="text-sm text-[#64748B]">{dev.email}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <Badge className="bg-[#6366F1]/20 text-[#6366F1] border-0">
                                                        {dev.role}
                                                    </Badge>
                                                    {dev.github_username && (
                                                        <Badge variant="outline" className="text-[#64748B] border-[rgba(244,246,255,0.1)]">
                                                            <Github className="w-3 h-3 mr-1" />
                                                            {dev.github_username}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {dev.responsibilities && (
                                                    <p className="text-sm text-[#94A3B8] mt-2">
                                                        {dev.responsibilities}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRemoveDeveloper(dev.id)}
                                            className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Add Developer Modal */}
                        {showAddDeveloper && (
                            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                                <div className="bg-[#0F1118] border border-[rgba(244,246,255,0.08)] rounded-2xl w-full max-w-md shadow-2xl">
                                    <div className="flex items-center justify-between p-5 border-b border-[rgba(244,246,255,0.06)]">
                                        <h2 className="text-lg font-bold text-white">Add Developer</h2>
                                        <button
                                            onClick={() => setShowAddDeveloper(false)}
                                            className="p-2 rounded-lg hover:bg-[rgba(244,246,255,0.05)] text-[#475569] hover:text-white"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="p-5 space-y-4">
                                        <div>
                                            <label className="text-xs font-medium text-[#64748B] block mb-1.5">Developer</label>
                                            <select
                                                value={newDeveloper.developer_id}
                                                onChange={(e) => setNewDeveloper(d => ({ ...d, developer_id: e.target.value }))}
                                                className="w-full h-10 bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.08)] text-[#E2E8F0] rounded-xl px-3 text-sm"
                                            >
                                                <option value="">Select a developer</option>
                                                {availableDevelopers.map((dev) => (
                                                    <option key={dev.id} value={dev.id}>
                                                        {dev.name} ({dev.email})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-[#64748B] block mb-1.5">Role</label>
                                            <Input
                                                value={newDeveloper.role}
                                                onChange={(e) => setNewDeveloper(d => ({ ...d, role: e.target.value }))}
                                                placeholder="e.g., Backend Developer"
                                                className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-[#64748B] block mb-1.5">Responsibilities</label>
                                            <Textarea
                                                value={newDeveloper.responsibilities}
                                                onChange={(e) => setNewDeveloper(d => ({ ...d, responsibilities: e.target.value }))}
                                                placeholder="What will this developer work on?"
                                                className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl min-h-[80px]"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-3 p-5 border-t border-[rgba(244,246,255,0.06)]">
                                        <Button
                                            variant="ghost"
                                            onClick={() => setShowAddDeveloper(false)}
                                            className="text-[#64748B] rounded-xl"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleAddDeveloper}
                                            disabled={!newDeveloper.developer_id || !newDeveloper.role}
                                            className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:from-[#5558E6] hover:to-[#4338CA] text-white rounded-xl font-medium shadow-lg shadow-[#4F46E5]/20 disabled:opacity-50"
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add Developer
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* GitHub Tab */}
                {activeTab === 'github' && (
                    <div className="space-y-6">
                        <div className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 rounded-xl bg-[#6366F1]/10 flex items-center justify-center">
                                    <Github className="w-6 h-6 text-[#6366F1]" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">GitHub Integration</h2>
                                    <p className="text-sm text-[#64748B]">Manage repository access for your team</p>
                                </div>
                            </div>

                            {/* Repository Info */}
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="text-xs font-medium text-[#64748B] block mb-1.5">Repository URL</label>
                                    {isEditing ? (
                                        <Input
                                            value={editForm.github_repo_url || ''}
                                            onChange={(e) => setEditForm(f => ({ ...f, github_repo_url: e.target.value }))}
                                            placeholder="https://github.com/username/repo"
                                            className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl"
                                        />
                                    ) : project.github_repo_url ? (
                                        <a
                                            href={project.github_repo_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-sm text-[#6366F1] hover:underline"
                                        >
                                            {project.github_repo_url}
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    ) : (
                                        <div className="flex items-center gap-2 text-sm text-[#475569]">
                                            <AlertCircle className="w-4 h-4" />
                                            No repository configured
                                        </div>
                                    )}
                                </div>

                                {!isEditing && !project.github_repo_url && (
                                    <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl p-4">
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="w-5 h-5 text-[#F59E0B] mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-[#F59E0B]">Repository not configured</p>
                                                <p className="text-xs text-[#94A3B8] mt-1">
                                                    Add a GitHub repository URL in the Overview tab to send invitations to your team.
                                                </p>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setActiveTab('overview')}
                                                    className="text-[#6366F1] mt-2"
                                                >
                                                    Go to Overview
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Invitation Status */}
                            {githubStatus && (
                                <div className="bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.06)] rounded-xl p-4 mb-6">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-white">{githubStatus.developer_count}</p>
                                            <p className="text-xs text-[#64748B]">Developers with GitHub</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-[#10B981]">{githubStatus.sent_count}</p>
                                            <p className="text-xs text-[#64748B]">Invitations Sent</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-[#6366F1]">
                                                {githubStatus.developer_count - githubStatus.sent_count}
                                            </p>
                                            <p className="text-xs text-[#64748B]">Pending</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Send Invitations Button */}
                            {project.github_repo_url && (
                                <Button
                                    onClick={handleSendGitHubInvites}
                                    disabled={isSendingInvites || project.developers.length === 0}
                                    className="w-full bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:from-[#5558E6] hover:to-[#4338CA] text-white rounded-xl h-12"
                                >
                                    {isSendingInvites ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                            Sending Invitations...
                                        </>
                                    ) : (
                                        <>
                                            <Mail className="w-4 h-4 mr-2" />
                                            Send GitHub Invitations to Team
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>

                        {/* Developers with GitHub */}
                        {project.developers.length > 0 && (
                            <div className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-2xl p-6">
                                <h3 className="text-sm font-semibold text-white mb-4">Team GitHub Accounts</h3>
                                <div className="space-y-2">
                                    {project.developers.map((dev) => (
                                        <div
                                            key={dev.id}
                                            className="flex items-center justify-between py-2 border-b border-[rgba(244,246,255,0.04)] last:border-0"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366F1] to-[#4F46E5] flex items-center justify-center text-white text-sm font-semibold">
                                                    {dev.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-sm text-[#E2E8F0]">{dev.name}</span>
                                            </div>
                                            {dev.github_username ? (
                                                <Badge className="bg-[#10B981]/20 text-[#10B981] border-0">
                                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                                    {dev.github_username}
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[#F59E0B] border-[#F59E0B]/30">
                                                    <AlertCircle className="w-3 h-3 mr-1" />
                                                    No GitHub
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

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

export default ProjectDetail;
