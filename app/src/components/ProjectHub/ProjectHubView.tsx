import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TimelineView, CalendarView, ListView, WorkloadView, GoalsView, ActivityFeed, ReviewerView } from './index';
import { LayoutGrid, Calendar, List, Users, Target, Activity, Eye } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';

interface ProjectHubViewProps {
    projectId: string;
    token: string;
    project: any;
    developers?: { id: number; name: string; email: string }[];
}

interface WorkItem {
    id: string;
    key: string;
    title: string;
    type: string;
    status: string;
    priority: string;
    assignee?: string;
    assignee_id?: number;
    due_date?: string;
    start_date?: string;
    estimated_hours?: number;
    logged_hours?: number;
    remaining_hours?: number;
    sprint?: string;
}

interface Goal {
    id: number;
    title: string;
    description?: string;
    status: string;
    progress: number;
    due_date?: string;
    completed_at?: string;
}

interface Milestone {
    id: number;
    title: string;
    description?: string;
    due_date?: string;
    completed_at?: string;
    is_completed: boolean;
}

interface ActivityItem {
    id: number;
    action: string;
    entity_type: string;
    entity_id?: number;
    title: string;
    details?: Record<string, any>;
    created_at: string;
    user_name: string;
    user_email?: string;
}

interface WorkloadData {
    developer_id: number | string;
    developer_name: string;
    total_items: number;
    completed_items: number;
    in_progress_items: number;
    todo_items: number;
    overdue_items: number;
    estimated_hours: number;
    logged_hours: number;
    remaining_hours: number;
    this_week_remaining_hours?: number;
}

