import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    FolderKanban,
    Ticket,
    Calendar,
    Plus,
    Pencil,
    Trash2,
    X,
    Save,
    ArrowLeft,
    BarChart3,
    Github,
    Settings,
    ExternalLink,
    Shield,
    UserCog,
    Key,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast, Toaster } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

import { API_BASE_URL } from '@/config/api';

interface Employee {
    id: number;
    name: string;
    email: string;
    github_username: string | null;
    avatar_url: string | null;
    specialization: string | null;
    created_at: string;
    updated_at: string;
    project_count: number;
    assigned_items_count: number;
}

interface User {
    id: number;
    email: string;
    name: string;
    role: 'admin' | 'developer';
    is_active: boolean;
    is_first_login: boolean;
    created_at: string;
    last_login_at: string | null;
}

interface Project {
    id: number;
    name: string;
    description: string | null;
    status: string;
    created_at: string;
    total_items: number;
    done_items: number;
    completion_pct: number;
    developer_count: number;
    github_repo_url: string | null;
    github_repo_name: string | null;
    has_github_token: boolean;
}

interface DashboardStats {
    total_employees: number;
    total_projects: number;
    total_tickets: number;
    active_sprints: number;
    tickets_by_status: Record<string, number>;
    tickets_by_priority: Record<string, number>;
}

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'projects' | 'users'>('dashboard');
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const { token } = useAuth();
    
    // Employee form state
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [employeeForm, setEmployeeForm] = useState({
        name: '',
        email: '',
        github_username: '',
        specialization: '',
    });

    // GitHub settings state
    const [showGitHubModal, setShowGitHubModal] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [gitHubForm, setGitHubForm] = useState({
        github_repo_url: '',
        github_repo_name: '',
        github_token: '',
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statsRes, employeesRes, projectsRes, usersRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/admin/stats`),
                fetch(`${API_BASE_URL}/api/admin/employees`),
                fetch(`${API_BASE_URL}/api/admin/projects`),
                fetch(`${API_BASE_URL}/api/auth/admin/users`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
            ]);

            if (statsRes.ok) setStats(await statsRes.json());
            if (employeesRes.ok) setEmployees(await employeesRes.json());
            if (projectsRes.ok) setProjects(await projectsRes.json());
            if (usersRes.ok) setUsers(await usersRes.json());
        } catch (error) {
            console.error('Failed to fetch admin data:', error);
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateEmployee = () => {
        setEditingEmployee(null);
        setEmployeeForm({ name: '', email: '', github_username: '', specialization: '' });
        setShowEmployeeModal(true);
    };

    const handleEditEmployee = (employee: Employee) => {
        setEditingEmployee(employee);
        setEmployeeForm({
            name: employee.name,
            email: employee.email,
            github_username: employee.github_username || '',
            specialization: employee.specialization || '',
        });
        setShowEmployeeModal(true);
    };

    const handleSaveEmployee = async () => {
        if (!employeeForm.name.trim() || !employeeForm.email.trim()) {
            toast.error('Name and email are required');
            return;
        }

        try {
            const url = editingEmployee
                ? `${API_BASE_URL}/api/admin/employees/${editingEmployee.id}`
                : `${API_BASE_URL}/api/admin/employees`;
            const method = editingEmployee ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(employeeForm),
            });

            if (response.ok) {
                toast.success(editingEmployee ? 'Employee updated!' : 'Employee created!');
                setShowEmployeeModal(false);
                fetchData();
            } else {
                const error = await response.json();
                toast.error(error.detail || 'Failed to save employee');
            }
        } catch {
            toast.error('Failed to save employee');
        }
    };

    const handleDeleteEmployee = async (id: number) => {
        if (!confirm('Are you sure you want to delete this employee?')) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/employees/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                toast.success('Employee deleted');
                fetchData();
            } else {
                toast.error('Failed to delete employee');
            }
        } catch {
            toast.error('Failed to delete employee');
        }
    };

    // GitHub settings functions
    const handleEditGitHubSettings = (project: Project, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingProject(project);
        setGitHubForm({
            github_repo_url: project.github_repo_url || '',
            github_repo_name: project.github_repo_name || '',
            github_token: '', // Don't show existing token
        });
        setShowGitHubModal(true);
    };

    const handleSaveGitHubSettings = async () => {
        if (!editingProject) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/projects/${editingProject.id}/github`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(gitHubForm),
            });

            if (response.ok) {
                toast.success('GitHub settings updated!');
                setShowGitHubModal(false);
                fetchData();
            } else {
                toast.error('Failed to update GitHub settings');
            }
        } catch {
            toast.error('Failed to update GitHub settings');
        }
    };

    // User management functions
    const [showUserModal, setShowUserModal] = useState(false);
    const [userForm, setUserForm] = useState({ email: '', name: '', role: 'developer' });
    const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

    const handleCreateUser = () => {
        setUserForm({ email: '', name: '', role: 'developer' });
        setGeneratedPassword(null);
        setShowUserModal(true);
    };

    const handleSaveUser = async () => {
        if (!userForm.email.trim() || !userForm.name.trim()) {
            toast.error('Email and name are required');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/admin/create-user`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userForm),
            });

            if (response.ok) {
                const data = await response.json();
                toast.success('User created successfully!');
                setGeneratedPassword(data.temporary_password);
                fetchData();
            } else {
                const error = await response.json();
                toast.error(error.detail || 'Failed to create user');
            }
        } catch {
            toast.error('Failed to create user');
        }
    };

    const handleToggleUserRole = async (user: User) => {
        const newRole = user.role === 'admin' ? 'developer' : 'admin';
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/admin/users/${user.id}/role`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ role: newRole }),
            });

            if (response.ok) {
                toast.success(`User is now ${newRole}`);
                fetchData();
            } else {
                toast.error('Failed to update role');
            }
        } catch {
            toast.error('Failed to update role');
        }
    };

    const handleResetPassword = async (user: User) => {
        if (!confirm(`Reset password for ${user.name}? They will need to change it on next login.`)) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/admin/reset-password`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ user_id: user.id, new_password: 'TempPass123!' }),
            });

            if (response.ok) {
                toast.success('Password reset! New password: TempPass123!');
                fetchData();
            } else {
                toast.error('Failed to reset password');
            }
        } catch {
            toast.error('Failed to reset password');
        }
    };

    const handleDeleteUser = async (user: User) => {
        if (!confirm(`Are you sure you want to deactivate ${user.name}? They will no longer be able to login.`)) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/admin/users/${user.id}`, {
                method: 'DELETE',
                headers: { 
                    'Authorization': `Bearer ${token}`
                },
            });

            if (response.ok) {
                toast.success(`User ${user.name} has been deactivated`);
                fetchData();
            } else {
                const error = await response.json();
                toast.error(error.detail || 'Failed to delete user');
            }
        } catch {
            toast.error('Failed to delete user');
        }
    };

    return (
        <div className="min-h-screen bg-[#0B0D14] text-white">
            <Toaster position="top-right" theme="dark" />
            
            {/* Header */}
            <div className="border-b border-[rgba(244,246,255,0.06)] bg-[#0F1118]">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                onClick={() => navigate('/')}
                                className="text-[#64748B] hover:text-white"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Projects
                            </Button>
                            <div className="h-6 w-px bg-[rgba(244,246,255,0.1)]" />
                            <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-[rgba(244,246,255,0.06)]">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex gap-1">
                        {[
                            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
                            { id: 'employees', label: 'Employees', icon: Users },
                            { id: 'projects', label: 'Projects', icon: FolderKanban },
                            { id: 'users', label: 'Users', icon: Shield },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                className={`px-4 py-3 flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-[#6366F1] text-white'
                                        : 'border-transparent text-[#64748B] hover:text-white'
                                }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-6">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin w-8 h-8 border-2 border-[#6366F1] border-t-transparent rounded-full" />
                    </div>
                ) : (
                    <>
                        {/* Dashboard Tab */}
                        {activeTab === 'dashboard' && stats && (
                            <div className="space-y-6">
                                {/* Stats Cards */}
                                <div className="grid grid-cols-4 gap-4">
                                    {[
                                        { label: 'Total Employees', value: stats.total_employees, icon: Users, color: '#6366F1' },
                                        { label: 'Total Projects', value: stats.total_projects, icon: FolderKanban, color: '#10B981' },
                                        { label: 'Total Tickets', value: stats.total_tickets, icon: Ticket, color: '#F59E0B' },
                                        { label: 'Active Sprints', value: stats.active_sprints, icon: Calendar, color: '#EC4899' },
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-[#0F1118] border border-[rgba(244,246,255,0.06)] rounded-xl p-5">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="p-2 rounded-lg" style={{ backgroundColor: `${stat.color}20` }}>
                                                    <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                                                </div>
                                            </div>
                                            <div className="text-2xl font-bold text-white">{stat.value}</div>
                                            <div className="text-sm text-[#64748B]">{stat.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Charts */}
                                <div className="grid grid-cols-2 gap-6">
                                    {/* Tickets by Status */}
                                    <div className="bg-[#0F1118] border border-[rgba(244,246,255,0.06)] rounded-xl p-5">
                                        <h3 className="text-lg font-semibold text-white mb-4">Tickets by Status</h3>
                                        <div className="space-y-3">
                                            {Object.entries(stats.tickets_by_status).map(([status, count]) => (
                                                <div key={status} className="flex items-center gap-3">
                                                    <div className="w-24 text-sm text-[#94A3B8] capitalize">{status.replace('_', ' ')}</div>
                                                    <div className="flex-1 h-2 bg-[rgba(244,246,255,0.06)] rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-[#6366F1] rounded-full"
                                                            style={{ width: `${stats.total_tickets ? (count / stats.total_tickets) * 100 : 0}%` }}
                                                        />
                                                    </div>
                                                    <div className="w-12 text-sm text-[#94A3B8] text-right">{count}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Tickets by Priority */}
                                    <div className="bg-[#0F1118] border border-[rgba(244,246,255,0.06)] rounded-xl p-5">
                                        <h3 className="text-lg font-semibold text-white mb-4">Tickets by Priority</h3>
                                        <div className="space-y-3">
                                            {Object.entries(stats.tickets_by_priority).map(([priority, count]) => (
                                                <div key={priority} className="flex items-center gap-3">
                                                    <div className="w-24 text-sm text-[#94A3B8] capitalize">{priority}</div>
                                                    <div className="flex-1 h-2 bg-[rgba(244,246,255,0.06)] rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full"
                                                            style={{
                                                                width: `${stats.total_tickets ? (count / stats.total_tickets) * 100 : 0}%`,
                                                                backgroundColor: priority === 'critical' ? '#EF4444' : priority === 'high' ? '#F97316' : priority === 'medium' ? '#F59E0B' : '#10B981'
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="w-12 text-sm text-[#94A3B8] text-right">{count}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Employees Tab */}
                        {activeTab === 'employees' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-lg font-semibold text-white">Team Members</h2>
                                    <Button
                                        onClick={handleCreateEmployee}
                                        className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white rounded-xl"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Employee
                                    </Button>
                                </div>

                                <div className="bg-[#0F1118] border border-[rgba(244,246,255,0.06)] rounded-xl overflow-hidden">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-[rgba(244,246,255,0.06)]">
                                                <th className="text-left text-xs font-medium text-[#64748B] uppercase tracking-wider px-5 py-3">Name</th>
                                                <th className="text-left text-xs font-medium text-[#64748B] uppercase tracking-wider px-5 py-3">Email</th>
                                                <th className="text-left text-xs font-medium text-[#64748B] uppercase tracking-wider px-5 py-3">GitHub</th>
                                                <th className="text-left text-xs font-medium text-[#64748B] uppercase tracking-wider px-5 py-3">Projects</th>
                                                <th className="text-left text-xs font-medium text-[#64748B] uppercase tracking-wider px-5 py-3">Assigned</th>
                                                <th className="text-right text-xs font-medium text-[#64748B] uppercase tracking-wider px-5 py-3">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {employees.map(emp => (
                                                <tr key={emp.id} className="border-b border-[rgba(244,246,255,0.04)] hover:bg-[rgba(244,246,255,0.02)]">
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-[rgba(99,102,241,0.2)] flex items-center justify-center text-sm font-medium text-[#818CF8]">
                                                                {emp.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-medium text-white">{emp.name}</div>
                                                                {emp.specialization && (
                                                                    <div className="text-xs text-[#64748B] capitalize">{emp.specialization}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-sm text-[#94A3B8]">{emp.email}</td>
                                                    <td className="px-5 py-4 text-sm text-[#64748B]">{emp.github_username || '-'}</td>
                                                    <td className="px-5 py-4 text-sm text-[#94A3B8]">{emp.project_count}</td>
                                                    <td className="px-5 py-4 text-sm text-[#94A3B8]">{emp.assigned_items_count}</td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleEditEmployee(emp)}
                                                                className="text-[#64748B] hover:text-white h-8 w-8 p-0"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDeleteEmployee(emp.id)}
                                                                className="text-red-400 hover:text-red-300 h-8 w-8 p-0"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {employees.length === 0 && (
                                        <div className="text-center py-12 text-[#64748B]">
                                            No employees yet. Click "Add Employee" to get started.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Projects Tab */}
                        {activeTab === 'projects' && (
                            <div className="space-y-4">
                                <h2 className="text-lg font-semibold text-white">All Projects</h2>
                                <div className="grid grid-cols-3 gap-4">
                                    {projects.map(project => (
                                        <div
                                            key={project.id}
                                            className="bg-[#0F1118] border border-[rgba(244,246,255,0.06)] rounded-xl p-5 hover:border-[rgba(99,102,241,0.3)] transition-colors"
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="cursor-pointer flex-1" onClick={() => navigate(`/project/${project.id}`)}>
                                                    <h3 className="text-sm font-semibold text-white">{project.name}</h3>
                                                    <div className="text-xs text-[#64748B] mt-0.5">{project.status}</div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => handleEditGitHubSettings(project, e)}
                                                    className="text-[#64748B] hover:text-white h-7 w-7 p-0"
                                                >
                                                    <Settings className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                            {/* GitHub Info */}
                                            {project.github_repo_url && (
                                                <div className="mb-3 p-2 rounded-lg bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.04)]">
                                                    <div className="flex items-center gap-2">
                                                        <Github className="w-3.5 h-3.5 text-[#64748B]" />
                                                        <a
                                                            href={project.github_repo_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-[#818CF8] hover:underline flex items-center gap-1"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {project.github_repo_name || project.github_repo_url}
                                                            <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                        {project.has_github_token && (
                                                            <span className="ml-auto text-[10px] text-[#10B981]">Token Set</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-4 mt-4 text-xs text-[#64748B]">
                                                <div className="flex items-center gap-1">
                                                    <Users className="w-3.5 h-3.5" />
                                                    {project.developer_count}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Ticket className="w-3.5 h-3.5" />
                                                    {project.total_items}
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-[#64748B]">Progress</span>
                                                    <span className="text-[#94A3B8]">{project.completion_pct}%</span>
                                                </div>
                                                <div className="h-1.5 bg-[rgba(244,246,255,0.06)] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-[#6366F1] to-[#4F46E5] rounded-full"
                                                        style={{ width: `${project.completion_pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* Users Tab */}
                        {activeTab === 'users' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold text-white">User Management</h2>
                                    <Button
                                        onClick={handleCreateUser}
                                        className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:from-[#5558E6] hover:to-[#4338CA] text-white rounded-xl h-10 px-4"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add User
                                    </Button>
                                </div>
                                <div className="bg-[#0F1118] border border-[rgba(244,246,255,0.06)] rounded-xl overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-[rgba(244,246,255,0.02)]">
                                            <tr>
                                                <th className="text-left text-xs font-medium text-[#64748B] py-3 px-4">User</th>
                                                <th className="text-left text-xs font-medium text-[#64748B] py-3 px-4">Role</th>
                                                <th className="text-left text-xs font-medium text-[#64748B] py-3 px-4">Status</th>
                                                <th className="text-left text-xs font-medium text-[#64748B] py-3 px-4">Last Login</th>
                                                <th className="text-right text-xs font-medium text-[#64748B] py-3 px-4">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[rgba(244,246,255,0.04)]">
                                            {users.map(user => (
                                                <tr key={user.id} className="hover:bg-[rgba(244,246,255,0.02)]">
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366F1] to-[#4F46E5] flex items-center justify-center text-white text-sm font-medium">
                                                                {user.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm text-white">{user.name}</div>
                                                                <div className="text-xs text-[#64748B]">{user.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                                            user.role === 'admin' 
                                                                ? 'bg-[#6366F1]/20 text-[#818CF8] border border-[#6366F1]/30' 
                                                                : 'bg-[rgba(244,246,255,0.06)] text-[#94A3B8]'
                                                        }`}>
                                                            {user.role === 'admin' ? <Shield className="w-3 h-3" /> : <UserCog className="w-3 h-3" />}
                                                            {user.role}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {user.is_active ? (
                                                            <span className="inline-flex items-center gap-1 text-xs text-[#10B981]">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                                                                Active
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-xs text-[#64748B]">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-[#64748B]" />
                                                                Inactive
                                                            </span>
                                                        )}
                                                        {user.is_first_login && (
                                                            <span className="ml-2 text-[10px] text-[#F59E0B]">(First Login)</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-[#64748B]">
                                                        {user.last_login_at 
                                                            ? new Date(user.last_login_at).toLocaleDateString() 
                                                            : 'Never'
                                                        }
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleToggleUserRole(user)}
                                                                className="text-[#64748B] hover:text-white h-8"
                                                            >
                                                                <Shield className="w-3.5 h-3.5 mr-1" />
                                                                {user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleResetPassword(user)}
                                                                className="text-[#64748B] hover:text-[#F59E0B] h-8"
                                                            >
                                                                <Key className="w-3.5 h-3.5 mr-1" />
                                                                Reset
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDeleteUser(user)}
                                                                className="text-[#64748B] hover:text-red-400 h-8"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {users.length === 0 && (
                                        <div className="text-center py-12 text-[#64748B]">
                                            No users yet. Click "Add User" to create one.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Employee Modal */}
            {showEmployeeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowEmployeeModal(false)}>
                    <div className="bg-[#0F1118] border border-[rgba(244,246,255,0.08)] rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-[rgba(244,246,255,0.06)]">
                            <h2 className="text-lg font-bold text-white">
                                {editingEmployee ? 'Edit Employee' : 'Add Employee'}
                            </h2>
                            <button onClick={() => setShowEmployeeModal(false)} className="p-2 rounded-lg hover:bg-[rgba(244,246,255,0.05)] text-[#475569] hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="text-xs font-medium text-[#64748B] block mb-1.5">Name *</label>
                                <Input
                                    value={employeeForm.name}
                                    onChange={e => setEmployeeForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="John Doe"
                                    className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl h-10"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-[#64748B] block mb-1.5">Email *</label>
                                <Input
                                    type="email"
                                    value={employeeForm.email}
                                    onChange={e => setEmployeeForm(f => ({ ...f, email: e.target.value }))}
                                    placeholder="john@company.com"
                                    className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl h-10"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-[#64748B] block mb-1.5">GitHub Username</label>
                                <Input
                                    value={employeeForm.github_username}
                                    onChange={e => setEmployeeForm(f => ({ ...f, github_username: e.target.value }))}
                                    placeholder="johndoe"
                                    className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl h-10"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-[#64748B] block mb-1.5">Specialization</label>
                                <select
                                    value={employeeForm.specialization}
                                    onChange={e => setEmployeeForm(f => ({ ...f, specialization: e.target.value }))}
                                    className="w-full h-10 bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.08)] text-[#E2E8F0] rounded-xl px-3 text-sm"
                                >
                                    <option value="">Select specialization</option>
                                    <option value="frontend">Frontend</option>
                                    <option value="backend">Backend</option>
                                    <option value="fullstack">Full Stack</option>
                                    <option value="devops">DevOps</option>
                                    <option value="qa">QA</option>
                                    <option value="mobile">Mobile</option>
                                    <option value="data">Data</option>
                                    <option value="ml">Machine Learning</option>
                                    <option value="design">Design</option>
                                    <option value="pm">Product Manager</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 p-5 border-t border-[rgba(244,246,255,0.06)]">
                            <Button variant="ghost" onClick={() => setShowEmployeeModal(false)} className="text-[#64748B] rounded-xl px-5">Cancel</Button>
                            <Button
                                onClick={handleSaveEmployee}
                                className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white rounded-xl px-6 font-medium shadow-lg shadow-[#4F46E5]/20"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                {editingEmployee ? 'Update' : 'Create'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* User Modal */}
            {showUserModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowUserModal(false)}>
                    <div className="bg-[#0F1118] border border-[rgba(244,246,255,0.08)] rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-[rgba(244,246,255,0.06)]">
                            <h2 className="text-lg font-bold text-white">Add New User</h2>
                            <button onClick={() => setShowUserModal(false)} className="p-2 rounded-lg hover:bg-[rgba(244,246,255,0.05)] text-[#475569] hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            {generatedPassword ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] rounded-xl">
                                        <p className="text-sm text-[#10B981] font-medium mb-2">User Created Successfully!</p>
                                        <p className="text-xs text-[#94A3B8] mb-2">Share this temporary password with the user:</p>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 bg-[rgba(244,246,255,0.05)] px-3 py-2 rounded-lg text-sm text-white font-mono">
                                                {generatedPassword}
                                            </code>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(generatedPassword);
                                                    toast.success('Copied to clipboard');
                                                }}
                                                className="text-[#64748B] hover:text-white"
                                            >
                                                Copy
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-[#64748B]">
                                        They will be required to change this password on first login.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="text-xs font-medium text-[#64748B] block mb-1.5">Name *</label>
                                        <Input
                                            value={userForm.name}
                                            onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))}
                                            placeholder="John Doe"
                                            className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl h-10"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-[#64748B] block mb-1.5">Email *</label>
                                        <Input
                                            type="email"
                                            value={userForm.email}
                                            onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
                                            placeholder="john@company.com"
                                            className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl h-10"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-[#64748B] block mb-1.5">Role</label>
                                        <select
                                            value={userForm.role}
                                            onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}
                                            className="w-full bg-[rgba(244,246,255,0.03)] border border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl h-10 px-3 text-sm"
                                        >
                                            <option value="developer" className="bg-[#0F1118]">Developer</option>
                                            <option value="admin" className="bg-[#0F1118]">Admin</option>
                                        </select>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 p-5 border-t border-[rgba(244,246,255,0.06)]">
                            <Button 
                                variant="ghost" 
                                onClick={() => {
                                    setShowUserModal(false);
                                    setGeneratedPassword(null);
                                }} 
                                className="text-[#64748B] rounded-xl px-5"
                            >
                                {generatedPassword ? 'Close' : 'Cancel'}
                            </Button>
                            {!generatedPassword && (
                                <Button
                                    onClick={handleSaveUser}
                                    className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white rounded-xl px-6 font-medium shadow-lg shadow-[#4F46E5]/20"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create User
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* GitHub Settings Modal */}
            {showGitHubModal && editingProject && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowGitHubModal(false)}>
                    <div className="bg-[#0F1118] border border-[rgba(244,246,255,0.08)] rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-[rgba(244,246,255,0.06)]">
                            <div>
                                <h2 className="text-lg font-bold text-white">GitHub Settings</h2>
                                <p className="text-xs text-[#64748B] mt-0.5">{editingProject.name}</p>
                            </div>
                            <button onClick={() => setShowGitHubModal(false)} className="p-2 rounded-lg hover:bg-[rgba(244,246,255,0.05)] text-[#475569] hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="text-xs font-medium text-[#64748B] block mb-1.5">Repository URL</label>
                                <Input
                                    value={gitHubForm.github_repo_url}
                                    onChange={e => setGitHubForm(f => ({ ...f, github_repo_url: e.target.value }))}
                                    placeholder="https://github.com/org/repo"
                                    className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl h-10"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-[#64748B] block mb-1.5">Repository Name (org/repo)</label>
                                <Input
                                    value={gitHubForm.github_repo_name}
                                    onChange={e => setGitHubForm(f => ({ ...f, github_repo_name: e.target.value }))}
                                    placeholder="myorg/myrepo"
                                    className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl h-10"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-[#64748B] block mb-1.5">GitHub Token</label>
                                <Input
                                    type="password"
                                    value={gitHubForm.github_token}
                                    onChange={e => setGitHubForm(f => ({ ...f, github_token: e.target.value }))}
                                    placeholder={editingProject.has_github_token ? "Token already set (leave empty to keep)" : "ghp_xxxx..."}
                                    className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.08)] text-[#F4F6FF] rounded-xl h-10"
                                />
                                <p className="text-[10px] text-[#475569] mt-1">
                                    Token needs repo scope for invitations. Leave empty to keep existing token.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 p-5 border-t border-[rgba(244,246,255,0.06)]">
                            <Button variant="ghost" onClick={() => setShowGitHubModal(false)} className="text-[#64748B] rounded-xl px-5">Cancel</Button>
                            <Button
                                onClick={handleSaveGitHubSettings}
                                className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white rounded-xl px-6 font-medium shadow-lg shadow-[#4F46E5]/20"
                            >
                                <Github className="w-4 h-4 mr-2" />
                                Save Settings
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
