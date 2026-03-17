import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Plus, X, BookOpen, ClipboardList, Bug, Target } from 'lucide-react';

interface WorkItem {
    id: string;
    key: string;
    title: string;
    description?: string;
    status: string;
    priority?: string;
    type?: string;
    start_date?: string;
    due_date?: string;
    estimated_hours?: number;
    logged_hours?: number;
    story_points?: number;
    assignee?: string;
    assignee_id?: number;
    sprint?: string;
    acceptance_criteria?: string;
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

type ZoomLevel = 'day' | 'week' | 'month';

/** Parse a date string into local midnight — timezone-safe */
function parseLocalDate(str: string): Date {
    const clean = str.endsWith('Z') ? str.slice(0, -1) : str;
    const datePart = clean.includes('T') ? clean.split('T')[0] : clean;
    const [year, month, day] = datePart.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/** Add days to a date, returns new Date */
function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

/** Format date as "Mar 15" */
function fmtShort(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Format date as "March 2026" */
function fmtMonth(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** Get column width in px based on zoom level */
function colWidth(zoom: ZoomLevel): number {
    if (zoom === 'day') return 40;
    if (zoom === 'week') return 120;
    return 160; // month
}

/** Get step in days for each column based on zoom */
function colDays(zoom: ZoomLevel): number {
    if (zoom === 'day') return 1;
    if (zoom === 'week') return 7;
    return 30;
}

/** Number of columns to render on each side of the viewport for infinite scroll */
const BUFFER_COLS = 30;
/** Row height in px */
const ROW_HEIGHT = 44;
/** Left label width in px */
const LABEL_WIDTH = 200;

interface GanttRow {
    id: string;
    label: string;
    start: Date;
    end: Date;
    color: string;
    type: 'task' | 'milestone' | 'goal';
    progress: number;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string; bg: string }> = {
    user_story: { icon: BookOpen, color: '#6366F1', label: 'Story', bg: 'rgba(99,102,241,0.15)' },
    task: { icon: ClipboardList, color: '#F59E0B', label: 'Task', bg: 'rgba(245,158,11,0.15)' },
    bug: { icon: Bug, color: '#EF4444', label: 'Bug', bg: 'rgba(239,68,68,0.15)' },
    epic: { icon: Target, color: '#8B5CF6', label: 'Epic', bg: 'rgba(139,92,246,0.15)' },
};

const getPriorityColor = (priority?: string) => {
    if (priority === 'high' || priority === 'critical') return 'border-[#EF4444]/50 text-[#EF4444]';
    if (priority === 'medium') return 'border-[#F59E0B]/50 text-[#F59E0B]';
    return 'border-[#64748B]/50 text-[#64748B]';
};

const STATUS_COLOR: Record<string, string> = {
    done: '#10B981',
    in_progress: '#F59E0B',
    in_review: '#8B5CF6',
    todo: '#64748B',
};

const TimelineView: React.FC<TimelineViewProps> = ({
    workItems,
    milestones = [],
    goals = [],
    projectStartDate: _projectStartDate,
    projectId: _projectId,
    developers = [],
    onTaskClick,
    onTaskUpdate: _onTaskUpdate,
    onTaskCreate
}) => {
    const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
    const [zoom, setZoom] = useState<ZoomLevel>('week');
    const [viewStart, setViewStart] = useState<Date>(() => {
        // Start view at today minus 2 columns so there's context
        const d = new Date();
        d.setDate(d.getDate() - colDays('week') * 2);
        return d;
    });
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTask, setNewTask] = useState({
        title: '',
        start_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        estimated_hours: 8,
        assignee_id: undefined as number | undefined
    });

    const scrollRef = useRef<HTMLDivElement>(null);

    // Build rows from workItems, milestones, goals
    const rows: GanttRow[] = useMemo(() => {
        const taskRows: GanttRow[] = workItems
            .filter(item => item.start_date || item.due_date)
            .map(item => {
                const start = parseLocalDate((item.start_date || item.due_date)!);
                const end = parseLocalDate((item.due_date || item.start_date)!);
                const isOverdue = item.due_date && parseLocalDate(item.due_date) < new Date() && item.status !== 'done';
                const color = isOverdue ? '#EF4444' : (STATUS_COLOR[item.status] || '#6366F1');
                return {
                    id: item.id,
                    label: `${item.key}: ${item.title}`,
                    start,
                    end: end < start ? start : end,
                    color,
                    type: 'task' as const,
                    progress: item.status === 'done' ? 100 : item.status === 'in_progress' ? 50 : 0,
                };
            });

        const milestoneRows: GanttRow[] = milestones
            .filter(m => m.due_date)
            .map(m => {
                const due = parseLocalDate(m.due_date!);
                return {
                    id: `milestone-${m.id}`,
                    label: `🎯 ${m.title}`,
                    start: due,
                    end: due,
                    color: m.completed_at ? '#10B981' : '#EC4899',
                    type: 'milestone' as const,
                    progress: m.completed_at ? 100 : 0,
                };
            });

        const goalRows: GanttRow[] = goals
            .filter(g => g.due_date)
            .map(g => {
                const due = parseLocalDate(g.due_date!);
                return {
                    id: `goal-${g.id}`,
                    label: `⭐ ${g.title}`,
                    start: due,
                    end: due,
                    color: g.status === 'completed' ? '#10B981' : '#F59E0B',
                    type: 'goal' as const,
                    progress: g.status === 'completed' ? 100 : (g.progress || 0),
                };
            });

        return [...taskRows, ...milestoneRows, ...goalRows];
    }, [workItems, milestones, goals]);

    // Total visible columns = viewport width / colWidth, plus buffer on both sides
    const TOTAL_COLS = BUFFER_COLS * 2 + 60; // render 60 cols visible + buffer

    // Column headers: each column = one colDays(zoom) unit starting from viewStart - BUFFER_COLS*colDays
    const gridStart = useMemo(() => addDays(viewStart, -BUFFER_COLS * colDays(zoom)), [viewStart, zoom]);

    const columns = useMemo(() => {
        return Array.from({ length: TOTAL_COLS }, (_, i) => {
            const date = addDays(gridStart, i * colDays(zoom));
            return date;
        });
    }, [gridStart, zoom, TOTAL_COLS]);

    const cw = colWidth(zoom);
    const totalWidth = TOTAL_COLS * cw;

    // Convert a date to X pixel offset within the grid
    const dateToX = useCallback((date: Date): number => {
        const diffMs = date.getTime() - gridStart.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return (diffDays / colDays(zoom)) * cw;
    }, [gridStart, zoom, cw]);

    // Scroll to viewStart on mount and when viewStart/zoom changes
    useEffect(() => {
        if (!scrollRef.current) return;
        // Scroll so that viewStart is at the left edge
        const x = BUFFER_COLS * cw;
        scrollRef.current.scrollLeft = x;
    }, [viewStart, zoom, cw]);

    // Navigate: move viewStart forward/backward
    const navigateBy = (direction: 1 | -1) => {
        const step = colDays(zoom) * 4; // move 4 columns at a time
        setViewStart(prev => addDays(prev, direction * step));
    };

    const goToToday = () => {
        const d = new Date();
        d.setDate(d.getDate() - colDays(zoom) * 2);
        setViewStart(d);
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayX = dateToX(today);

    // Month label groups for header top row
    const monthGroups = useMemo(() => {
        const groups: { label: string; x: number; width: number }[] = [];
        let currentMonth = '';
        let groupStart = 0;
        columns.forEach((date, i) => {
            const label = fmtMonth(date);
            if (label !== currentMonth) {
                if (currentMonth) {
                    groups.push({ label: currentMonth, x: groupStart, width: i * cw - groupStart });
                }
                currentMonth = label;
                groupStart = i * cw;
            }
        });
        if (currentMonth) {
            groups.push({ label: currentMonth, x: groupStart, width: totalWidth - groupStart });
        }
        return groups;
    }, [columns, cw, totalWidth]);

    const headerHeight = 56; // px for 2-row header
    const chartHeight = Math.max(rows.length * ROW_HEIGHT + 20, 200);

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
                        <div className="w-px h-6 bg-gray-600 mx-1" />
                        <button
                            className="px-3 py-1.5 rounded-md border border-gray-600 text-white bg-transparent hover:bg-gray-700 transition-colors"
                            onClick={() => navigateBy(-1)}
                            title="Previous"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            className="px-3 py-1.5 rounded-md border border-gray-600 text-white bg-transparent hover:bg-gray-700 transition-colors text-sm"
                            onClick={goToToday}
                        >
                            Today
                        </button>
                        <button
                            className="px-3 py-1.5 rounded-md border border-gray-600 text-white bg-transparent hover:bg-gray-700 transition-colors"
                            onClick={() => navigateBy(1)}
                            title="Next"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <div className="w-px h-6 bg-gray-600 mx-1" />
                        <button
                            className="px-3 py-1.5 rounded-md border border-gray-600 text-white bg-transparent hover:bg-gray-700 transition-colors disabled:opacity-40"
                            onClick={() => setZoom(z => z === 'month' ? 'week' : z === 'week' ? 'day' : 'day')}
                            disabled={zoom === 'day'}
                            title="Zoom In"
                        >
                            <ZoomIn className="w-4 h-4" />
                        </button>
                        <button
                            className="px-3 py-1.5 rounded-md border border-gray-600 text-white bg-transparent hover:bg-gray-700 transition-colors disabled:opacity-40"
                            onClick={() => setZoom(z => z === 'day' ? 'week' : z === 'week' ? 'month' : 'month')}
                            disabled={zoom === 'month'}
                            title="Zoom Out"
                        >
                            <ZoomOut className="w-4 h-4" />
                        </button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="flex" style={{ height: headerHeight + chartHeight }}>
                        {/* Left labels panel */}
                        <div
                            className="flex-shrink-0 bg-[#0F0F1A] border-r border-[rgba(244,246,255,0.1)] z-10"
                            style={{ width: LABEL_WIDTH }}
                        >
                            {/* Header spacer */}
                            <div style={{ height: headerHeight }} className="border-b border-[rgba(244,246,255,0.1)]" />
                            {/* Row labels */}
                            {rows.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-[#64748B] text-sm px-4 text-center">
                                    No tasks with dates.<br />Add dates to see the timeline.
                                </div>
                            ) : (
                                rows.map((row) => (
                                    <div
                                        key={row.id}
                                        className="flex items-center px-3 text-sm truncate cursor-pointer hover:bg-[#1A1A2E] transition-colors"
                                        style={{ height: ROW_HEIGHT, borderBottom: '1px solid rgba(244,246,255,0.04)' }}
                                        onClick={() => {
                                            if (row.type === 'task') {
                                                const item = workItems.find(w => w.id === row.id);
                                                if (item) { setSelectedItem(item); onTaskClick?.(item); }
                                            }
                                        }}
                                        title={row.label}
                                    >
                                        <div
                                            className="w-2 h-2 rounded-full flex-shrink-0 mr-2"
                                            style={{ backgroundColor: row.color }}
                                        />
                                        <span className="text-[#CBD5E1] truncate text-xs">{row.label}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Scrollable gantt area */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-x-auto overflow-y-hidden relative"
                            style={{ scrollBehavior: 'smooth' }}
                        >
                            <div style={{ width: totalWidth, position: 'relative' }}>
                                {/* Header: month row + date/week row */}
                                <div
                                    className="sticky top-0 z-20 bg-[#0F0F1A] border-b border-[rgba(244,246,255,0.1)]"
                                    style={{ height: headerHeight }}
                                >
                                    {/* Month labels */}
                                    <div style={{ height: 24, position: 'relative', borderBottom: '1px solid rgba(244,246,255,0.05)' }}>
                                        {monthGroups.map((g, i) => (
                                            <div
                                                key={i}
                                                className="absolute top-0 text-xs font-semibold text-white px-2 flex items-center overflow-hidden"
                                                style={{ left: g.x, width: g.width, height: 24 }}
                                            >
                                                {g.label}
                                            </div>
                                        ))}
                                    </div>
                                    {/* Date/Week labels */}
                                    <div style={{ height: 32, position: 'relative' }}>
                                        {columns.map((date, i) => {
                                            const isToday = date.toDateString() === today.toDateString();
                                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                            return (
                                                <div
                                                    key={i}
                                                    className={`absolute top-0 flex items-center justify-center text-xs border-r border-[rgba(244,246,255,0.04)] ${isToday ? 'text-indigo-400 font-bold' : isWeekend ? 'text-[#4B5563]' : 'text-[#94A3B8]'}`}
                                                    style={{ left: i * cw, width: cw, height: 32 }}
                                                >
                                                    {zoom === 'day'
                                                        ? date.getDate()
                                                        : zoom === 'week'
                                                            ? fmtShort(date)
                                                            : date.toLocaleDateString('en-US', { month: 'short' })
                                                    }
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Grid + bars */}
                                <div style={{ height: chartHeight, position: 'relative' }}>
                                    {/* Vertical grid lines */}
                                    {columns.map((date, i) => {
                                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                        return (
                                            <div
                                                key={i}
                                                style={{
                                                    position: 'absolute',
                                                    left: i * cw,
                                                    top: 0,
                                                    width: cw,
                                                    height: chartHeight,
                                                    backgroundColor: isWeekend ? 'rgba(244,246,255,0.015)' : 'transparent',
                                                    borderRight: '1px solid rgba(244,246,255,0.04)',
                                                }}
                                            />
                                        );
                                    })}

                                    {/* Today highlight */}
                                    {todayX >= 0 && todayX <= totalWidth && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                left: todayX,
                                                top: 0,
                                                width: cw,
                                                height: chartHeight,
                                                backgroundColor: 'rgba(99,102,241,0.08)',
                                                borderLeft: '2px solid rgba(99,102,241,0.6)',
                                                pointerEvents: 'none',
                                            }}
                                        />
                                    )}

                                    {/* Horizontal row lines */}
                                    {rows.map((_, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: i * ROW_HEIGHT,
                                                width: totalWidth,
                                                height: ROW_HEIGHT,
                                                borderBottom: '1px solid rgba(244,246,255,0.04)',
                                            }}
                                        />
                                    ))}

                                    {/* Task bars */}
                                    {rows.map((row, i) => {
                                        const x1 = dateToX(row.start);
                                        // For milestones/goals (same start=end), show diamond; add 1 colDays width minimum
                                        const isMilestone = row.type !== 'task';
                                        const endDate = isMilestone ? addDays(row.end, colDays(zoom)) : addDays(row.end, 1);
                                        const x2 = dateToX(endDate);
                                        const barWidth = Math.max(isMilestone ? cw * 0.6 : 4, x2 - x1);
                                        const barTop = i * ROW_HEIGHT + 8;
                                        const barHeight = ROW_HEIGHT - 16;

                                        return (
                                            <div
                                                key={row.id}
                                                style={{
                                                    position: 'absolute',
                                                    left: x1,
                                                    top: barTop,
                                                    width: barWidth,
                                                    height: barHeight,
                                                    backgroundColor: row.color,
                                                    borderRadius: isMilestone ? '50%' : 4,
                                                    opacity: 0.9,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    overflow: 'hidden',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                                }}
                                                onClick={() => {
                                                    if (row.type === 'task') {
                                                        const item = workItems.find(w => w.id === row.id);
                                                        if (item) { setSelectedItem(item); onTaskClick?.(item); }
                                                    }
                                                }}
                                                title={`${row.label}\n${fmtShort(row.start)} → ${fmtShort(row.end)}`}
                                            >
                                                {/* Progress fill */}
                                                {row.progress > 0 && (
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            left: 0,
                                                            top: 0,
                                                            width: `${row.progress}%`,
                                                            height: '100%',
                                                            backgroundColor: 'rgba(255,255,255,0.15)',
                                                            borderRadius: 4,
                                                        }}
                                                    />
                                                )}
                                                {/* Label inside bar */}
                                                {barWidth > 60 && (
                                                    <span
                                                        style={{
                                                            fontSize: 10,
                                                            color: 'white',
                                                            paddingLeft: 6,
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            position: 'relative',
                                                            zIndex: 1,
                                                        }}
                                                    >
                                                        {row.label}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 px-4 py-3 border-t border-[rgba(244,246,255,0.06)] text-xs">
                        {[
                            { color: '#10B981', label: 'Done' },
                            { color: '#F59E0B', label: 'In Progress' },
                            { color: '#8B5CF6', label: 'In Review' },
                            { color: '#64748B', label: 'To Do' },
                            { color: '#EF4444', label: 'Overdue' },
                            { color: '#EC4899', label: 'Milestone' },
                            { color: '#F59E0B', label: 'Goal' },
                        ].map(({ color, label }) => (
                            <div key={label} className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                                <span className="text-[#64748B]">{label}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Ticket Detail Slide-in Panel */}
            {selectedItem && (
                <>
                    <div
                        className="fixed inset-0 bg-black/40 z-40"
                        onClick={() => setSelectedItem(null)}
                    />
                    <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-[#0B0D14] border-l border-[rgba(244,246,255,0.08)] z-50 flex flex-col shadow-2xl shadow-black/50 overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-start justify-between p-5 border-b border-[rgba(244,246,255,0.06)] sticky top-0 bg-[#0B0D14]">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                {(() => {
                                    const ti = TYPE_CONFIG[selectedItem.type || 'task'] || TYPE_CONFIG.task;
                                    return (
                                        <div
                                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium flex-shrink-0"
                                            style={{ backgroundColor: ti.bg, color: ti.color }}
                                        >
                                            <ti.icon className="w-4 h-4" />
                                            {ti.label}
                                        </div>
                                    );
                                })()}
                                <span className="text-xs font-mono text-[#6366F1]">{selectedItem.key}</span>
                            </div>
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="p-1.5 rounded-lg hover:bg-[rgba(244,246,255,0.05)] text-[#475569] hover:text-white flex-shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-5">
                            <h2 className="text-lg font-semibold text-white leading-tight">
                                {selectedItem.title}
                            </h2>

                            {/* Status + Priority */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="border-[rgba(244,246,255,0.1)] text-[#94A3B8] capitalize">
                                    {selectedItem.status.replace(/_/g, ' ')}
                                </Badge>
                                {selectedItem.priority && (
                                    <Badge variant="outline" className={getPriorityColor(selectedItem.priority)}>
                                        {selectedItem.priority}
                                    </Badge>
                                )}
                            </div>

                            {/* Description */}
                            {selectedItem.description && (
                                <div>
                                    <p className="text-xs font-medium text-[#64748B] mb-2">Description</p>
                                    <p className="text-sm text-[#E2E8F0] leading-relaxed bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-xl p-4">
                                        {selectedItem.description}
                                    </p>
                                </div>
                            )}

                            {/* Acceptance Criteria */}
                            {selectedItem.acceptance_criteria && (
                                <div>
                                    <p className="text-xs font-medium text-[#64748B] mb-2">Acceptance Criteria</p>
                                    <p className="text-sm text-[#E2E8F0] leading-relaxed bg-[rgba(244,246,255,0.02)] border border-[rgba(244,246,255,0.06)] rounded-xl p-4">
                                        {selectedItem.acceptance_criteria}
                                    </p>
                                </div>
                            )}

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Assignee', value: selectedItem.assignee || 'Unassigned' },
                                    { label: 'Sprint', value: selectedItem.sprint || 'Backlog' },
                                    { label: 'Story Points', value: selectedItem.story_points ?? '-' },
                                    { label: 'Est. Hours', value: selectedItem.estimated_hours ? `${selectedItem.estimated_hours}h` : '-' },
                                    { label: 'Logged Hours', value: selectedItem.logged_hours ? `${selectedItem.logged_hours}h` : '0h' },
                                    {
                                        label: 'Start Date',
                                        value: selectedItem.start_date
                                            ? new Date(selectedItem.start_date).toLocaleDateString()
                                            : 'Not set',
                                    },
                                    {
                                        label: 'Due Date',
                                        value: selectedItem.due_date
                                            ? new Date(selectedItem.due_date).toLocaleDateString()
                                            : 'Not set',
                                    },
                                ].map(({ label, value }) => (
                                    <div key={label} className="bg-[rgba(244,246,255,0.03)] rounded-xl p-3">
                                        <p className="text-xs text-[#64748B] mb-1">{label}</p>
                                        <p className="text-sm font-medium text-white">{value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Add Task Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[#1A1A2E] rounded-lg p-6 w-full max-w-md border border-[rgba(244,246,255,0.1)]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white text-lg font-semibold">Add New Task</h3>
                            <button className="text-gray-400 hover:text-white" onClick={() => setShowAddModal(false)}>
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
