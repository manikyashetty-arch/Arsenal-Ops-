import React, { useMemo, useState } from 'react';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

interface WorkItem {
    id: string;
    key: string;
    title: string;
    status: string;
    start_date?: string;
    due_date?: string;
    estimated_hours?: number;
    assignee?: string;
    dependencies?: { depends_on_id: number; dependency_type: string }[];
}

interface TimelineViewProps {
    workItems: WorkItem[];
    projectStartDate: string;
    onTaskClick?: (item: WorkItem) => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({ workItems, onTaskClick }) => {
    const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week);
    const [currentDate, setCurrentDate] = useState(new Date());

    const tasks: Task[] = useMemo(() => {
        return workItems
            .filter(item => item.start_date || item.due_date)
            .map((item) => {
                const startDate = item.start_date ? new Date(item.start_date) : new Date();
                const endDate = item.due_date ? new Date(item.due_date) : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                
                // Determine task color based on status
                let backgroundColor = '#6366F1'; // Default indigo
                let progressColor = '#818CF8';
                
                switch (item.status) {
                    case 'done':
                        backgroundColor = '#10B981';
                        progressColor = '#34D399';
                        break;
                    case 'in_progress':
                        backgroundColor = '#F59E0B';
                        progressColor = '#FBBF24';
                        break;
                    case 'in_review':
                        backgroundColor = '#8B5CF6';
                        progressColor = '#A78BFA';
                        break;
                    case 'todo':
                        backgroundColor = '#64748B';
                        progressColor = '#94A3B8';
                        break;
                }

                return {
                    id: item.id,
                    name: `${item.key}: ${item.title}`,
                    start: startDate,
                    end: endDate,
                    progress: item.status === 'done' ? 100 : item.status === 'in_progress' ? 50 : 0,
                    type: 'task' as const,
                    project: item.key,
                    styles: {
                        backgroundColor,
                        backgroundSelectedColor: backgroundColor,
                        progressColor,
                        progressSelectedColor: progressColor,
                    },
                };
            });
    }, [workItems]);

    const handleZoomIn = () => {
        if (viewMode === ViewMode.Month) setViewMode(ViewMode.Week);
        else if (viewMode === ViewMode.Week) setViewMode(ViewMode.Day);
    };

    const handleZoomOut = () => {
        if (viewMode === ViewMode.Day) setViewMode(ViewMode.Week);
        else if (viewMode === ViewMode.Week) setViewMode(ViewMode.Month);
    };

    const displayOptions = {
        columnWidth: viewMode === ViewMode.Day ? 60 : viewMode === ViewMode.Week ? 100 : 200,
        listCellWidth: '250px',
        rowHeight: 40,
        ganttHeight: Math.min(400, tasks.length * 50 + 50),
        viewMode,
        viewDate: currentDate,
    };

    const handleClick = (task: Task) => {
        const item = workItems.find(wi => wi.id === task.id);
        if (item && onTaskClick) {
            onTaskClick(item);
        }
    };