const ProjectHubView: React.FC<ProjectHubViewProps> = ({ projectId, token, project, developers = [] }) => {
    const [activeView, setActiveView] = useState('timeline');
    const [workItems, setWorkItems] = useState<WorkItem[]>([]);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [workload, setWorkload] = useState<WorkloadData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (projectId && token) {
            fetchAllData();
        }
    }, [projectId, token]);

    // Refresh data when tab becomes visible
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && projectId && token) {
                fetchAllData();
            }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [projectId, token]);

    const fetchAllData = async () => {
        setIsLoading(true);
        await Promise.all([
            fetchWorkItems(),
            fetchGoals(),
            fetchMilestones(),
            fetchActivities(),
            fetchWorkload(),
        ]);
        setIsLoading(false);
    };

    const fetchWorkItems = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/workitems/?project_id=${projectId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setWorkItems(data.map((item: any) => ({
                    id: item.id,
                    key: item.key,
                    title: item.title,
                    type: item.type,
                    status: item.status,
                    priority: item.priority,
                    assignee: item.assignee,
                    assignee_id: item.assignee_id,
                    due_date: item.due_date,
                    start_date: item.start_date || item.started_at,
                    estimated_hours: item.estimated_hours,
                    logged_hours: item.logged_hours,
                    remaining_hours: item.remaining_hours,
                    sprint: item.sprint,
                })));
            }
        } catch (err) {
            console.error('Failed to fetch work items:', err);
        }
    };

    const fetchGoals = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/goals`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setGoals(await res.json());
            }
        } catch (err) {
            console.error('Failed to fetch goals:', err);
        }
    };

    const fetchMilestones = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/milestones`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setMilestones(await res.json());
            }
        } catch (err) {
            console.error('Failed to fetch milestones:', err);
        }
    };

    const fetchActivities = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/activity`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setActivities(await res.json());
            }
        } catch (err) {
            console.error('Failed to fetch activities:', err);
        }
    };

    const fetchWorkload = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/workload`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setWorkload(await res.json());
            }
        } catch (err) {
            console.error('Failed to fetch workload:', err);
        }
    };

    // Handlers for goals
    const handleAddGoal = async (goal: { title: string; description?: string; due_date?: string }) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/goals`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(goal)
            });
            if (res.ok) {
                const newGoal = await res.json();
                setGoals(prev => [newGoal, ...prev]);
            }
        } catch (err) {
            console.error('Failed to add goal:', err);
        }
    };

    const handleUpdateGoalProgress = async (goalId: number, progress: number) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/goals/${goalId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ progress })
            });
            if (res.ok) {
                setGoals(prev => prev.map(g => g.id === goalId ? { ...g, progress } : g));
            }
        } catch (err) {
            console.error('Failed to update goal:', err);
        }
    };

    const handleDeleteGoal = async (goalId: number) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/goals/${goalId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setGoals(prev => prev.filter(g => g.id !== goalId));
            }
        } catch (err) {
            console.error('Failed to delete goal:', err);
        }
    };

    // Handlers for milestones
    const handleAddMilestone = async (milestone: { title: string; description?: string; due_date?: string }) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/milestones`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(milestone)
            });
            if (res.ok) {
                const newMilestone = await res.json();
                setMilestones(prev => [...prev, newMilestone]);
            }
        } catch (err) {
            console.error('Failed to add milestone:', err);
        }
    };

    const handleCompleteMilestone = async (milestoneId: number) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/milestones/${milestoneId}/complete`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const updated = await res.json();
                setMilestones(prev => prev.map(m => m.id === milestoneId ? updated : m));
            }
        } catch (err) {
            console.error('Failed to complete milestone:', err);
        }
    };

    const handleDeleteMilestone = async (milestoneId: number) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/milestones/${milestoneId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setMilestones(prev => prev.filter(m => m.id !== milestoneId));
            }
        } catch (err) {
            console.error('Failed to delete milestone:', err);
        }
    };

    // Handler for updating task dates (drag to resize on timeline)
    const handleTaskUpdate = async (itemId: string, updates: { start_date?: string; due_date?: string }) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/workitems/${itemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                // Update local state
                setWorkItems(prev => prev.map(item => 
                    item.id === itemId ? { ...item, ...updates } : item
                ));
                toast.success('Task dates updated');
            } else {
                const error = await res.json();
                toast.error(error.detail || 'Failed to update dates');
            }
        } catch (err) {
            console.error('Failed to update task dates:', err);
            toast.error('Failed to update dates');
        }
    };

    // Handler for creating new tasks from timeline
    const handleTaskCreate = async (task: { title: string; start_date: string; due_date: string; estimated_hours: number; assignee_id?: number }) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/workitems/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    project_id: parseInt(projectId),
                    title: task.title,
                    type: 'task',
                    status: 'todo',
                    priority: 'medium',
                    start_date: task.start_date,
                    due_date: task.due_date,
                    estimated_hours: task.estimated_hours,
                    assignee_id: task.assignee_id
                })
            });
            if (res.ok) {
                const newItem = await res.json();
                console.log('Created task:', newItem);
                console.log('Dates:', { start_date: newItem.start_date, due_date: newItem.due_date });
                setWorkItems(prev => [...prev, {
                    id: newItem.id,
                    key: newItem.key,
                    title: newItem.title,
                    type: newItem.type,
                    status: newItem.status,
                    priority: newItem.priority,
                    assignee: newItem.assignee,
                    assignee_id: newItem.assignee_id,
                    due_date: newItem.due_date,
                    start_date: newItem.start_date,
                    estimated_hours: newItem.estimated_hours,
                }]);
                toast.success(`Task "${newItem.key}" created!`);
            } else {
                const error = await res.json();
                toast.error(error.detail || 'Failed to create task');
            }
        } catch (err) {
            console.error('Failed to create task:', err);
            toast.error('Failed to create task');
        }
    };

    const views = [
        { id: 'timeline', label: 'Timeline', icon: LayoutGrid },
        { id: 'calendar', label: 'Calendar', icon: Calendar },
        { id: 'list', label: 'List', icon: List },
        { id: 'workload', label: 'Workload', icon: Users },
        { id: 'reviewer', label: 'Reviewer', icon: Eye },
        { id: 'goals', label: 'Goals', icon: Target },
        { id: 'activity', label: 'Activity', icon: Activity },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Sub-navigation */}
            <Tabs value={activeView} onValueChange={setActiveView}>
                <TabsList className="bg-[#0A0A14] border border-[rgba(244,246,255,0.06)] p-1">
                    {views.map((view) => {
                        const Icon = view.icon;
                        return (
                            <TabsTrigger
                                key={view.id}
                                value={view.id}
                                className="data-[state=active]:bg-[#6366F1] data-[state=active]:text-white text-[#64748B] px-4 py-2"
                            >
                                <Icon className="w-4 h-4 mr-2" />
                                {view.label}
                            </TabsTrigger>
                        );
                    })}
                </TabsList>

                <div className="mt-6">
                    <TabsContent value="timeline">
                        <TimelineView
                            workItems={workItems}
                            milestones={milestones}
                            goals={goals}
                            projectStartDate={project?.created_at}
                            projectId={parseInt(projectId)}
                            developers={developers}
                            onTaskUpdate={handleTaskUpdate}
                            onTaskCreate={handleTaskCreate}
                        />
                    </TabsContent>

                    <TabsContent value="calendar">
                        <CalendarView workItems={workItems} milestones={milestones} goals={goals} />
                    </TabsContent>

                    <TabsContent value="list">
                        <ListView workItems={workItems} />
                    </TabsContent>

                    <TabsContent value="workload">
                        <WorkloadView workloadData={workload} />
                    </TabsContent>

                    <TabsContent value="reviewer">
                        <ReviewerView
                            workItems={workItems}
                            projectId={projectId}
                            token={token}
                            onTaskUpdate={handleTaskUpdate}
                        />
                    </TabsContent>

                    <TabsContent value="goals">
                        <GoalsView
                            goals={goals}
                            milestones={milestones}
                            onAddGoal={handleAddGoal}
                            onAddMilestone={handleAddMilestone}
                            onUpdateGoalProgress={handleUpdateGoalProgress}
                            onCompleteMilestone={handleCompleteMilestone}
                            onDeleteGoal={handleDeleteGoal}
                            onDeleteMilestone={handleDeleteMilestone}
                        />
                    </TabsContent>

                    <TabsContent value="activity">
                        <ActivityFeed activities={activities} />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
};

export default ProjectHubView;
