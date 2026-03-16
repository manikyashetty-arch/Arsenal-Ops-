import React, { useMemo, useState } from 'react';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Plus, X } from 'lucide-react';

interface WorkItem {
    id: string;
    key: string;
    title: string;
    status: string;
    start_date?: string;
    due_date?: string;
    estimated_hours?: number;
    assignee?: string;
    assignee_id?: number;
    dependencies?: { depends_on_id: number; dependency_type: string }[];
}

interface Milestone {
    id: number;
    title: string;
    due_date?: string;
    completed_at?: string;
}

interface Goal {
    id: number;
    title: string;
    due_date?: string;
    status: string;
    progress?: number;
}

interface Developer {
    id: number;
    name: string;
    email: string;
}

interface TimelineViewProps {
    workItems: WorkItem[];
    milestones?: Milestone[];
    goals?: Goal[];
    projectStartDate: string;
    projectId: number;
    developers?: Developer[];
    onTaskClick?: (item: WorkItem) => void;
    onTaskUpdate?: (itemId: string, updates: { start_date?: string; due_date?: string }) => void;
    onTaskCreate?: (task: { title: string; start_date: string; due_date: string; estimated_hours: number; assignee_id?: number }) => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({ 
    workItems, 
    milestones = [],
    goals = [],
    projectStartDate,
    projectId: _projectId,
    developers = [],
    onTaskClick,
    onTaskUpdate,
    onTaskCreate
}) => {
    const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTask, setNewTask] = useState({
        title: '',
        start_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        estimated_hours: 8,
        assignee_id: undefined as number | undefined
    });

    // Calculate project start (Sunday of the week containing project creation)
    const projectStart = useMemo(() => {
        if (!projectStartDate) return new Date();
        const date = new Date(projectStartDate);
        // Find Sunday of that week
        const day = date.getDay();
        const diff = date.getDate() - day;
        return new Date(date.setDate(diff));
    }, [projectStartDate]);

