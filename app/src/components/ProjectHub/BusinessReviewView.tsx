import React from 'react';
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
} from 'lucide-react';

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
        if (score >= 80) return { color: '#10B981', label: 'Healthy', borderColor: 'border-[#10B981]/20', bgColor: 'bg-[#10B981]/5' };
        if (score >= 60) return { color: '#F59E0B', label: 'At Risk', borderColor: 'border-[#F59E0B]/20', bgColor: 'bg-[#F59E0B]/5' };
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
                    className={`bg-[rgba(244,246,255,0.02)] border ${health.borderColor} ${health.bgColor} rounded-2xl p-5 flex flex-col items-center justify-center`}
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
                <div className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-[#6366F1]/10 flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-[#6366F1]" />
                        </div>
                        <span className="text-xs text-[#64748B]">Sprint Velocity</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{avgVelocity}</p>
                    <p className="text-xs text-[#64748B] mt-1">pts avg / sprint</p>
                </div>

                {/* On-Time Delivery */}
                <div className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                        </div>
                        <span className="text-xs text-[#64748B]">On-Time Delivery</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{onTimeDeliveryPct}%</p>
                    <p className="text-xs text-[#64748B] mt-1">
                        {analytics?.status_distribution?.done || 0} / {analytics?.total_items || 0} done
                    </p>
                </div>

                {/* Open Bugs */}
                <div className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
                            <AlertCircle className="w-4 h-4 text-[#EF4444]" />
                        </div>
                        <span className="text-xs text-[#64748B]">Open Bugs</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{openBugs}</p>
                    <p className="text-xs text-[#64748B] mt-1">{overdueItems} items overdue</p>
                </div>
            </div>

            {/* Milestone Progress */}
            {milestones.length > 0 && (
                <div className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center">
                                <Target className="w-4 h-4 text-[#8B5CF6]" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-white">Milestone Progress</h3>
                                <p className="text-xs text-[#64748B]">
                                    {completedMilestones} of {totalMilestones} completed
                                </p>
                            </div>
                        </div>
                        <Badge
                            className={`border-0 ${
                                milestonePct >= 50
                                    ? 'bg-[#10B981]/20 text-[#10B981]'
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
                                                ? 'bg-[#10B981]/20'
                                                : isOverdue
                                                ? 'bg-[#EF4444]/20'
                                                : 'bg-[#64748B]/20'
                                        }`}
                                    >
                                        {milestone.is_completed ? (
                                            <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                                        ) : isOverdue ? (
                                            <AlertTriangle className="w-3 h-3 text-[#EF4444]" />
                                        ) : (
                                            <Clock className="w-3 h-3 text-[#64748B]" />
                                        )}
                                    </div>
                                    <span
                                        className={`text-sm flex-1 ${
                                            milestone.is_completed
                                                ? 'text-[#64748B] line-through'
                                                : 'text-[#E2E8F0]'
                                        }`}
                                    >
                                        {milestone.title}
                                    </span>
                                    {milestone.due_date && (
                                        <span
                                            className={`text-xs ${
                                                isOverdue ? 'text-[#EF4444]' : 'text-[#64748B]'
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
            <div className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-2xl p-6">
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
                            color: overdueItems > 5 ? '#EF4444' : overdueItems > 0 ? '#F59E0B' : '#10B981',
                            icon: Clock,
                        },
                        {
                            label: 'Open Bugs',
                            value: openBugs,
                            color: openBugs > 10 ? '#EF4444' : openBugs > 3 ? '#F59E0B' : '#10B981',
                            icon: AlertCircle,
                        },
                        {
                            label: 'Unassigned',
                            value: unassigned,
                            color: unassigned > 5 ? '#F59E0B' : '#64748B',
                            icon: Users,
                        },
                        {
                            label: 'Critical Open',
                            value: criticalOpen,
                            color: criticalOpen > 0 ? '#EF4444' : '#10B981',
                            icon: AlertTriangle,
                        },
                    ].map(({ label, value, color, icon: Icon }) => (
                        <div
                            key={label}
                            className="bg-[rgba(244,246,255,0.03)] rounded-xl p-4 text-center"
                        >
                            <Icon className="w-5 h-5 mx-auto mb-2" style={{ color }} />
                            <p className="text-xl font-bold text-white">{value}</p>
                            <p className="text-xs text-[#64748B] mt-1">{label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Stakeholder Summary */}
            <div className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-[#6366F1]/10 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-[#6366F1]" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Stakeholder Summary</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left column */}
                    <div className="space-y-3">
                        <div className="bg-[rgba(244,246,255,0.03)] rounded-xl p-4">
                            <p className="text-xs text-[#64748B] mb-1">Project Status</p>
                            <p className="text-sm font-semibold text-white capitalize">
                                {project?.status || 'Active'}
                            </p>
                        </div>
                        <div className="bg-[rgba(244,246,255,0.03)] rounded-xl p-4">
                            <p className="text-xs text-[#64748B] mb-2">Overall Completion</p>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 bg-[rgba(244,246,255,0.06)] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-[#6366F1] to-[#10B981] rounded-full transition-all"
                                        style={{ width: `${completionPct}%` }}
                                    />
                                </div>
                                <span className="text-sm font-bold text-white">{completionPct}%</span>
                            </div>
                        </div>
                        {activeSprint && (
                            <div className="bg-[rgba(244,246,255,0.03)] rounded-xl p-4">
                                <p className="text-xs text-[#64748B] mb-1">Active Sprint</p>
                                <p className="text-sm font-semibold text-white">{activeSprint.name}</p>
                                <p className="text-xs text-[#10B981] mt-1">
                                    {activeSprint.completion_pct}% complete
                                </p>
                            </div>
                        )}
                    </div>
                    {/* Right column */}
                    <div className="space-y-3">
                        <div className="bg-[rgba(244,246,255,0.03)] rounded-xl p-4">
                            <p className="text-xs text-[#64748B] mb-2">Key Metrics</p>
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
                                        <span className="text-[#94A3B8]">{label}</span>
                                        <span className="text-white font-medium">{value}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-[rgba(244,246,255,0.03)] rounded-xl p-4">
                            <p className="text-xs text-[#64748B] mb-1">Next Milestone</p>
                            {milestones.filter(m => !m.is_completed).length > 0 ? (
                                <>
                                    <p className="text-sm font-semibold text-white">
                                        {milestones.find(m => !m.is_completed)?.title}
                                    </p>
                                    <p className="text-xs text-[#64748B] mt-1">
                                        {milestones.find(m => !m.is_completed)?.due_date
                                            ? `Due ${new Date(
                                                  milestones.find(m => !m.is_completed)!.due_date!
                                              ).toLocaleDateString()}`
                                            : 'No due date set'}
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm text-[#64748B]">All milestones completed</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Team Performance (if available) */}
            {analytics?.team_performance && analytics.team_performance.length > 0 && (
                <div className="bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-9 h-9 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
                            <Users className="w-4 h-4 text-[#10B981]" />
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
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366F1] to-[#4F46E5] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                        {member.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm text-[#E2E8F0] truncate">{member.name}</span>
                                            <span className="text-xs text-[#64748B] ml-2">
                                                {member.completed_items}/{member.total_items}
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-[rgba(244,246,255,0.06)] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-[#6366F1] to-[#10B981] rounded-full"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                    <span className="text-xs font-medium text-[#10B981] w-10 text-right">
                                        {pct}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BusinessReviewView;
