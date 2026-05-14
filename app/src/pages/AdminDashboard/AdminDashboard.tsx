import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BarChart3, Shield, Users, FolderKanban, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast, Toaster } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';
import RoleManagementModal from './modals/RoleManagementModal';
import RestrictionModal from './modals/RestrictionModal';
import EmployeeModal from './modals/EmployeeModal';
import UserModal from './modals/UserModal';
import UserRestrictionsModal from './modals/UserRestrictionsModal';
import GitHubSettingsModal from './modals/GitHubSettingsModal';
import ProjectMembersModal from './modals/ProjectMembersModal';
import EmployeesTab from './tabs/EmployeesTab';
import ProjectsTab from './tabs/ProjectsTab';
import UsersTab from './tabs/UsersTab';
import CustomRestrictionsTab from './tabs/CustomRestrictionsTab';
import DashboardTab from './tabs/DashboardTab';

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

interface CapacityTicket {
  id: number;
  key: string;
  title: string;
  status: string;
  priority: string;
  project_id: number;
  project_name: string | null;
  estimated_hours: number;
  logged_hours: number;
  remaining_hours: number;
  started_at: string | null;
  last_assigned_at: string | null;
  completed_at: string | null;
  counted_hours: number;
  counted_basis: string;
}

interface DeveloperCapacity {
  developer_id: number;
  developer_name: string;
  developer_email: string;
  avatar_url: string | null;
  project_count: number;
  this_week_in_progress_hours: number;
  this_week_in_review_hours: number;
  this_week_done_hours: number;
  this_week_capacity_used: number;
  this_week_remaining_capacity: number;
  week_start?: string;
  week_end?: string;
  tickets?: CapacityTicket[];
  specialization: string | null;
}

interface User {
  id: number;
  email: string;
  name: string;
  role: string; // Comma-separated roles
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
  github_repo_urls?: string[];
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

type AdminTab =
  | 'dashboard'
  | 'employees'
  | 'projects'
  | 'users'
  | 'developers-capacity'
  | 'custom-restrictions';
const VALID_ADMIN_TABS: AdminTab[] = [
  'dashboard',
  'employees',
  'projects',
  'users',
  'developers-capacity',
  'custom-restrictions',
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const initialTab: AdminTab =
    tabFromUrl && (VALID_ADMIN_TABS as string[]).includes(tabFromUrl)
      ? (tabFromUrl as AdminTab)
      : 'dashboard';
  const [activeTab, setActiveTabState] = useState<AdminTab>(initialTab);

  const setActiveTab = (tab: AdminTab) => {
    setActiveTabState(tab);
    if (tab === 'dashboard') {
      const next = new URLSearchParams(searchParams);
      next.delete('tab');
      setSearchParams(next, { replace: false });
    } else {
      const next = new URLSearchParams(searchParams);
      next.set('tab', tab);
      setSearchParams(next, { replace: false });
    }
  };

  // Sync state with URL on browser back/forward navigation. Pre-existing
  // pattern; deliberately reads activeTab without listing it as a dep so
  // the effect only runs when the URL changes, not when state changes back.
  useEffect(() => {
    const urlTab = searchParams.get('tab');
    const resolved: AdminTab =
      urlTab && (VALID_ADMIN_TABS as string[]).includes(urlTab)
        ? (urlTab as AdminTab)
        : 'dashboard';
    if (resolved !== activeTab) {
      setActiveTabState(resolved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const queryClient = useQueryClient();

  const statsQuery = useQuery<DashboardStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => apiFetch<DashboardStats>('/api/admin/stats'),
  });
  const stats = statsQuery.data ?? null;

  const employeesQuery = useQuery<Employee[]>({
    queryKey: ['admin', 'employees'],
    queryFn: () => apiFetch<Employee[]>('/api/admin/employees'),
  });
  // useMemo keeps the array reference stable across renders so the
  // useMemo hooks downstream (filtered/sorted views) don't bust their
  // caches every render.
  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);

  const capacityQuery = useQuery<DeveloperCapacity[]>({
    queryKey: ['admin', 'developers-capacity'],
    queryFn: () => apiFetch<DeveloperCapacity[]>('/api/admin/developers/capacity'),
  });
  const developerCapacities = useMemo(() => capacityQuery.data ?? [], [capacityQuery.data]);

  const projectsQuery = useQuery<Project[]>({
    queryKey: ['admin', 'projects'],
    queryFn: () => apiFetch<Project[]>('/api/admin/projects'),
  });
  const projects = projectsQuery.data ?? [];

  const usersQuery = useQuery<User[]>({
    queryKey: ['admin', 'users'],
    queryFn: () => apiFetch<User[]>('/api/auth/admin/users'),
  });
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);

  const restrictionsQuery = useQuery<any[]>({
    queryKey: ['admin', 'custom-restrictions'],
    queryFn: () => apiFetch<any[]>('/api/auth/admin/custom-restrictions'),
  });
  const customRestrictions = restrictionsQuery.data ?? [];

  const loading =
    statsQuery.isLoading ||
    employeesQuery.isLoading ||
    capacityQuery.isLoading ||
    projectsQuery.isLoading ||
    usersQuery.isLoading ||
    restrictionsQuery.isLoading;

  useAuth(); // keeps auth guard active; token read from localStorage by apiFetch

  // Custom restrictions state
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);
  const [editingRestriction, setEditingRestriction] = useState<any | null>(null);
  const [restrictionForm, setRestrictionForm] = useState({
    name: '',
    tab_name: '',
    subsection: '',
  });

