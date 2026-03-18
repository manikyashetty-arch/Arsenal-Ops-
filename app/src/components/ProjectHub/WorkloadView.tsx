import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, Clock, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

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
    this_week_remaining_hours?: number;  // Tasks due this week only
}

interface WorkloadViewProps {
    workloadData: WorkloadData[];
    onDeveloperClick?: (developerId: number | string) => void;
}

const WorkloadView: React.FC<WorkloadViewProps> = ({ workloadData, onDeveloperClick }) => {
    const getCapacityColor = (percentage: number) => {
        if (percentage > 100) return 'text-red-400';
        if (percentage > 80) return 'text-yellow-400';
        return 'text-green-400';
    };

    const getCapacityBarColor = (percentage: number) => {
        if (percentage > 100) return 'bg-red-500';
        if (percentage > 80) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    // Sort by this week's workload (highest first)
    const sortedData = [...workloadData].sort((a, b) => 
        (b.this_week_remaining_hours ?? 0) - (a.this_week_remaining_hours ?? 0)
    );

    return (
        <Card className="bg-[#0d0d0d] border-[rgba(255,255,255,0.08)]">
            <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Workload View
                </CardTitle>
            </CardHeader>
            <CardContent>
                {sortedData.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-[#737373]">No workload data available</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sortedData.map((developer) => {
                            // Assume 40 hours/week capacity
                            const weeklyCapacity = 40;
                            // Use this week's remaining hours for capacity calculation
                            const thisWeekHours = developer.this_week_remaining_hours ?? 0;
                            const capacityPercentage = Math.round((thisWeekHours / weeklyCapacity) * 100);
                            
                            return (
                                <div
                                    key={developer.developer_id}
                                    className="bg-[#0A0A14] rounded-lg p-4 border border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.08)] transition-colors cursor-pointer"
                                    onClick={() => onDeveloperClick?.(developer.developer_id)}
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <Avatar className="w-10 h-10 bg-[#E0B954]">
                                            <AvatarFallback className="bg-[#E0B954] text-white text-sm font-medium">
                                                {getInitials(developer.developer_name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <h3 className="text-white font-medium">{developer.developer_name}</h3>
                                            <p className="text-[#737373] text-sm">{developer.total_items} items</p>
                                        </div>
                                        {developer.overdue_items > 0 && (
                                            <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
                                                {developer.overdue_items} overdue
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Weekly Capacity Bar */}
                                    <div className="mb-4">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-1">
                                                <span className="text-[#737373] text-sm">Remaining</span>
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            <Info className="w-3 h-3 text-[#737373]" />
                                                        </TooltipTrigger>
                                                        <TooltipContent className="bg-[#121212] border-[rgba(255,255,255,0.08)] text-white max-w-xs">
                                                            <p>Remaining hours on in-progress tickets assigned to this developer.</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                            <span className={`text-sm font-medium ${getCapacityColor(capacityPercentage)}`}>
                                                {capacityPercentage}%
                                            </span>
                                        </div>
                                        <div className="h-2 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${getCapacityBarColor(capacityPercentage)}`}
                                                style={{ width: `${Math.min(100, capacityPercentage)}%` }}
                                            />
                                        </div>
                                        <p className="text-[#737373] text-xs mt-1">
                                            {thisWeekHours}h remaining / {weeklyCapacity}h capacity
                                        </p>
                                    </div>

                                    {/* Status Breakdown */}
                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                        <div className="text-center p-2 rounded bg-[rgba(255,255,255,0.02)]">
                                            <div className="flex items-center justify-center gap-1 mb-1">
                                                <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                                            </div>
                                            <p className="text-white font-medium">{developer.completed_items}</p>
                                            <p className="text-[#737373] text-xs">Done</p>
                                        </div>
                                        <div className="text-center p-2 rounded bg-[rgba(255,255,255,0.02)]">
                                            <div className="flex items-center justify-center gap-1 mb-1">
                                                <Clock className="w-3 h-3 text-[#F59E0B]" />
                                            </div>
                                            <p className="text-white font-medium">{developer.in_progress_items}</p>
                                            <p className="text-[#737373] text-xs">Active</p>
                                        </div>
                                        <div className="text-center p-2 rounded bg-[rgba(255,255,255,0.02)]">
                                            <div className="flex items-center justify-center gap-1 mb-1">
                                                <AlertTriangle className="w-3 h-3 text-[#EF4444]" />
                                            </div>
                                            <p className="text-white font-medium">{developer.overdue_items}</p>
                                            <p className="text-[#737373] text-xs">Overdue</p>
                                        </div>
                                    </div>

                                    {/* Hours Summary */}
                                    <div className="grid grid-cols-3 gap-2 text-sm">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger className="text-left">
                                                    <div>
                                                        <span className="text-[#737373] text-xs">Logged</span>
                                                        <p className="text-white font-medium">{developer.logged_hours}h</p>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-[#121212] border-[rgba(255,255,255,0.08)] text-white">
                                                    <p>Total hours logged across all tasks</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger className="text-left">
                                                    <div>
                                                        <span className="text-[#737373] text-xs">Remaining</span>
                                                        <p className="text-white font-medium">{thisWeekHours}h</p>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-[#121212] border-[rgba(255,255,255,0.08)] text-white">
                                                    <p>Hours for tasks due this week (Mon-Fri only)</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger className="text-left">
                                                    <div>
                                                        <span className="text-[#737373] text-xs">Total Rem</span>
                                                        <p className="text-white font-medium">{developer.remaining_hours}h</p>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-[#121212] border-[rgba(255,255,255,0.08)] text-white">
                                                    <p>Total remaining hours across all incomplete tasks</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Legend */}
                <div className="flex items-center gap-6 mt-6 pt-4 border-t border-[rgba(255,255,255,0.05)]">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-[#737373] text-sm">Under 80%</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <span className="text-[#737373] text-sm">80-100%</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-[#737373] text-sm">Over capacity</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default WorkloadView;
