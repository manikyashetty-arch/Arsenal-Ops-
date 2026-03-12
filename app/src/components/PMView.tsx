import { useState, useEffect } from 'react';
import { Clock, Users, Calendar, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { API_BASE_URL } from '@/config/api';

interface PMViewProps {
    projectId: string;
    token: string;
}

interface HoursAnalytics {
    project_name: string;
    total_allocated_hours: number;
    total_logged_hours: number;
    total_remaining_hours: number;
    sprint_hours: SprintHours[];
    developer_hours: DeveloperHours[];
    weekly_hours: WeeklyHours[];
}

interface SprintHours {
    sprint_id: number;
    sprint_name: string;
    status: string;
    allocated_hours: number;
    logged_hours: number;
    remaining_hours: number;
    total_items: number;
}

interface DeveloperHours {
    developer_id: number;
    developer_name: string;
    developer_email: string;
    role: string;
    allocated_hours: number;
    logged_hours: number;
    remaining_hours: number;
    total_items: number;
    completed_items: number;
}

interface WeeklyHours {
    week: string;
    week_label: string;
    allocated_hours: number;
    logged_hours: number;
    items_completed: number;
}

export default function PMView({ projectId, token }: PMViewProps) {
    const [analytics, setAnalytics] = useState<HoursAnalytics | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchAnalytics();
    }, [projectId]);

    const fetchAnalytics = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/workitems/projects/${projectId}/hours-analytics`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setAnalytics(await res.json());
            }
        } catch (err) {
            console.error('Failed to fetch hours analytics:', err);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]"></div>
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="text-center py-12">
                <p className="text-[#64748B]">No analytics data available</p>
            </div>
        );
    }

    const progressPercentage = analytics.total_allocated_hours > 0 
        ? Math.round((analytics.total_logged_hours / analytics.total_allocated_hours) * 100) 
        : 0;

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-[rgba(244,246,255,0.02)] border-[rgba(244,246,255,0.06)]">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#6366F1]/20 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-[#6366F1]" />
                            </div>
                            <div>
                                <p className="text-xs text-[#64748B]">Allocated Hours</p>
                                <p className="text-xl font-bold text-white">{analytics.total_allocated_hours}h</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[rgba(244,246,255,0.02)] border-[rgba(244,246,255,0.06)]">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#10B981]/20 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-[#10B981]" />
                            </div>
                            <div>
                                <p className="text-xs text-[#64748B]">Logged Hours</p>
                                <p className="text-xl font-bold text-white">{analytics.total_logged_hours}h</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[rgba(244,246,255,0.02)] border-[rgba(244,246,255,0.06)]">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
                            </div>
                            <div>
                                <p className="text-xs text-[#64748B]">Remaining Hours</p>
                                <p className="text-xl font-bold text-white">{analytics.total_remaining_hours}h</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[rgba(244,246,255,0.02)] border-[rgba(244,246,255,0.06)]">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/20 flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-[#8B5CF6]" />
                            </div>
                            <div>
                                <p className="text-xs text-[#64748B]">Progress</p>
                                <p className="text-xl font-bold text-white">{progressPercentage}%</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Weekly Hours Table */}
            <Card className="bg-[rgba(244,246,255,0.02)] border-[rgba(244,246,255,0.06)]">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Weekly Hours Breakdown
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[rgba(244,246,255,0.06)]">
                                    <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B] uppercase">Week</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B] uppercase">Date</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase">Allocated</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase">Logged</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase">Items Completed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.weekly_hours.map((week, idx) => (
                                    <tr key={idx} className="border-b border-[rgba(244,246,255,0.04)] hover:bg-[rgba(244,246,255,0.02)]">
                                        <td className="py-3 px-4 text-sm text-white">{week.week_label}</td>
                                        <td className="py-3 px-4 text-sm text-[#94A3B8]">{week.week}</td>
                                        <td className="py-3 px-4 text-sm text-right text-white">{week.allocated_hours}h</td>
                                        <td className="py-3 px-4 text-sm text-right">
                                            <span className={week.logged_hours > 0 ? 'text-[#10B981]' : 'text-[#64748B]'}>
                                                {week.logged_hours}h
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-right">
                                            <Badge variant="outline" className="border-[rgba(244,246,255,0.1)] text-[#94A3B8]">
                                                {week.items_completed}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Developer Hours Table */}
            <Card className="bg-[rgba(244,246,255,0.02)] border-[rgba(244,246,255,0.06)]">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Developer Hours Summary
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[rgba(244,246,255,0.06)]">
                                    <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B] uppercase">Developer</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B] uppercase">Role</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase">Allocated</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase">Logged</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase">Remaining</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase">Items</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase">Completed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.developer_hours.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-[#64748B]">
                                            No developers assigned to this project
                                        </td>
                                    </tr>
                                ) : (
                                    analytics.developer_hours.map((dev) => {
                                        return (
                                            <tr key={dev.developer_id} className="border-b border-[rgba(244,246,255,0.04)] hover:bg-[rgba(244,246,255,0.02)]">
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366F1] to-[#4F46E5] flex items-center justify-center text-white text-sm font-semibold">
                                                            {dev.developer_name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm text-white">{dev.developer_name}</p>
                                                            <p className="text-xs text-[#64748B]">{dev.developer_email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Badge variant="outline" className="border-[rgba(244,246,255,0.1)] text-[#94A3B8]">
                                                        {dev.role}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-right text-white">{dev.allocated_hours}h</td>
                                                <td className="py-3 px-4 text-sm text-right">
                                                    <span className={dev.logged_hours > 0 ? 'text-[#10B981]' : 'text-[#64748B]'}>
                                                        {dev.logged_hours}h
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-right">
                                                    <span className={dev.remaining_hours > 0 ? 'text-[#F59E0B]' : 'text-[#64748B]'}>
                                                        {dev.remaining_hours}h
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-right text-white">{dev.total_items}</td>
                                                <td className="py-3 px-4 text-sm text-right">
                                                    <Badge className="bg-[#10B981]/20 text-[#10B981] border-0">
                                                        {dev.completed_items}/{dev.total_items}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Sprint Hours Table */}
            <Card className="bg-[rgba(244,246,255,0.02)] border-[rgba(244,246,255,0.06)]">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Sprint Hours Breakdown
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[rgba(244,246,255,0.06)]">
                                    <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B] uppercase">Sprint</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B] uppercase">Status</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase">Allocated</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase">Logged</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase">Remaining</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase">Items</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.sprint_hours.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-[#64748B]">
                                            No sprints created for this project
                                        </td>
                                    </tr>
                                ) : (
                                    analytics.sprint_hours.map((sprint) => (
                                        <tr key={sprint.sprint_id} className="border-b border-[rgba(244,246,255,0.04)] hover:bg-[rgba(244,246,255,0.02)]">
                                            <td className="py-3 px-4 text-sm text-white">{sprint.sprint_name}</td>
                                            <td className="py-3 px-4">
                                                <Badge className={
                                                    sprint.status === 'completed' ? 'bg-[#10B981]/20 text-[#10B981] border-0' :
                                                    sprint.status === 'active' ? 'bg-[#6366F1]/20 text-[#6366F1] border-0' :
                                                    'bg-[#64748B]/20 text-[#94A3B8] border-0'
                                                }>
                                                    {sprint.status}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-right text-white">{sprint.allocated_hours}h</td>
                                            <td className="py-3 px-4 text-sm text-right">
                                                <span className={sprint.logged_hours > 0 ? 'text-[#10B981]' : 'text-[#64748B]'}>
                                                    {sprint.logged_hours}h
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-right">
                                                <span className={sprint.remaining_hours > 0 ? 'text-[#F59E0B]' : 'text-[#64748B]'}>
                                                    {sprint.remaining_hours}h
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-right text-white">{sprint.total_items}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
