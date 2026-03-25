import React, { useState, useEffect } from 'react';
import { Clock, Users, Calendar, TrendingUp, AlertTriangle, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { API_BASE_URL } from '@/config/api';
import HoursDebugPanel from './HoursDebugPanel';

interface PMViewProps {
    projectId: string;
    token: string;
    isAdmin?: boolean;
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

interface TimeEntry {
    hours: number;
    logged_at: string;
    is_this_week: boolean;
    description?: string;
}

interface TicketBreakdown {
    ticket_id: number;
    key: string;
    title: string;
    status: string;
    estimated_hours: number;
    total_logged_on_ticket: number;
    my_logged_hours: number;
    remaining_hours: number;
    time_entries: TimeEntry[];
}

interface HoursOnOthersTicket {
    ticket_key: string;
    ticket_title: string;
    ticket_assignee: string;
    hours: number;
    logged_at: string;
}

interface DeveloperHours {
    developer_id: number;
    developer_name: string;
    developer_email: string;
    role: string;
    allocated_hours: number;
    logged_hours: number;
    remaining_hours: number;
    current_week_logged: number;
    total_items: number;
    completed_items: number;
    my_tickets: TicketBreakdown[];
    hours_logged_on_others_tickets: HoursOnOthersTicket[];
    attribution_note: string;
}

interface WeeklyHours {
    week: string;
    week_end: string;
    week_label: string;
    allocated_hours: number;
    logged_hours: number;
    items_completed: number;
}

export default function PMView({ projectId, token, isAdmin = false }: PMViewProps) {
    const [analytics, setAnalytics] = useState<HoursAnalytics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [weekFilter, setWeekFilter] = useState<'all' | 'with-activity'>('all');
    const [expandedDeveloper, setExpandedDeveloper] = useState<number | null>(null);
    const [showDebugPanel, setShowDebugPanel] = useState(false);

    useEffect(() => {
        fetchAnalytics();
    }, [projectId]);

    const toggleDeveloperExpand = (devId: number) => {
        setExpandedDeveloper(expandedDeveloper === devId ? null : devId);
    };

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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E0B954]"></div>
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="text-center py-12">
                <p className="text-[#737373]">No analytics data available</p>
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
                <Card className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.05)]">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#E0B954]/20 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-[#E0B954]" />
                            </div>
                            <div>
                                <p className="text-xs text-[#737373]">Allocated Hours</p>
                                <p className="text-xl font-bold text-white">{analytics.total_allocated_hours}h</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.05)]">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#E0B954]/20 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-[#E0B954]" />
                            </div>
                            <div>
                                <p className="text-xs text-[#737373]">Logged Hours</p>
                                <p className="text-xl font-bold text-white">{analytics.total_logged_hours}h</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.05)]">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
                            </div>
                            <div>
                                <p className="text-xs text-[#737373]">Remaining Hours</p>
                                <p className="text-xl font-bold text-white">{analytics.total_remaining_hours}h</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.05)]">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#C79E3B]/20 flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-[#C79E3B]" />
                            </div>
                            <div>
                                <p className="text-xs text-[#737373]">Progress</p>
                                <p className="text-xl font-bold text-white">{progressPercentage}%</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Weekly Hours Table */}
            <Card className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.05)]">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Weekly Hours Breakdown
                        <span className="text-xs text-[#737373] font-normal ml-2">(Last 10 weeks)</span>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setWeekFilter(weekFilter === 'all' ? 'with-activity' : 'all')}
                            className={`border-[rgba(255,255,255,0.08)] text-xs ${weekFilter === 'with-activity' ? 'bg-[#E0B954]/20 text-[#E0B954]' : 'text-[#737373]'}`}
                        >
                            <Filter className="w-3 h-3 mr-1" />
                            {weekFilter === 'all' ? 'Show All' : 'With Activity'}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[rgba(255,255,255,0.05)]">
                                    <th className="text-left py-3 px-4 text-xs font-medium text-[#737373] uppercase">Week</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-[#737373] uppercase">Date Range</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#737373] uppercase">Allocated</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#737373] uppercase">Logged</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#737373] uppercase">Completed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.weekly_hours
                                    .filter(week => weekFilter === 'all' || week.logged_hours > 0 || week.allocated_hours > 0 || week.items_completed > 0)
                                    .slice(0, 10)
                                    .map((week, idx) => (
                                    <tr key={idx} className={`border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)] ${week.logged_hours > 0 ? 'bg-[#E0B954]/5' : ''}`}>
                                        <td className="py-3 px-4 text-sm text-white font-medium">{week.week_label}</td>
                                        <td className="py-3 px-4 text-sm text-[#a3a3a3]">{week.week} - {week.week_end}</td>
                                        <td className="py-3 px-4 text-sm text-right text-white">{week.allocated_hours}h</td>
                                        <td className="py-3 px-4 text-sm text-right">
                                            <span className={week.logged_hours > 0 ? 'text-[#E0B954] font-semibold' : 'text-[#737373]'}>
                                                {week.logged_hours}h
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-right">
                                            <Badge variant="outline" className="border-[rgba(255,255,255,0.08)] text-[#a3a3a3]">
                                                {week.items_completed}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {analytics.weekly_hours.length === 0 && (
                            <div className="text-center py-8 text-[#737373]">
                                <p>No sprints created yet. Weeks will appear once sprints are started.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Developer Hours Table */}
            <Card className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.05)]">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Developer Hours Summary
                    </CardTitle>
                    <p className="text-xs text-[#737373] mt-1">
                        Click on a developer row to see detailed ticket breakdown. 
                        <span className="text-[#C79E3B]"> Hours are attributed to the person who logged them.</span>
                    </p>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[rgba(255,255,255,0.05)]">
                                    <th className="text-left py-3 px-4 text-xs font-medium text-[#737373] uppercase">Developer</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-[#737373] uppercase">Role</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#737373] uppercase">Allocated</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#737373] uppercase">Logged</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#C79E3B] uppercase">This Week</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#737373] uppercase">Remaining</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#737373] uppercase">Items</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#737373] uppercase">Completed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.developer_hours.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-8 text-center text-[#737373]">
                                            No developers assigned to this project
                                        </td>
                                    </tr>
                                ) : (
                                    analytics.developer_hours.map((dev) => {
                                        const isExpanded = expandedDeveloper === dev.developer_id;
                                        const hasHoursOnOthersTickets = dev.hours_logged_on_others_tickets && dev.hours_logged_on_others_tickets.length > 0;
                                        
                                        return (
                                            <React.Fragment key={dev.developer_id}>
                                                <tr 
                                                    className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)] cursor-pointer"
                                                    onClick={() => toggleDeveloperExpand(dev.developer_id)}
                                                >
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E0B954] to-[#B8872A] flex items-center justify-center text-white text-sm font-semibold">
                                                                {dev.developer_name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm text-white">{dev.developer_name}</p>
                                                                <p className="text-xs text-[#737373]">{dev.developer_email}</p>
                                                            </div>
                                                            {hasHoursOnOthersTickets && (
                                                                <Badge className="bg-[#F59E0B]/20 text-[#F59E0B] border-0 text-xs">
                                                                    +{dev.hours_logged_on_others_tickets.reduce((sum, t) => sum + t.hours, 0)}h on others' tickets
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <Badge variant="outline" className="border-[rgba(255,255,255,0.08)] text-[#a3a3a3]">
                                                            {dev.role}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-right text-white">{dev.allocated_hours}h</td>
                                                    <td className="py-3 px-4 text-sm text-right">
                                                        <span className={dev.logged_hours > 0 ? 'text-[#E0B954]' : 'text-[#737373]'}>
                                                            {dev.logged_hours}h
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-right">
                                                        <span className={dev.current_week_logged > 0 ? 'text-[#C79E3B] font-semibold' : 'text-[#737373]'}>
                                                            {dev.current_week_logged}h
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-right">
                                                        <span className={dev.remaining_hours > 0 ? 'text-[#F59E0B]' : 'text-[#737373]'}>
                                                            {dev.remaining_hours}h
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-right text-white">{dev.total_items}</td>
                                                    <td className="py-3 px-4 text-sm text-right">
                                                        <Badge className="bg-[#E0B954]/20 text-[#E0B954] border-0">
                                                            {dev.completed_items}/{dev.total_items}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                                
                                                {/* Expanded Detail Row */}
                                                {isExpanded && (
                                                    <tr className="bg-[rgba(255,255,255,0.01)]">
                                                        <td colSpan={8} className="py-4 px-4">
                                                            <div className="space-y-4">
                                                                {/* My Tickets Section */}
                                                                <div>
                                                                    <h4 className="text-xs font-medium text-[#737373] uppercase mb-2">My Assigned Tickets</h4>
                                                                    {dev.my_tickets && dev.my_tickets.length > 0 ? (
                                                                        <div className="space-y-2">
                                                                            {dev.my_tickets.map((ticket) => (
                                                                                <div key={ticket.ticket_id} className="flex items-center justify-between py-2 px-3 bg-[rgba(255,255,255,0.03)] rounded">
                                                                                    <div className="flex items-center gap-3">
                                                                                        <Badge 
                                                                                            variant="outline" 
                                                                                            className={`
                                                                                                text-xs border-0
                                                                                                ${ticket.status === 'done' ? 'bg-green-500/20 text-green-400' : ''}
                                                                                                ${ticket.status === 'in_progress' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : ''}
                                                                                                ${ticket.status === 'in_review' ? 'bg-blue-500/20 text-blue-400' : ''}
                                                                                                ${ticket.status === 'todo' ? 'bg-[#737373]/20 text-[#737373]' : ''}
                                                                                            `}
                                                                                        >
                                                                                            {ticket.status}
                                                                                        </Badge>
                                                                                        <span className="text-sm text-white">{ticket.key}</span>
                                                                                        <span className="text-sm text-[#a3a3a3] truncate max-w-[200px]">{ticket.title}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-4 text-xs">
                                                                                        <span className="text-[#737373]">Est: <span className="text-white">{ticket.estimated_hours}h</span></span>
                                                                                        <span className="text-[#737373]">Total Logged: <span className="text-[#E0B954]">{ticket.total_logged_on_ticket}h</span></span>
                                                                                        <span className="text-[#737373]">My Hours: <span className={ticket.my_logged_hours > 0 ? 'text-[#C79E3B]' : 'text-[#737373]'}>{ticket.my_logged_hours}h</span></span>
                                                                                        <span className="text-[#737373]">Remaining: <span className="text-[#F59E0B]">{ticket.remaining_hours}h</span></span>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-xs text-[#737373]">No assigned tickets</p>
                                                                    )}
                                                                </div>
                                                                
                                                                {/* Hours on Others' Tickets */}
                                                                {hasHoursOnOthersTickets && (
                                                                    <div>
                                                                        <h4 className="text-xs font-medium text-[#737373] uppercase mb-2">Hours Logged on Others' Tickets</h4>
                                                                        <div className="space-y-2">
                                                                            {dev.hours_logged_on_others_tickets.map((entry, idx) => (
                                                                                <div key={idx} className="flex items-center justify-between py-2 px-3 bg-[rgba(245,158,11,0.05)] rounded border border-[rgba(245,158,11,0.1)]">
                                                                                    <div className="flex items-center gap-3">
                                                                                        <span className="text-sm text-white">{entry.ticket_key}</span>
                                                                                        <span className="text-sm text-[#a3a3a3] truncate max-w-[200px]">{entry.ticket_title}</span>
                                                                                        <span className="text-xs text-[#737373]">(Assignee: {entry.ticket_assignee})</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-4 text-xs">
                                                                                        <span className="text-[#F59E0B] font-medium">{entry.hours}h logged</span>
                                                                                        <span className="text-[#737373]">{new Date(entry.logged_at).toLocaleDateString()}</span>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                
                                                                <p className="text-xs text-[#737373] italic">
                                                                    {dev.attribution_note}
                                                                </p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Sprint Hours Table */}
            <Card className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.05)]">
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
                                <tr className="border-b border-[rgba(255,255,255,0.05)]">
                                    <th className="text-left py-3 px-4 text-xs font-medium text-[#737373] uppercase">Sprint</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-[#737373] uppercase">Status</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#737373] uppercase">Allocated</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#737373] uppercase">Logged</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#737373] uppercase">Remaining</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-[#737373] uppercase">Items</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.sprint_hours.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-[#737373]">
                                            No sprints created for this project
                                        </td>
                                    </tr>
                                ) : (
                                    analytics.sprint_hours.map((sprint) => (
                                        <tr key={sprint.sprint_id} className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)]">
                                            <td className="py-3 px-4 text-sm text-white">{sprint.sprint_name}</td>
                                            <td className="py-3 px-4">
                                                <Badge className={
                                                    sprint.status === 'completed' ? 'bg-[#E0B954]/20 text-[#E0B954] border-0' :
                                                    sprint.status === 'active' ? 'bg-[#E0B954]/20 text-[#E0B954] border-0' :
                                                    'bg-[#737373]/20 text-[#a3a3a3] border-0'
                                                }>
                                                    {sprint.status}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-right text-white">{sprint.allocated_hours}h</td>
                                            <td className="py-3 px-4 text-sm text-right">
                                                <span className={sprint.logged_hours > 0 ? 'text-[#E0B954]' : 'text-[#737373]'}>
                                                    {sprint.logged_hours}h
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-right">
                                                <span className={sprint.remaining_hours > 0 ? 'text-[#F59E0B]' : 'text-[#737373]'}>
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

            {/* Debug Panel Toggle */}
            <div className="flex justify-end">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDebugPanel(!showDebugPanel)}
                    className="text-xs text-[#737373] hover:text-white"
                >
                    {showDebugPanel ? 'Hide Diagnostics' : 'Show Diagnostics'}
                </Button>
            </div>

            {/* Debug Panel */}
            {showDebugPanel && (
                <HoursDebugPanel 
                    projectId={projectId} 
                    token={token} 
                    isAdmin={isAdmin}
                />
            )}
        </div>
    );
}
