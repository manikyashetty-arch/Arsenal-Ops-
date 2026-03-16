import React, { useState, useMemo } from 'react';
import { Calendar, Views, dateFnsLocalizer, Navigate } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface WorkItem {
    id: string;
    key: string;
    title: string;
    status: string;
    priority: string;
    due_date?: string;
    start_date?: string;
    assignee?: string;
}

interface Milestone {
    id: number;
    title: string;
    due_date?: string;
    completed_at?: string;
    is_completed?: boolean;
}

interface Goal {
    id: number;
    title: string;
    due_date?: string;
    status: string;
    progress: number;
}

interface CalendarViewProps {
    workItems: WorkItem[];
    milestones?: Milestone[];
    goals?: Goal[];
    onTaskClick?: (item: WorkItem) => void;
    onMilestoneClick?: (milestone: Milestone) => void;
}

interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    resource: any;
}

const locales = {
    'en-US': enUS,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

const CalendarView: React.FC<CalendarViewProps> = ({ workItems, milestones = [], goals = [], onTaskClick }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<typeof Views[keyof typeof Views]>(Views.MONTH);

    const events: CalendarEvent[] = useMemo(() => {
        const taskEvents = workItems
            .filter(item => item.due_date || item.start_date)
            .map(item => {
                // Parse dates and ensure they're in local timezone for display
                const startStr = item.start_date || item.due_date;
                const endStr = item.due_date || item.start_date;
                
                // Create dates from ISO strings - they will be in local timezone
                let startDate = startStr ? new Date(startStr) : new Date();
                let endDate = endStr ? new Date(endStr) : new Date(startDate);
                
                // Adjust for weekends - tasks don't happen on weekends
                // Only adjust if the date actually falls on a weekend
                const startDay = startDate.getDay();
                const endDay = endDate.getDay();
                
                if (startDay === 0) { // Sunday -> Monday
                    startDate.setDate(startDate.getDate() + 1);
                } else if (startDay === 6) { // Saturday -> Monday
                    startDate.setDate(startDate.getDate() + 2);
                }
                
                if (endDay === 0) { // Sunday -> Friday
                    endDate.setDate(endDate.getDate() - 2);
                } else if (endDay === 6) { // Saturday -> Friday
                    endDate.setDate(endDate.getDate() - 1);
                }
                
                // Ensure end date is not before start date after adjustment
                if (endDate < startDate) {
                    endDate = new Date(startDate);
                }
                
                return {
                    id: item.id,
                    title: `${item.key}: ${item.title}`,
                    start: startDate,
                    end: endDate,
                    resource: { ...item, type: 'task' },
                };
            });
        
        const milestoneEvents = milestones
            .filter(m => m.due_date)
            .map(m => {
                const dueDate = new Date(m.due_date!);
                // Adjust if falls on weekend
                const day = dueDate.getDay();
                if (day === 0) dueDate.setDate(dueDate.getDate() - 2); // Sunday -> Friday
                else if (day === 6) dueDate.setDate(dueDate.getDate() - 1); // Saturday -> Friday
                
                return {
                    id: `milestone-${m.id}`,
                    title: `🎯 ${m.title}`,
                    start: dueDate,
                    end: dueDate,
                    resource: { ...m, type: 'milestone' },
                };
            });
        
        const goalEvents = goals
            .filter(g => g.due_date)
            .map(g => {
                const dueDate = new Date(g.due_date!);
                // Adjust if falls on weekend
                const day = dueDate.getDay();
                if (day === 0) dueDate.setDate(dueDate.getDate() - 2); // Sunday -> Friday
                else if (day === 6) dueDate.setDate(dueDate.getDate() - 1); // Saturday -> Friday
                
                return {
                    id: `goal-${g.id}`,
                    title: `⭐ ${g.title}`,
                    start: dueDate,
                    end: dueDate,
                    resource: { ...g, type: 'goal' },
                };
            });
        
        return [...taskEvents, ...milestoneEvents, ...goalEvents];
    }, [workItems, milestones, goals]);

    const handleNavigate = (newDate: Date) => {
        setCurrentDate(newDate);
    };

    const handleSelectEvent = (event: CalendarEvent) => {
        if (onTaskClick) {
            onTaskClick(event.resource);
        }
    };

    const eventStyleGetter = (event: CalendarEvent) => {
        const item = event.resource;
        let backgroundColor = '#6366F1';
        
        switch (item.status) {
            case 'done':
                backgroundColor = '#10B981';
                break;
            case 'in_progress':
                backgroundColor = '#F59E0B';
                break;
            case 'in_review':
                backgroundColor = '#8B5CF6';
                break;
            case 'todo':
                backgroundColor = '#64748B';
                break;
        }

        // Check if overdue
        const isOverdue = item.due_date && new Date(item.due_date) < new Date() && item.status !== 'done';
        if (isOverdue) {
            backgroundColor = '#EF4444';
        }

        return {
            style: {
                backgroundColor,
                borderRadius: '4px',
                opacity: 0.9,
                color: 'white',
                border: 'none',
                display: 'block',
                fontSize: '12px',
                padding: '2px 6px',
            },
        };
    };



    const CustomToolbar = ({ onNavigate, label }: { onNavigate: (action: typeof Navigate.PREVIOUS | typeof Navigate.NEXT | typeof Navigate.TODAY) => void; label: string }) => (
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                <button 
                    className="px-3 py-1.5 rounded-md border border-gray-600 text-white bg-transparent hover:bg-gray-700 transition-colors"
                    onClick={() => onNavigate(Navigate.PREVIOUS as any)}
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                    className="px-3 py-1.5 rounded-md border border-gray-600 text-white bg-transparent hover:bg-gray-700 transition-colors"
                    onClick={() => onNavigate(Navigate.TODAY as any)}
                >
                    Today
                </button>
                <button 
                    className="px-3 py-1.5 rounded-md border border-gray-600 text-white bg-transparent hover:bg-gray-700 transition-colors"
                    onClick={() => onNavigate(Navigate.NEXT as any)}
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
            <span className="text-white font-medium text-lg">{label}</span>
            <div className="flex items-center gap-2">
                <button
                    className={`px-3 py-1.5 rounded-md transition-colors ${view === Views.MONTH ? 'bg-indigo-600 text-white' : 'border border-gray-600 text-white bg-transparent hover:bg-gray-700'}`}
                    onClick={() => setView(Views.MONTH)}
                >
                    Month
                </button>
                <button
                    className={`px-3 py-1.5 rounded-md transition-colors ${view === Views.WEEK ? 'bg-indigo-600 text-white' : 'border border-gray-600 text-white bg-transparent hover:bg-gray-700'}`}
                    onClick={() => setView(Views.WEEK)}
                >
                    Week
                </button>
            </div>
        </div>
    );

    return (
        <Card className="bg-[#0F0F1A] border-[rgba(244,246,255,0.1)]">
            <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                    Calendar View
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="calendar-container" style={{ height: '500px' }}>
                    <style>{`
                        .rbc-calendar {
                            background-color: #0F0F1A;
                            color: white;
                        }
                        .rbc-header {
                            background-color: #1A1A2E;
                            color: white;
                            border-color: rgba(244,246,255,0.1) !important;
                            padding: 8px;
                        }
                        .rbc-month-view, .rbc-time-view {
                            border-color: rgba(244,246,255,0.1) !important;
                            background-color: #0F0F1A;
                        }
                        .rbc-month-row {
                            border-color: rgba(244,246,255,0.1) !important;
                        }
                        .rbc-day-bg {
                            background-color: #0F0F1A;
                            border-color: rgba(244,246,255,0.1) !important;
                        }
                        .rbc-day-bg + .rbc-day-bg {
                            border-left: 1px solid rgba(244,246,255,0.1);
                        }
                        .rbc-off-range-bg {
                            background-color: #0A0A14;
                        }
                        .rbc-today {
                            background-color: rgba(99, 102, 241, 0.2) !important;
                        }
                        .rbc-button-link {
                            color: white;
                        }
                        .rbc-show-more {
                            color: #6366F1;
                            background: transparent;
                        }
                        .rbc-date-cell {
                            color: white;
                            padding: 4px 8px;
                        }
                        .rbc-date-cell.rbc-off-range {
                            color: #4B5563;
                        }
                        .rbc-row-segment {
                            padding: 0 2px;
                        }
                        .rbc-event {
                            border: none !important;
                        }
                        .rbc-row-content {
                            z-index: 1;
                        }
                        .rbc-time-header-content {
                            border-color: rgba(244,246,255,0.1) !important;
                        }
                        .rbc-time-content {
                            background-color: #0F0F1A;
                            border-color: rgba(244,246,255,0.1) !important;
                        }
                        .rbc-time-slot {
                            border-color: rgba(244,246,255,0.1) !important;
                        }
                        .rbc-timeslot-group {
                            border-color: rgba(244,246,255,0.1) !important;
                        }
                        .rbc-label {
                            color: #9CA3AF;
                        }
                        .rbc-allday-cell {
                            background-color: #0F0F1A;
                        }
                        /* Dim weekend columns */
                        .rbc-month-view .rbc-month-row .rbc-day-bg:first-child,
                        .rbc-month-view .rbc-month-row .rbc-day-bg:last-child {
                            background-color: rgba(244,246,255,0.03);
                        }
                    `}</style>
                    <Calendar
                        localizer={localizer}
                        events={events}
                        startAccessor="start"
                        endAccessor="end"
                        view={view}
                        onView={(newView: any) => setView(newView)}
                        date={currentDate}
                        onNavigate={handleNavigate}
                        onSelectEvent={handleSelectEvent}
                        eventPropGetter={eventStyleGetter}
                        components={{
                            toolbar: CustomToolbar as any,
                        }}
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
                        <div className="w-3 h-3 rounded bg-[#EF4444]" />
                        <span className="text-[#64748B]">Overdue</span>
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

export default CalendarView;
