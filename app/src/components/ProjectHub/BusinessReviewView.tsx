import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
    TrendingUp,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Users,
    Target,
    Activity,
    AlertCircle,
    MessageSquare,
    ExternalLink,
    ChevronDown,
    Circle,
} from 'lucide-react';
import { API_BASE_URL } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';

interface WorkItem {
    id: string;
    key: string;
    type: string;
    status: string;
    priority: string;
    assignee?: string;
    due_date?: string;
}

interface Goal {
    id: number;
    title: string;
    status: string;
    progress: number;
    due_date?: string;
}

interface Milestone {
    id: number;
    title: string;
    description?: string;
    due_date?: string;
    is_completed: boolean;
}

interface Sprint {
    id: number;
    name: string;
    status: string;
    completion_pct: number;
    velocity?: number | null;
    total_items: number;
    done_count: number;
    total_points: number;
    completed_points: number;
    start_date?: string | null;
    end_date?: string | null;
}

interface ProjectAnalytics {
    total_items: number;
    total_story_points: number;
    completed_points: number;
    status_distribution: Record<string, number>;
    velocity_data: { sprint_name: string; committed: number; completed: number }[];
    team_performance: { name: string; total_items: number; completed_items: number; total_points: number; completed_points: number }[];
}

interface BusinessReviewComment {
    id: number;
    comment_id: number;
    work_item_id: number;
    work_item_key: string;
    work_item_title: string;
    author_id: number | null;
    author_name: string;
    content: string;
    is_resolved: boolean;
    created_at: string;
    updated_at: string;
    mentions: number[];
}

interface BusinessReviewViewProps {
    project: any;
    analytics: ProjectAnalytics | null;
    sprints: Sprint[];
    milestones: Milestone[];
    workItems: WorkItem[];
    goals: Goal[];
}

