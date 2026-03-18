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
    Github,
    Settings,
    LogOut,
} from 'lucide-react';
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

    const handleSendGitHubInvites = async (e: React.MouseEvent, project: Project) => {
        e.stopPropagation();
        if (!project.github_repo_url) {
            toast.error('No GitHub repository configured for this project');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/projects/${project.id}/github-invite`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
            });
            
            const data = await response.json();
            
            if (data.success) {
                toast.success(`GitHub invitations sent! ${data.successful} successful, ${data.failed} failed`);
            } else {
                toast.error(data.message || 'Failed to send some invitations');
            }
        } catch (err) {
            toast.error('Failed to send GitHub invitations');
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

            <div className="max-w-[1400px] mx-auto px-8 py-10">
                {/* Stats Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
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

                {/* Search & Actions */}
                <div className="flex items-center justify-between mb-8 gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
                        <Input
                            placeholder="Search projects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl h-11 focus:border-[#E0B954]/50 focus:ring-[#E0B954]/20 placeholder:text-[#334155]"
                        />
                    </div>
                    {user?.role === 'admin' && (
                        <Button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-gradient-to-r from-[#E0B954] to-[#C79E3B] hover:opacity-90 text-[#080808] font-semibold rounded-xl h-11 px-6 font-medium shadow-lg shadow-[#B8872A]/20 transition-all duration-300 hover:shadow-[#B8872A]/30 hover:scale-[1.02]"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            New Project
                        </Button>
                    )}
                </div>

                {/* Projects Grid */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-32">
                        <div className="w-8 h-8 border-2 border-[#E0B954]/30 border-t-[#E0B954] rounded-full animate-spin" />
                    </div>
                ) : filteredProjects.length === 0 && !searchQuery ? (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#E0B954]/20 to-[#B8872A]/10 flex items-center justify-center mb-6 border border-[#E0B954]/20">
                            <FolderKanban className="w-10 h-10 text-[#E0B954]" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">No projects yet</h2>
                        <p className="text-[#737373] max-w-md mb-8">
                            {user?.role === 'admin' 
                                ? "Create your first project to get started with AI-powered project management."
                                : "Contact an admin to create a project for you."
                            }
                        </p>
                        {user?.role === 'admin' && (
                            <Button
                                onClick={() => setShowCreateModal(true)}
                                className="bg-gradient-to-r from-[#E0B954] to-[#C79E3B] hover:opacity-90 text-[#080808] font-semibold rounded-xl h-12 px-8 font-medium shadow-lg shadow-[#B8872A]/20"
                            >
                                <Plus className="w-5 h-5 mr-2" />
                                Create First Project
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredProjects.map((project, idx) => {
                            const stats = project.work_item_stats;
                            const gradients = [
                                'from-[#E0B954]/10 to-[#4338CA]/5',
                                'from-[#F59E0B]/10 to-[#D97706]/5',
                                'from-[#E0B954]/10 to-[#C79E3B]/5',
                                'from-[#C79E3B]/10 to-[#B8872A]/5',
                                'from-[#EC4899]/10 to-[#DB2777]/5',
                                'from-[#06B6D4]/10 to-[#0891B2]/5',
                            ];
                            const accentColors = ['#E0B954', '#F59E0B', '#E0B954', '#C79E3B', '#EC4899', '#06B6D4'];
                            const accent = accentColors[idx % accentColors.length];

                            return (
                                <div
                                    key={project.id}
                                    className="group relative cursor-pointer"
                                    onClick={() => navigate(`/project/${project.id}`)}
                                >
                                    {/* Hover glow effect */}
                                    <div
                                        className="absolute -inset-[1px] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"
                                        style={{ background: `linear-gradient(135deg, ${accent}33, transparent)` }}
                                    />

                                    <div className={`relative bg-gradient-to-br ${gradients[idx % gradients.length]} border border-[rgba(255,255,255,0.05)] rounded-2xl p-6 transition-all duration-300 group-hover:border-[rgba(244,246,255,0.12)] group-hover:translate-y-[-2px] overflow-hidden`}>
                                        {/* Background pattern */}
                                        <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                                            <FolderKanban className="w-full h-full" style={{ color: accent }} />
                                        </div>

                                        {/* Header */}
                                        <div className="flex items-start justify-between mb-4 relative">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-lg"
                                                    style={{ backgroundColor: accent, boxShadow: `0 4px 12px ${accent}33` }}
                                                >
                                                    {project.key_prefix.substring(0, 2)}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold text-white group-hover:text-white/95 transition-colors line-clamp-1">{project.name}</h3>
                                                    <span className="text-xs font-mono text-[#737373]">{project.key_prefix}</span>
                                                </div>
                                            </div>
                                            {project.github_repo_url && (
                                                <button
                                                    onClick={(e) => handleSendGitHubInvites(e, project)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[#E0B954]/10 text-[#737373] hover:text-[#E0B954] mr-1"
                                                    title="Send GitHub invitations"
                                                >
                                                    <Github className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => handleDeleteProject(e, project.id)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10 text-[#737373] hover:text-red-400"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Description */}
                                        <p className="text-sm text-[#737373] mb-5 line-clamp-2 min-h-[40px]">{project.description || 'No description'}</p>

                                        {/* Progress */}
                                        <div className="mb-5">
                                            <div className="flex items-center justify-between text-xs mb-2">
                                                <span className="text-[#737373] font-medium">Progress</span>
                                                <span className="font-semibold" style={{ color: accent }}>{stats.completion_pct}%</span>
                                            </div>
                                            <div className="h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                                    style={{
                                                        width: `${stats.completion_pct}%`,
                                                        background: `linear-gradient(90deg, ${accent}, ${accent}BB)`,
                                                        boxShadow: stats.completion_pct > 0 ? `0 0 8px ${accent}44` : 'none',
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Stats Row */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-1.5">
                                                    <Layers className="w-3.5 h-3.5 text-[#737373]" />
                                                    <span className="text-xs text-[#737373] font-medium">{stats.total} items</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <BarChart3 className="w-3.5 h-3.5 text-[#737373]" />
                                                    <span className="text-xs text-[#737373] font-medium">{stats.total_points} pts</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 text-[#737373] group-hover:text-[#E0B954] transition-colors">
                                                <span className="text-xs font-medium">Open</span>
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Create Project Card - Admin only */}
                        {user?.role === 'admin' && (
                            <div
                                className="group cursor-pointer"
                                onClick={() => setShowCreateModal(true)}
                            >
                                <div className="border-2 border-dashed border-[rgba(255,255,255,0.07)] rounded-2xl p-6 flex flex-col items-center justify-center min-h-[260px] transition-all duration-300 group-hover:border-[#E0B954]/30 group-hover:bg-[#E0B954]/5">
                                    <div className="w-14 h-14 rounded-2xl bg-[rgba(244,246,255,0.05)] flex items-center justify-center mb-4 group-hover:bg-[#E0B954]/20 transition-all duration-300 group-hover:scale-110">
                                        <Plus className="w-6 h-6 text-[#737373] group-hover:text-[#E0B954] transition-colors" />
                                    </div>
                                    <span className="text-sm font-medium text-[#737373] group-hover:text-[#E0B954] transition-colors">
                                        Create New Project
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
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