  // User restrictions management state
  const [showUserRestrictionsModal, setShowUserRestrictionsModal] = useState(false);
  const [selectedUserForRestrictions, setSelectedUserForRestrictions] = useState<User | null>(null);

  // Role dropdown state
  const [openRoleDropdown, setOpenRoleDropdown] = useState<number | null>(null);

  // Helper function to convert role to Pascal Case
  const toPascalCase = (str: string): string => {
    return str
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  };

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
  const [invitingProjectId, setInvitingProjectId] = useState<number | null>(null);

  // Project members modal state
  const [showProjectMembersModal, setShowProjectMembersModal] = useState(false);
  const [selectedProjectForMembers, setSelectedProjectForMembers] = useState<Project | null>(null);
  const [addMemberForm, setAddMemberForm] = useState<{ developer_id: string; role: string }>({
    developer_id: '',
    role: 'developer',
  });

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

  const saveEmployeeMutation = useMutation({
    mutationFn: () => {
      const url = editingEmployee
        ? `/api/admin/employees/${editingEmployee.id}`
        : `/api/admin/employees`;
      const method = editingEmployee ? 'PUT' : 'POST';
      return apiFetch<Employee>(url, { method, body: JSON.stringify(employeeForm) });
    },
    onSuccess: () => {
      toast.success(editingEmployee ? 'Employee updated!' : 'Employee created!');
      setShowEmployeeModal(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'employees'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'developers-capacity'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to save employee'),
  });

  const handleSaveEmployee = () => {
    if (!employeeForm.name.trim() || !employeeForm.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    saveEmployeeMutation.mutate();
  };

  const deleteEmployeeMutation = useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/admin/employees/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Employee deleted');
      queryClient.invalidateQueries({ queryKey: ['admin', 'employees'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'developers-capacity'] });
    },
    onError: () => toast.error('Failed to delete employee'),
  });

  const handleDeleteEmployee = (id: number) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    deleteEmployeeMutation.mutate(id);
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