    if (tasks.length === 0) {
        return (
            <Card className="bg-[#0F0F1A] border-[rgba(244,246,255,0.1)]">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        Timeline View
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-center py-12">
                    <p className="text-[#64748B]">No tasks with dates to display</p>
                    <p className="text-[#64748B] text-sm mt-2">Add start and due dates to your tasks to see them in the timeline</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-[#0F0F1A] border-[rgba(244,246,255,0.1)]">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                    Timeline View
                </CardTitle>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-[rgba(244,246,255,0.2)] text-white hover:bg-[rgba(244,246,255,0.1)] hover:text-white"
                        onClick={() => setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000))}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-[rgba(244,246,255,0.2)] text-white hover:bg-[rgba(244,246,255,0.1)] hover:text-white"
                        onClick={() => setCurrentDate(new Date())}
                    >
                        Today
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-[rgba(244,246,255,0.2)] text-white hover:bg-[rgba(244,246,255,0.1)] hover:text-white"
                        onClick={() => setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000))}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                    <div className="w-px h-6 bg-[rgba(244,246,255,0.1)] mx-2" />
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-[rgba(244,246,255,0.2)] text-white hover:bg-[rgba(244,246,255,0.1)] hover:text-white disabled:opacity-50"
                        onClick={handleZoomIn} 
                        disabled={viewMode === ViewMode.Day}
                    >
                        <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-[rgba(244,246,255,0.2)] text-white hover:bg-[rgba(244,246,255,0.1)] hover:text-white disabled:opacity-50"
                        onClick={handleZoomOut} 
                        disabled={viewMode === ViewMode.Month}
                    >
                        <ZoomOut className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <style>{`
                    .gantt-task-react-root {
                        font-family: inherit;
                    }
                    .gantt-task-react-root svg {
                        background: #0A0A14 !important;
                    }
                    .gantt-task-react-root .gantt-task-list-wrapper {
                        background: #0A0A14 !important;
                    }
                    .gantt-task-react-root .gantt-task-list-header {
                        background: #1A1A2E !important;
                        border-color: rgba(244,246,255,0.15) !important;
                    }
                    .gantt-task-react-root .gantt-task-list-cell {
                        color: #E5E7EB !important;
                        background: #0A0A14 !important;
                        border-color: rgba(244,246,255,0.1) !important;
                        font-size: 13px;
                        padding: 8px 12px !important;
                    }
                    .gantt-task-react-root .gantt-task-list-header-cell {
                        color: #9CA3AF !important;
                        border-color: rgba(244,246,255,0.15) !important;
                        font-weight: 600;
                        padding: 10px 12px !important;
                    }
                    .gantt-task-react-root .grid-row-line {
                        stroke: rgba(244,246,255,0.08) !important;
                    }
                    .gantt-task-react-root .grid-tick-line {
                        stroke: rgba(244,246,255,0.08) !important;
                    }
                    .gantt-task-react-root .calendar-top {
                        fill: #9CA3AF !important;
                    }
                    .gantt-task-react-root .calendar-bottom {
                        fill: #D1D5DB !important;
                    }
                    .gantt-task-react-root .today-highlight {
                        fill: rgba(99, 102, 241, 0.15) !important;
                    }
                    .gantt-task-react-root rect[fill="white"],
                    .gantt-task-react-root rect[fill="#fff"] {
                        fill: #0A0A14 !important;
                    }
                    .gantt-task-react-root text {
                        fill: #E5E7EB !important;
                    }
                    .gantt-task-react-root .bar-wrapper {
                        cursor: pointer;
                    }
                    .gantt-task-react-root .bar-wrapper:hover rect {
                        filter: brightness(1.1);
                    }
                `}</style>
                <div className="rounded-lg overflow-hidden bg-[#0A0A14]">
                    <Gantt
                        tasks={tasks}
                        {...displayOptions}
                        onClick={handleClick}
                        TooltipContent={({ task }: { task: Task }) => (
                            <div className="bg-[#1A1A2E] p-3 rounded-lg shadow-xl border border-[rgba(244,246,255,0.1)]">
                                <p className="text-white font-medium">{task.name}</p>
                                <p className="text-[#64748B] text-sm">
                                    {task.start.toLocaleDateString()} - {task.end.toLocaleDateString()}
                                </p>
                                <p className="text-[#64748B] text-sm">
                                    Progress: {task.progress}%
                                </p>
                            </div>
                        )}
                    />
                </div>
                <div className="flex items-center gap-4 mt-4 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-[#10B981]" />
                        <span className="text-[#64748B]">Done</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-[#F59E0B]" />
                        <span className="text-[#64748B]">In Progress</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-[#8B5CF6]" />
                        <span className="text-[#64748B]">In Review</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-[#64748B]" />
                        <span className="text-[#64748B]">To Do</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default TimelineView;