const BusinessReviewView: React.FC<BusinessReviewViewProps> = ({
    project,
    analytics,
    sprints,
    milestones,
    workItems,
    goals,
}) => {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [businessReviewComments, setBusinessReviewComments] = useState<BusinessReviewComment[]>([]);
    const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
    const [isBusinessReviewExpanded, setIsBusinessReviewExpanded] = useState(true);
    
    // Fetch business review comments on mount
    useEffect(() => {
        const fetchBusinessReviewComments = async () => {
            if (!project?.id) return;
            
            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/comments/project/${project.id}/business-review`,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                if (response.ok) {
                    const comments = await response.json();
                    setBusinessReviewComments(comments);
                }
            } catch (error) {
                console.error('Failed to fetch business review comments:', error);
            }
        };
        
        fetchBusinessReviewComments();
    }, [project?.id, token]);
    
    const toggleCommentExpanded = (commentId: number) => {
        const newExpanded = new Set(expandedComments);
        if (newExpanded.has(commentId)) {
            newExpanded.delete(commentId);
        } else {
            newExpanded.add(commentId);
        }
        setExpandedComments(newExpanded);
    };
    
    const toggleCommentResolved = async (commentId: number, currentStatus: boolean) => {
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/comments/${commentId}/resolve?is_resolved=${!currentStatus}`,
                {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
            if (response.ok) {
                // Update the local state
                setBusinessReviewComments(prev =>
                    prev.map(c =>
                        c.id === commentId ? { ...c, is_resolved: !currentStatus } : c
                    )
                );
            }
        } catch (error) {
            console.error('Failed to update comment resolved status:', error);
        }
    };
    
    const today = new Date();

    const overdueItems = workItems.filter(
        item => item.due_date && new Date(item.due_date) < today && item.status !== 'done'
    ).length;

    const openBugs = workItems.filter(item => item.type === 'bug' && item.status !== 'done').length;

    const completedMilestones = milestones.filter(m => m.is_completed).length;
    const totalMilestones = milestones.length;
    const milestonePct = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

    const activeSprint = sprints.find(s => s.status === 'active');

    const avgVelocity =
        analytics?.velocity_data && analytics.velocity_data.length > 0
            ? Math.round(
                  analytics.velocity_data.reduce((sum, d) => sum + d.completed, 0) /
                      analytics.velocity_data.length
              )
            : 0;

    const completionPct =
        analytics && analytics.total_story_points > 0
            ? Math.round((analytics.completed_points / analytics.total_story_points) * 100)
            : 0;

    // Health score: start at 100, subtract for issues
    let healthScore = 100;
    healthScore -= Math.min(30, overdueItems * 5);
    healthScore -= Math.min(20, openBugs * 4);
    if (totalMilestones > 0 && milestonePct < 50 && activeSprint) {
        healthScore -= 10;
    }
    healthScore = Math.max(0, Math.min(100, healthScore));

    const getHealthMeta = (score: number) => {
        if (score >= 80) return { color: '#34D399', label: 'Healthy', borderColor: 'border-[#34D399]/20', bgColor: 'bg-[#34D399]/5' };
        if (score >= 60) return { color: '#FBBF24', label: 'At Risk', borderColor: 'border-[#FBBF24]/20', bgColor: 'bg-[#FBBF24]/5' };
        return { color: '#EF4444', label: 'Critical', borderColor: 'border-[#EF4444]/20', bgColor: 'bg-[#EF4444]/5' };
    };
    const health = getHealthMeta(healthScore);

    const onTimeDeliveryPct =
        analytics && analytics.total_items > 0
            ? Math.round(((analytics.status_distribution?.done || 0) / analytics.total_items) * 100)
            : 0;

    const unassigned = workItems.filter(i => !i.assignee && i.status !== 'done').length;
    const criticalOpen = workItems.filter(i => i.priority === 'critical' && i.status !== 'done').length;

    return (
        <div className="space-y-6">
            {/* Top Row: Health Score + KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Health Score */}
                <div
                    className={`bg-[rgba(255,255,255,0.02)] border ${health.borderColor} ${health.bgColor} rounded-2xl p-5 flex flex-col items-center justify-center`}
                >
                    <div className="relative w-20 h-20 mb-3">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                            <circle
                                cx="50" cy="50" r="40"
                                fill="none"
                                stroke="rgba(255,255,255,0.06)"
                                strokeWidth="10"
                            />
                            <circle
                                cx="50" cy="50" r="40"
                                fill="none"
                                stroke={health.color}
                                strokeWidth="10"
                                strokeDasharray={`${2 * Math.PI * 40}`}
                                strokeDashoffset={`${2 * Math.PI * 40 * (1 - healthScore / 100)}`}
                                strokeLinecap="round"
                                style={{ transition: 'stroke-dashoffset 1s ease' }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xl font-bold text-white">{healthScore}</span>
                        </div>
                    </div>
                    <p className="text-sm font-semibold text-white">Project Health</p>
                    <span
                        className="mt-1 text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${health.color}20`, color: health.color }}
                    >
                        {health.label}
                    </span>
                </div>

                {/* Sprint Velocity */}
                <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-[#E0B954]/10 flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-[#E0B954]" />
                        </div>
                        <span className="text-xs text-[#737373]">Sprint Velocity</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{avgVelocity}</p>
                    <p className="text-xs text-[#737373] mt-1">pts avg / sprint</p>
                </div>

                {/* On-Time Delivery */}
                <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-[#E0B954]/10 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-[#E0B954]" />
                        </div>
                        <span className="text-xs text-[#737373]">On-Time Delivery</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{onTimeDeliveryPct}%</p>
                    <p className="text-xs text-[#737373] mt-1">
                        {analytics?.status_distribution?.done || 0} / {analytics?.total_items || 0} done
                    </p>
                </div>

                {/* Open Bugs */}
                <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
                            <AlertCircle className="w-4 h-4 text-[#EF4444]" />
                        </div>
                        <span className="text-xs text-[#737373]">Open Bugs</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{openBugs}</p>
                    <p className="text-xs text-[#737373] mt-1">{overdueItems} items overdue</p>
                </div>
            </div>

            {/* Milestone Progress */}
            {milestones.length > 0 && (
                <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#C79E3B]/10 flex items-center justify-center">
                                <Target className="w-4 h-4 text-[#C79E3B]" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-white">Milestone Progress</h3>
                                <p className="text-xs text-[#737373]">
                                    {completedMilestones} of {totalMilestones} completed
                                </p>
                            </div>
                        </div>
                        <Badge
                            className={`border-0 ${
                                milestonePct >= 50
                                    ? 'bg-[#E0B954]/20 text-[#E0B954]'
                                    : 'bg-[#F59E0B]/20 text-[#F59E0B]'
                            }`}
                        >
                            {milestonePct}%
                        </Badge>
                    </div>
                    <div className="space-y-3">
                        {milestones.slice(0, 8).map(milestone => {
                            const isOverdue =
                                milestone.due_date &&
                                !milestone.is_completed &&
                                new Date(milestone.due_date) < today;
                            return (
                                <div key={milestone.id} className="flex items-center gap-3">
                                    <div
                                        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                                            milestone.is_completed
                                                ? 'bg-[#E0B954]/20'
                                                : isOverdue
                                                ? 'bg-[#EF4444]/20'
                                                : 'bg-[#737373]/20'
                                        }`}
                                    >
                                        {milestone.is_completed ? (
                                            <CheckCircle2 className="w-3 h-3 text-[#E0B954]" />
                                        ) : isOverdue ? (
                                            <AlertTriangle className="w-3 h-3 text-[#EF4444]" />
                                        ) : (
                                            <Clock className="w-3 h-3 text-[#737373]" />
                                        )}
                                    </div>
                                    <span
                                        className={`text-sm flex-1 ${
                                            milestone.is_completed
                                                ? 'text-[#737373] line-through'
                                                : 'text-[#f5f5f5]'
                                        }`}
                                    >
                                        {milestone.title}
                                    </span>
                                    {milestone.due_date && (
                                        <span
                                            className={`text-xs ${
                                                isOverdue ? 'text-[#EF4444]' : 'text-[#737373]'
                                            }`}
                                        >
                                            {new Date(milestone.due_date).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Risk Indicators */}
            <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Risk Indicators</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        {
                            label: 'Overdue Tasks',
                            value: overdueItems,
                            color: overdueItems > 5 ? '#EF4444' : overdueItems > 0 ? '#F59E0B' : '#E0B954',
                            icon: Clock,
                        },
                        {
                            label: 'Open Bugs',
                            value: openBugs,
                            color: openBugs > 10 ? '#EF4444' : openBugs > 3 ? '#F59E0B' : '#E0B954',
                            icon: AlertCircle,
                        },
                        {
                            label: 'Unassigned',
                            value: unassigned,
                            color: unassigned > 5 ? '#F59E0B' : '#737373',
                            icon: Users,
                        },
                        {
                            label: 'Critical Open',
                            value: criticalOpen,
                            color: criticalOpen > 0 ? '#EF4444' : '#E0B954',
                            icon: AlertTriangle,
                        },
                    ].map(({ label, value, color, icon: Icon }) => (
                        <div
                            key={label}
                            className="bg-[rgba(255,255,255,0.025)] rounded-xl p-4 text-center"
                        >
                            <Icon className="w-5 h-5 mx-auto mb-2" style={{ color }} />
                            <p className="text-xl font-bold text-white">{value}</p>
                            <p className="text-xs text-[#737373] mt-1">{label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Stakeholder Summary */}
            <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-[#E0B954]/10 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-[#E0B954]" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Stakeholder Summary</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left column */}
                    <div className="space-y-3">
                        <div className="bg-[rgba(255,255,255,0.025)] rounded-xl p-4">
                            <p className="text-xs text-[#737373] mb-1">Project Status</p>
                            <p className="text-sm font-semibold text-white capitalize">
                                {project?.status || 'Active'}
                            </p>
                        </div>
                        <div className="bg-[rgba(255,255,255,0.025)] rounded-xl p-4">
                            <p className="text-xs text-[#737373] mb-2">Overall Completion</p>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-[#E0B954] to-[#E0B954] rounded-full transition-all"
                                        style={{ width: `${completionPct}%` }}
                                    />
                                </div>
                                <span className="text-sm font-bold text-white">{completionPct}%</span>
                            </div>
                        </div>
                        {activeSprint && (
                            <div className="bg-[rgba(255,255,255,0.025)] rounded-xl p-4">
                                <p className="text-xs text-[#737373] mb-1">Active Sprint</p>
                                <p className="text-sm font-semibold text-white">{activeSprint.name}</p>
                                <p className="text-xs text-[#E0B954] mt-1">
                                    {activeSprint.completion_pct}% complete
                                </p>
                            </div>
                        )}
                    </div>
                    {/* Right column */}
                    <div className="space-y-3">
                        <div className="bg-[rgba(255,255,255,0.025)] rounded-xl p-4">
                            <p className="text-xs text-[#737373] mb-2">Key Metrics</p>
                            <ul className="space-y-2">
                                {[
                                    { label: 'Total Work Items', value: analytics?.total_items || 0 },
                                    {
                                        label: 'Points Completed',
                                        value: `${analytics?.completed_points || 0} / ${analytics?.total_story_points || 0}`,
                                    },
                                    {
                                        label: 'Active Sprints',
                                        value: sprints.filter(s => s.status === 'active').length,
                                    },
                                    { label: 'Goals Defined', value: goals.length },
                                ].map(({ label, value }) => (
                                    <li
                                        key={label}
                                        className="flex items-center justify-between text-sm"
                                    >
                                        <span className="text-[#a3a3a3]">{label}</span>
                                        <span className="text-white font-medium">{value}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-[rgba(255,255,255,0.025)] rounded-xl p-4">
                            <p className="text-xs text-[#737373] mb-1">Next Milestone</p>
                            {milestones.filter(m => !m.is_completed).length > 0 ? (
                                <>
                                    <p className="text-sm font-semibold text-white">
                                        {milestones.find(m => !m.is_completed)?.title}
                                    </p>
                                    <p className="text-xs text-[#737373] mt-1">
                                        {milestones.find(m => !m.is_completed)?.due_date
                                            ? `Due ${new Date(
                                                  milestones.find(m => !m.is_completed)!.due_date!
                                              ).toLocaleDateString()}`
                                            : 'No due date set'}
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm text-[#737373]">All milestones completed</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Team Performance (if available) */}
            {analytics?.team_performance && analytics.team_performance.length > 0 && (
                <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-9 h-9 rounded-xl bg-[#E0B954]/10 flex items-center justify-center">
                            <Users className="w-4 h-4 text-[#E0B954]" />
                        </div>
                        <h3 className="text-sm font-semibold text-white">Team Capacity</h3>
                    </div>
                    <div className="space-y-3">
                        {analytics.team_performance.slice(0, 5).map(member => {
                            const pct =
                                member.total_items > 0
                                    ? Math.round((member.completed_items / member.total_items) * 100)
                                    : 0;
                            return (
                                <div key={member.name} className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E0B954] to-[#B8872A] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                        {member.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm text-[#f5f5f5] truncate">{member.name}</span>
                                            <span className="text-xs text-[#737373] ml-2">
                                                {member.completed_items}/{member.total_items}
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-[#E0B954] to-[#E0B954] rounded-full"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                    <span className="text-xs font-medium text-[#E0B954] w-10 text-right">
                                        {pct}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Business Review Comments */}
            {businessReviewComments.length > 0 && (
                <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-9 h-9 rounded-xl bg-[#A78BFA]/10 flex items-center justify-center">
                            <MessageSquare className="w-4 h-4 text-[#A78BFA]" />
                        </div>
                        <h3 className="text-sm font-semibold text-white">Business Review Comments</h3>
                        <Badge className="bg-[#A78BFA]/20 text-[#A78BFA] border-0 ml-auto">
                            {businessReviewComments.length}
                        </Badge>
                        <button
                            onClick={() => setIsBusinessReviewExpanded(!isBusinessReviewExpanded)}
                            className="p-1 hover:bg-[rgba(167,139,250,0.1)] rounded-lg transition-colors"
                            title={isBusinessReviewExpanded ? "Collapse" : "Expand"}
                        >
                            <ChevronDown 
                                className={`w-5 h-5 text-[#A78BFA] transition-transform ${isBusinessReviewExpanded ? 'rotate-180' : ''}`}
                            />
                        </button>
                    </div>
                    {isBusinessReviewExpanded && (
                        <>
                            <div className="space-y-4">
                                {businessReviewComments.slice(0, 10).map(comment => {
                                    const isExpanded = expandedComments.has(comment.id);
                                    const isLongContent = comment.content.length > 150;
                                    const displayContent = isExpanded ? comment.content : comment.content.substring(0, 150);
                                    
                                    return (
                                    <div
                                        key={comment.id}
                                        className={`rounded-xl p-4 ${comment.is_resolved ? 'bg-[rgba(52,211,153,0.05)] border border-[rgba(52,211,153,0.2)]' : 'bg-[rgba(167,139,250,0.05)] border border-[rgba(167,139,250,0.2)]'}`}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${comment.is_resolved ? 'bg-[rgba(52,211,153,0.2)] text-[#34D399]' : 'bg-[rgba(167,139,250,0.2)] text-[#A78BFA]'}`}>
                                                        {comment.author_name?.charAt(0)?.toUpperCase() || '?'}
                                                    </div>
                                                    <span className="text-sm font-medium text-[#f5f5f5]">{comment.author_name}</span>
                                                    <span className="text-xs text-[#737373]">
                                                        {new Date(comment.created_at).toLocaleDateString()}
                                                    </span>
                                                    {comment.is_resolved && (
                                                        <span className="ml-auto px-2 py-0.5 rounded-md bg-[rgba(52,211,153,0.2)] text-[#34D399] text-[10px] font-medium">
                                                            RESOLVED
                                                        </span>
                                                    )}
                                                </div>
                                                <a
                                                    onClick={() => navigate(`/project/${project.id}/board/${comment.work_item_id}`)}
                                                    className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[rgba(224,185,84,0.1)] border border-[rgba(224,185,84,0.3)] text-[#E0B954] hover:bg-[rgba(224,185,84,0.2)] transition-colors text-xs font-medium mb-2 cursor-pointer"
                                                >
                                                    <span className="font-mono">{comment.work_item_key}</span>
                                                    <span className="truncate">{comment.work_item_title}</span>
                                                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                                </a>
                                            </div>
                                            <div className="flex items-center gap-2 ml-2">
                                                <button
                                                    onClick={() => toggleCommentResolved(comment.id, comment.is_resolved)}
                                                    className={`p-1.5 rounded-lg transition-colors ${comment.is_resolved ? 'hover:bg-[rgba(52,211,153,0.1)] text-[#34D399]' : 'hover:bg-[rgba(167,139,250,0.1)] text-[#A78BFA]'}`}
                                                    title={comment.is_resolved ? "Mark as unresolved" : "Mark as resolved"}
                                                >
                                                    {comment.is_resolved ? (
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    ) : (
                                                        <Circle className="w-4 h-4" />
                                                    )}
                                                </button>
                                                {isLongContent && (
                                                    <button
                                                        onClick={() => toggleCommentExpanded(comment.id)}
                                                        className="ml-2 p-1 hover:bg-[rgba(167,139,250,0.1)] rounded-lg transition-colors flex-shrink-0"
                                                        title={isExpanded ? "Collapse" : "Expand"}
                                                    >
                                                        <ChevronDown 
                                                            className={`w-4 h-4 text-[#A78BFA] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                        />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-sm text-[#a3a3a3] leading-relaxed">
                                            {displayContent}
                                            {!isExpanded && isLongContent && <span className="text-[#737373]">...</span>}
                                        </p>
                                    </div>
                                    );
                                })}
                            </div>
                            {businessReviewComments.length > 10 && (
                                <div className="mt-4 text-center">
                                    <p className="text-xs text-[#737373]">
                                        Showing 10 of {businessReviewComments.length} comments
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default BusinessReviewView;