    const tasks: Task[] = useMemo(() => {
        console.log('Timeline workItems:', workItems);
        const workItemTasks = workItems
            .filter(item => item.start_date || item.due_date)
            .map((item) => {
                // Parse dates properly - handle both ISO strings and date objects
                const startStr = item.start_date || item.due_date;
                const endStr = item.due_date || item.start_date;
                const startDate = startStr ? new Date(startStr) : new Date();
                const endDate = endStr ? new Date(endStr) : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                
                // Ensure end date is after start date
                if (endDate <= startDate) {
                    endDate.setDate(startDate.getDate() + 1);
                }
                
                console.log('Task:', item.key, 'Start:', startDate, 'End:', endDate);
                
                let backgroundColor = '#6366F1';
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
                    isDisabled: false,
                    styles: {
                        backgroundColor,
                        backgroundSelectedColor: backgroundColor,
                        progressColor,
                        progressSelectedColor: progressColor,
                    },
                };
            });
        
        // Add milestones as tasks
        const milestoneTasks: Task[] = milestones
            .filter(m => m.due_date)
            .map((m) => {
                const dueDate = new Date(m.due_date!);
                // Ensure at least 1 day duration for visibility
                const endDate = new Date(dueDate);
                endDate.setDate(endDate.getDate() + 1);
                
                return {
                    id: `milestone-${m.id}`,
                    name: `🎯 ${m.title}`,
                    start: dueDate,
                    end: endDate,
                    progress: m.completed_at ? 100 : 0,
                    type: 'milestone' as const,
                    project: 'Milestones',
                    isDisabled: true,
                    styles: {
                        backgroundColor: m.completed_at ? '#10B981' : '#EC4899',
                        backgroundSelectedColor: m.completed_at ? '#10B981' : '#EC4899',
                        progressColor: m.completed_at ? '#34D399' : '#F472B6',
                        progressSelectedColor: m.completed_at ? '#34D399' : '#F472B6',
                    },
                };
            });
        
        // Add goals as tasks
        const goalTasks: Task[] = goals
            .filter(g => g.due_date)
            .map((g) => {
                const dueDate = new Date(g.due_date!);
                // Ensure at least 1 day duration for visibility
                const endDate = new Date(dueDate);
                endDate.setDate(endDate.getDate() + 1);
                
                return {
                    id: `goal-${g.id}`,
                    name: `⭐ ${g.title}`,
                    start: dueDate,
                    end: endDate,
                    progress: g.status === 'completed' ? 100 : g.progress || 0,
                    type: 'milestone' as const,
                    project: 'Goals',
                    isDisabled: true,
                    styles: {
                        backgroundColor: g.status === 'completed' ? '#10B981' : '#F59E0B',
                        backgroundSelectedColor: g.status === 'completed' ? '#10B981' : '#F59E0B',
                        progressColor: g.status === 'completed' ? '#34D399' : '#FBBF24',
                        progressSelectedColor: g.status === 'completed' ? '#34D399' : '#FBBF24',
                    },
                };
            });
        
        console.log('Timeline tasks:', workItemTasks.length, 'milestones:', milestoneTasks.length, 'goals:', goalTasks.length);
        
        return [...workItemTasks, ...milestoneTasks, ...goalTasks];
    }, [workItems, milestones, goals]);

    const handleZoomIn = () => {
        if (viewMode === ViewMode.Month) setViewMode(ViewMode.Week);
        else if (viewMode === ViewMode.Week) setViewMode(ViewMode.Day);
    };

    const handleZoomOut = () => {
        if (viewMode === ViewMode.Day) setViewMode(ViewMode.Week);
        else if (viewMode === ViewMode.Week) setViewMode(ViewMode.Month);
    };

    // Handle task date change (drag to resize)
    const handleDateChange = (task: Task) => {
        if (onTaskUpdate) {
            onTaskUpdate(task.id, {
                start_date: task.start.toISOString().split('T')[0],
                due_date: task.end.toISOString().split('T')[0]
            });
        }
    };

    const handleClick = (task: Task) => {
        const item = workItems.find(wi => wi.id === task.id);
        if (item && onTaskClick) {
            onTaskClick(item);
        }
    };

    const handleAddTask = () => {
        if (onTaskCreate && newTask.title.trim()) {
            onTaskCreate({
                title: newTask.title,
                start_date: newTask.start_date,
                due_date: newTask.due_date,
                estimated_hours: newTask.estimated_hours,
                assignee_id: newTask.assignee_id
            });
            setShowAddModal(false);
            setNewTask({
                title: '',
                start_date: new Date().toISOString().split('T')[0],
                due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                estimated_hours: 8,
                assignee_id: undefined
            });
        }
    };

    // Calculate view date - use currentDate from navigation
    const viewDate = useMemo(() => {
        return currentDate;
    }, [currentDate]);

    const displayOptions = {
        columnWidth: viewMode === ViewMode.Day ? 60 : viewMode === ViewMode.Week ? 150 : 250,
        listCellWidth: '',
        rowHeight: 50,
        barCornerRadius: 4,
        barFill: 75,
        ganttHeight: Math.min(500, tasks.length * 60 + 60),
        viewMode,
        viewDate,
    };

    if (tasks.length === 0 && !showAddModal) {
        return (
            <Card className="bg-[#0F0F1A] border-[rgba(244,246,255,0.1)]">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                        Timeline View
                    </CardTitle>
                    {onTaskCreate && (
                        <button 
                            className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-2"
                            onClick={() => setShowAddModal(true)}
                        >
                            <Plus className="w-4 h-4" />
                            Add Task
                        </button>
                    )}
                </CardHeader>
                <CardContent className="text-center py-12">
                    <p className="text-[#64748B]">No tasks with dates to display</p>
                    <p className="text-[#64748B] text-sm mt-2">Add start and due dates to your tasks to see them in the timeline</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card className="bg-[#0F0F1A] border-[rgba(244,246,255,0.1)]">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                        Timeline View
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {onTaskCreate && (
                            <button 
                                className="px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm"
                                onClick={() => setShowAddModal(true)}
                            >
                                <Plus className="w-4 h-4" />
                                Add Task
                            </button>
                        )}
                        <div className="w-px h-6 bg-gray-600 mx-2" />
                        <button 
                            className="px-3 py-1.5 rounded-md border border-gray-600 text-white bg-transparent hover:bg-gray-700 transition-colors"
                            onClick={() => setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000))}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button 
                            className="px-3 py-1.5 rounded-md border border-gray-600 text-white bg-transparent hover:bg-gray-700 transition-colors"
                            onClick={() => setCurrentDate(new Date())}
                        >
                            Today
                        </button>
                        <button 
                            className="px-3 py-1.5 rounded-md border border-gray-600 text-white bg-transparent hover:bg-gray-700 transition-colors"
                            onClick={() => setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000))}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <div className="w-px h-6 bg-gray-600 mx-2" />
                        <button 
                            className="px-3 py-1.5 rounded-md border border-gray-600 text-white bg-transparent hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={handleZoomIn} 
                            disabled={viewMode === ViewMode.Day}
                        >
                            <ZoomIn className="w-4 h-4" />
                        </button>
                        <button 
                            className="px-3 py-1.5 rounded-md border border-gray-600 text-white bg-transparent hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={handleZoomOut} 
                            disabled={viewMode === ViewMode.Month}
                        >
                            <ZoomOut className="w-4 h-4" />
                        </button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Custom Week Labels */}
                    <div className="mb-3 flex gap-2 overflow-x-auto pb-2">
                        {tasks.length > 0 && (() => {
                            // Find date range
                            const dates = tasks.flatMap(t => [t.start, t.end]);
                            const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
                            const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
                            
                            // Generate week labels
                            const labels = [];
                            let currentWeekStart = new Date(projectStart);
                            let weekNum = 1;
                            
                            while (currentWeekStart <= maxDate) {
                                const weekEnd = new Date(currentWeekStart);
                                weekEnd.setDate(weekEnd.getDate() + 6);
                                
                                // Only show if within visible range
                                if (weekEnd >= minDate) {
                                    labels.push({
                                        week: weekNum,
                                        start: new Date(currentWeekStart),
                                        end: new Date(weekEnd)
                                    });
                                }
                                
                                currentWeekStart.setDate(currentWeekStart.getDate() + 7);
                                weekNum++;
                            }
                            
                            return labels.map(({ week, start }) => (
                                <div 
                                    key={week}
                                    className="flex-shrink-0 px-3 py-2 rounded-md bg-[#1A1A2E] text-center min-w-[100px]"
                                >
                                    <div className="text-white font-medium text-sm">W{week}</div>
                                    <div className="text-[#64748B] text-xs">
                                        {start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                    
                    <style>{`
                        .gantt-task-react-root {
                            font-family: inherit;
                            overflow-x: auto;
                        }
                        .gantt-task-react-root svg {
                            background: #0F0F1A !important;
                        }
                        .gantt-task-react-root .grid-row-line {
                            stroke: rgba(244,246,255,0.06) !important;
                        }
                        .gantt-task-react-root .grid-tick-line {
                            stroke: rgba(244,246,255,0.06) !important;
                        }
                        .gantt-task-react-root .calendar-top {
                            fill: #1A1A2E !important;
                            font-weight: 600;
                            font-size: 13px;
                        }
                        .gantt-task-react-root .calendar-bottom {
                            fill: #64748B !important;
                            font-size: 11px;
                        }
                        .gantt-task-react-root .calendar-top text,
                        .gantt-task-react-root .calendar-bottom text {
                            fill: white !important;
                        }
                        .gantt-task-react-root .today-highlight {
                            fill: rgba(99, 102, 241, 0.12) !important;
                        }
                        .gantt-task-react-root rect[fill="white"],
                        .gantt-task-react-root rect[fill="#fff"],
                        .gantt-task-react-root rect[fill="#ffffff"] {
                            fill: #0F0F1A !important;
                        }
                        .gantt-task-react-root .bar-wrapper {
                            cursor: grab;
                        }
                        .gantt-task-react-root .bar-wrapper:active {
                            cursor: grabbing;
                        }
                        .gantt-task-react-root .bar-wrapper:hover rect {
                            filter: brightness(1.15);
                        }
                        .gantt-task-react-root .bar-label {
                            fill: white !important;
                            font-size: 11px;
                        }
                        .gantt-task-react-root .handleGroup {
                            cursor: ew-resize;
                        }
                    `}</style>
                    <div className="rounded-lg overflow-hidden bg-[#0F0F1A]">
                        <Gantt
                            tasks={tasks}
                            {...displayOptions}
                            onClick={handleClick}
                            onDateChange={handleDateChange}
                            TooltipContent={({ task }: { task: Task }) => (
                                <div className="bg-[#1A1A2E] p-3 rounded-lg shadow-xl border border-[rgba(244,246,255,0.1)]">
                                    <p className="text-white font-medium">{task.name}</p>
                                    <p className="text-[#64748B] text-sm">
                                        {task.start.toLocaleDateString()} - {task.end.toLocaleDateString()}
                                    </p>
                                    <p className="text-[#64748B] text-sm">
                                        Progress: {task.progress}%
                                    </p>
                                    <p className="text-indigo-400 text-xs mt-1">
                                        Drag edges to adjust dates
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

            {/* Add Task Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[#1A1A2E] rounded-lg p-6 w-full max-w-md border border-[rgba(244,246,255,0.1)]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white text-lg font-semibold">Add New Task</h3>
                            <button 
                                className="text-gray-400 hover:text-white"
                                onClick={() => setShowAddModal(false)}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Title *</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-[#0F0F1A] border border-gray-600 rounded-md text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="Enter task title"
                                    value={newTask.title}
                                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 bg-[#0F0F1A] border border-gray-600 rounded-md text-white focus:outline-none focus:border-indigo-500"
                                        value={newTask.start_date}
                                        onChange={(e) => setNewTask({ ...newTask, start_date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Due Date</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 bg-[#0F0F1A] border border-gray-600 rounded-md text-white focus:outline-none focus:border-indigo-500"
                                        value={newTask.due_date}
                                        onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Estimated Hours</label>
                                <input
                                    type="number"
                                    className="w-full px-3 py-2 bg-[#0F0F1A] border border-gray-600 rounded-md text-white focus:outline-none focus:border-indigo-500"
                                    value={newTask.estimated_hours}
                                    onChange={(e) => setNewTask({ ...newTask, estimated_hours: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Assignee</label>
                                <select
                                    className="w-full px-3 py-2 bg-[#0F0F1A] border border-gray-600 rounded-md text-white focus:outline-none focus:border-indigo-500"
                                    value={newTask.assignee_id || ''}
                                    onChange={(e) => setNewTask({ ...newTask, assignee_id: e.target.value ? parseInt(e.target.value) : undefined })}
                                >
                                    <option value="">Unassigned</option>
                                    {developers.map(dev => (
                                        <option key={dev.id} value={dev.id}>{dev.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                className="px-4 py-2 rounded-md border border-gray-600 text-white hover:bg-gray-700 transition-colors"
                                onClick={() => setShowAddModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                onClick={handleAddTask}
                                disabled={!newTask.title.trim()}
                            >
                                Add Task
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default TimelineView;