  const saveGitHubMutation = useMutation({
    mutationFn: () => {
      if (!editingProject) throw new Error('No project selected');
      return apiFetch<void>(`/api/admin/projects/${editingProject.id}/github`, {
        method: 'PUT',
        body: JSON.stringify(gitHubForm),
      });
    },
    onSuccess: () => {
      toast.success('GitHub settings updated!');
      setShowGitHubModal(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'projects'] });
    },
    onError: () => toast.error('Failed to update GitHub settings'),
  });

  const handleSaveGitHubSettings = () => saveGitHubMutation.mutate();

  const sendGitHubInvitesMutation = useMutation({
    mutationFn: (project: Project) =>
      apiFetch<{ successful_invitations: number }>(
        `/api/projects/${project.id}/github-invite?role=push`,
        {
          method: 'POST',
        },
      ),
    onSuccess: (data, project) => {
      toast.success(
        `Sent ${data.successful_invitations} GitHub invitation(s) for ${project.name}!`,
      );
      setInvitingProjectId(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to send invitations');
      setInvitingProjectId(null);
    },
  });

  const handleSendGitHubInvites = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!project.github_repo_url) {
      toast.error('No GitHub repository configured');
      return;
    }
    setInvitingProjectId(project.id);
    sendGitHubInvitesMutation.mutate(project);
  };

  // Project members management
  const projectMembersQuery = useQuery<{
    developers: Array<{
      id: number;
      name: string;
      email: string;
      role?: string;
      responsibilities?: string;
      is_admin?: boolean;
    }>;
  }>({
    queryKey: ['project', selectedProjectForMembers?.id],
    queryFn: () => apiFetch(`/api/projects/${selectedProjectForMembers!.id}`),
    enabled: !!selectedProjectForMembers,
  });
  const projectMembers = projectMembersQuery.data?.developers ?? [];
  const projectMembersLoading = projectMembersQuery.isLoading;

  const handleOpenProjectMembers = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProjectForMembers(project);
    setShowProjectMembersModal(true);
    setAddMemberForm({ developer_id: '', role: 'developer' });
  };

  const addMemberMutation = useMutation({
    mutationFn: ({ projectId, devId, role }: { projectId: number; devId: number; role: string }) =>
      apiFetch<void>(`/api/projects/${projectId}/developers`, {
        method: 'POST',
        body: JSON.stringify({ developer_id: devId, role }),
      }),
    onSuccess: () => {
      toast.success('Member added');
      setAddMemberForm({ developer_id: '', role: 'developer' });
      queryClient.invalidateQueries({ queryKey: ['project', selectedProjectForMembers?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'projects'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to add member'),
  });

  const handleAddProjectMember = () => {
    if (!selectedProjectForMembers) return;
    const devId = parseInt(addMemberForm.developer_id, 10);
    if (!devId) {
      toast.error('Select an employee to add');
      return;
    }
    addMemberMutation.mutate({
      projectId: selectedProjectForMembers.id,
      devId,
      role: addMemberForm.role || 'developer',
    });
  };

  const removeMemberMutation = useMutation({
    mutationFn: ({ projectId, developerId }: { projectId: number; developerId: number }) =>
      apiFetch<void>(`/api/projects/${projectId}/developers/${developerId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Member removed');
      queryClient.invalidateQueries({ queryKey: ['project', selectedProjectForMembers?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'projects'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to remove member'),
  });

  const handleRemoveProjectMember = (developerId: number) => {
    if (!selectedProjectForMembers) return;
    if (
      !confirm('Remove this member from the project? Their assigned work items will be unassigned.')
    )
      return;
    removeMemberMutation.mutate({ projectId: selectedProjectForMembers.id, developerId });
  };

  // User management functions
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState<{ email: string; name: string; roles: string[] }>({
    email: '',
    name: '',
    roles: ['developer'],
  });
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const handleRoleToggle = (role: string) => {
    setUserForm((f) => {
      const roles = f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role];
      return { ...f, roles: roles.length > 0 ? roles : ['developer'] };
    });
  };

  const createUserMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ temporary_password: string }>('/api/auth/admin/create-user', {
        method: 'POST',
        body: JSON.stringify({ ...userForm, role: userForm.roles.join(',') }),
      }),
    onSuccess: (data) => {
      toast.success('User created successfully!');
      setGeneratedPassword(data.temporary_password);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to create user'),
  });

  const handleSaveUser = () => {
    if (!userForm.email.trim() || !userForm.name.trim()) {
      toast.error('Email and name are required');
      return;
    }
    createUserMutation.mutate();
  };

  const toggleUserRoleMutation = useMutation({
    mutationFn: ({ userId, newRole }: { userId: number; newRole: string }) =>
      apiFetch<void>(`/api/auth/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      }),
    onSuccess: () => {
      toast.success('User roles updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: () => toast.error('Failed to update role'),
  });

  const handleToggleUserRole = (user: User, roleToToggle: string) => {
    const currentRoles = user.role.split(',').map((r) => r.trim());
    let newRoles: string[];
    if (currentRoles.includes(roleToToggle)) {
      newRoles = currentRoles.filter((r) => r !== roleToToggle);
      if (newRoles.length === 0) newRoles = ['developer'];
    } else {
      newRoles = [...currentRoles, roleToToggle];
    }
    toggleUserRoleMutation.mutate({ userId: user.id, newRole: newRoles.join(',') });
  };

  // Custom Restrictions Handlers
  const handleCreateRestriction = () => {
    setEditingRestriction(null);
    setRestrictionForm({ name: '', tab_name: '', subsection: '' });
    setShowRestrictionModal(true);
  };

  const handleEditRestriction = (restriction: any) => {
    setEditingRestriction(restriction);
    setRestrictionForm({
      name: restriction.name,
      tab_name: restriction.tab_name,
      subsection: restriction.subsection,
    });
    setShowRestrictionModal(true);
  };

  const saveRestrictionMutation = useMutation({
    mutationFn: () => {
      const url = editingRestriction
        ? `/api/auth/admin/custom-restrictions/${editingRestriction.id}`
        : `/api/auth/admin/custom-restrictions`;
      const method = editingRestriction ? 'PUT' : 'POST';
      return apiFetch<any>(url, { method, body: JSON.stringify(restrictionForm) });
    },
    onSuccess: () => {
      toast.success(editingRestriction ? 'Restriction updated!' : 'Restriction created!');
      setShowRestrictionModal(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'custom-restrictions'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to save restriction'),
  });

  const handleSaveRestriction = () => {
    if (!restrictionForm.name.trim() || !restrictionForm.tab_name || !restrictionForm.subsection) {
      toast.error('All fields are required');
      return;
    }
    saveRestrictionMutation.mutate();
  };

  const deleteRestrictionMutation = useMutation({
    mutationFn: (restrictionId: number) =>
      apiFetch<void>(`/api/auth/admin/custom-restrictions/${restrictionId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Restriction deleted!');
      queryClient.invalidateQueries({ queryKey: ['admin', 'custom-restrictions'] });
    },
    onError: () => toast.error('Failed to delete restriction'),
  });

  const handleDeleteRestriction = (restrictionId: number) => {
    if (!confirm('Are you sure you want to delete this custom restriction?')) return;
    deleteRestrictionMutation.mutate(restrictionId);
  };

  // User Restrictions Management Handlers
  const userRestrictionsQuery = useQuery<any[]>({
    queryKey: ['admin', 'user-restrictions', selectedUserForRestrictions?.id],
    queryFn: () =>
      apiFetch<any[]>(
        `/api/auth/admin/users/${selectedUserForRestrictions!.id}/custom-restrictions`,
      ),
    enabled: !!selectedUserForRestrictions,
  });
  const userRestrictionsList: number[] = (userRestrictionsQuery.data ?? []).map((r: any) => r.id);
  const userRestrictionsLoading = userRestrictionsQuery.isLoading;

  const handleOpenUserRestrictionsModal = (user: User) => {
    setSelectedUserForRestrictions(user);
    setShowUserRestrictionsModal(true);
  };

  const toggleUserRestrictionMutation = useMutation({
    mutationFn: ({ restrictionId, isChecked }: { restrictionId: number; isChecked: boolean }) => {
      if (!selectedUserForRestrictions) throw new Error('No user selected');
      const method = isChecked ? 'POST' : 'DELETE';
      return apiFetch<void>(
        `/api/auth/admin/users/${selectedUserForRestrictions.id}/custom-restrictions/${restrictionId}`,
        { method },
      );
    },
    onSuccess: (_data, { isChecked }) => {
      toast.success(isChecked ? 'Restriction assigned!' : 'Restriction removed!');
      queryClient.invalidateQueries({
        queryKey: ['admin', 'user-restrictions', selectedUserForRestrictions?.id],
      });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to update restriction'),
  });

  const handleToggleUserRestriction = (restrictionId: number, isChecked: boolean) => {
    toggleUserRestrictionMutation.mutate({ restrictionId, isChecked });
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <Toaster position="top-right" theme="dark" />

      {/* Header */}
      <div className="border-b border-[rgba(255,255,255,0.05)] bg-[#0d0d0d]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/')}
                className="text-[#737373] hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Projects
              </Button>
              <div className="h-6 w-px bg-[rgba(255,255,255,0.08)]" />
              <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[rgba(255,255,255,0.05)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto pb-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'employees', label: 'Employees', icon: Users },
              { id: 'projects', label: 'Projects', icon: FolderKanban },
              { id: 'users', label: 'Users', icon: Shield },
              { id: 'custom-restrictions', label: 'Restrictions', icon: Settings },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-4 py-3 flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#E0B954] text-white'
                    : 'border-transparent text-[#737373] hover:text-white'
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
            <div className="animate-spin w-8 h-8 border-2 border-[#E0B954] border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && stats && (
              <DashboardTab stats={stats} setActiveTab={setActiveTab} />
            )}

            {/* Employees Tab */}
            {activeTab === 'employees' && (
              <EmployeesTab
                employees={employees}
                developerCapacities={developerCapacities}
                handleCreateEmployee={handleCreateEmployee}
                handleEditEmployee={handleEditEmployee}
                handleDeleteEmployee={handleDeleteEmployee}
              />
            )}

            {/* Projects Tab */}
            {activeTab === 'projects' && (
              <ProjectsTab
                projects={projects}
                invitingProjectId={invitingProjectId}
                handleEditGitHubSettings={handleEditGitHubSettings}
                handleSendGitHubInvites={handleSendGitHubInvites}
                handleOpenProjectMembers={handleOpenProjectMembers}
              />
            )}
            {/* Users Tab */}
            {/* Users Tab */}
            {activeTab === 'users' && (
              <UsersTab
                users={users}
                setOpenRoleDropdown={setOpenRoleDropdown}
                handleOpenUserRestrictionsModal={handleOpenUserRestrictionsModal}
                toPascalCase={toPascalCase}
              />
            )}
            {/* Custom Restrictions Tab */}
            {/* Custom Restrictions Tab */}
            {activeTab === 'custom-restrictions' && (
              <CustomRestrictionsTab
                customRestrictions={customRestrictions}
                handleCreateRestriction={handleCreateRestriction}
                handleEditRestriction={handleEditRestriction}
                handleDeleteRestriction={handleDeleteRestriction}
                toPascalCase={toPascalCase}
              />
            )}
          </>
        )}
      </div>

      {/* Role Management Modal */}
      <RoleManagementModal
        openRoleDropdown={openRoleDropdown}
        users={users}
        setOpenRoleDropdown={setOpenRoleDropdown}
        handleToggleUserRole={handleToggleUserRole}
        toPascalCase={toPascalCase}
      />

      {/* Custom Restriction Modal */}
      <RestrictionModal
        showRestrictionModal={showRestrictionModal}
        editingRestriction={editingRestriction}
        restrictionForm={restrictionForm}
        setRestrictionForm={setRestrictionForm}
        setShowRestrictionModal={setShowRestrictionModal}
        handleSaveRestriction={handleSaveRestriction}
      />

      {/* Employee Modal */}
      <EmployeeModal
        showEmployeeModal={showEmployeeModal}
        editingEmployee={editingEmployee}
        employeeForm={employeeForm}
        setEmployeeForm={setEmployeeForm}
        setShowEmployeeModal={setShowEmployeeModal}
        handleSaveEmployee={handleSaveEmployee}
      />

      {/* User Modal */}
      <UserModal
        showUserModal={showUserModal}
        userForm={userForm}
        setUserForm={setUserForm}
        generatedPassword={generatedPassword}
        setGeneratedPassword={setGeneratedPassword}
        setShowUserModal={setShowUserModal}
        handleSaveUser={handleSaveUser}
        handleRoleToggle={handleRoleToggle}
      />

      {/* User Restrictions Modal */}
      <UserRestrictionsModal
        showUserRestrictionsModal={showUserRestrictionsModal}
        selectedUserForRestrictions={selectedUserForRestrictions}
        customRestrictions={customRestrictions}
        userRestrictionsList={userRestrictionsList}
        userRestrictionsLoading={userRestrictionsLoading}
        setShowUserRestrictionsModal={setShowUserRestrictionsModal}
        handleToggleUserRestriction={handleToggleUserRestriction}
        toPascalCase={toPascalCase}
      />

      {/* GitHub Settings Modal */}
      <GitHubSettingsModal
        showGitHubModal={showGitHubModal}
        editingProject={editingProject}
        gitHubForm={gitHubForm}
        setGitHubForm={setGitHubForm}
        setShowGitHubModal={setShowGitHubModal}
        handleSaveGitHubSettings={handleSaveGitHubSettings}
      />

      {/* Project Members Modal */}
      <ProjectMembersModal
        showProjectMembersModal={showProjectMembersModal}
        selectedProjectForMembers={selectedProjectForMembers}
        projectMembers={projectMembers}
        projectMembersLoading={projectMembersLoading}
        employees={employees}
        addMemberForm={addMemberForm}
        setAddMemberForm={setAddMemberForm}
        addMemberMutation={addMemberMutation}
        removeMemberMutation={removeMemberMutation}
        setShowProjectMembersModal={setShowProjectMembersModal}
        handleAddProjectMember={handleAddProjectMember}
        handleRemoveProjectMember={handleRemoveProjectMember}
      />
    </div>
  );
};

export default AdminDashboard;
