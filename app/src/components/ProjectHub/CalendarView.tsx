import React, { useState, useMemo } from 'react';
import { Calendar, Views, dateFnsLocalizer, Navigate } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

interface CalendarViewProps {
    workItems: WorkItem[];
    milestones?: Milestone[];
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

const CalendarView: React.FC<CalendarViewProps> = ({ workItems, milestones = [], onTaskClick }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<typeof Views[keyof typeof Views]>(Views.MONTH);

    const events: CalendarEvent[] = useMemo(() => {
        const taskEvents = workItems
            .filter(item => item.due_date || item.start_date)
            .map(item => {
                const startDate = item.start_date ? new Date(item.start_date) : new Date(item.due_date!);
                const endDate = item.due_date ? new Date(item.due_date) : startDate;
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
                return {
                    id: `milestone-${m.id}`,
                    title: `🎯 ${m.title}`,
                    start: dueDate,
                    end: dueDate,
                    resource: { ...m, type: 'milestone' },
                };
            });
        
        return [...taskEvents, ...milestoneEvents];
    }, [workItems, milestones]);

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
                <Button variant="outline" size="sm" onClick={() => onNavigate(Navigate.PREVIOUS as any)}>
                    <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => onNavigate(Navigate.TODAY as any)}>
                    Today
                </Button>
                <Button variant="outline" size="sm" onClick={() => onNavigate(Navigate.NEXT as any)}>
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
            <span className="text-white font-medium text-lg">{label}</span>
            <div className="flex items-center gap-2">
                <Button
                    variant={view === Views.MONTH ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setView(Views.MONTH)}
                >
                    Month
                </Button>
                <Button
                    variant={view === Views.WEEK ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setView(Views.WEEK)}
                >
                    Week
                </Button>
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
                            border-color: rgba(244,246,255,0.1);
                        }
                        .rbc-month-view, .rbc-time-view {
                            border-color: rgba(244,246,255,0.1);
                        }
                        .rbc-day-bg {
                            background-color: #0F0F1A;
                        }
                        .rbc-off-range-bg {
                            background-color: #0A0A14;
                        }
                        .rbc-today {
                            background-color: rgba(99, 102, 241, 0.2);
                        }
                        .rbc-button-link {
                            color: white;
                        }
                        .rbc-show-more {
                            color: #6366F1;
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
