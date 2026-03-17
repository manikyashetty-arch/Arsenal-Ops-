import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronUp, ChevronDown, Search, CheckCircle2, Clock, AlertCircle, Circle, X, BookOpen, ClipboardList, Bug, Target } from 'lucide-react';

interface WorkItem {
    id: string;
    key: string;
    title: string;
    description?: string;
    type: string;
    status: string;
    priority: string;
    assignee?: string;
    assignee_id?: number;
    due_date?: string;
    estimated_hours?: number;
    logged_hours?: number;
    sprint?: string;
    story_points?: number;
    acceptance_criteria?: string;
}

interface ListViewProps {
    workItems: WorkItem[];
    onTaskClick?: (item: WorkItem) => void;
}

type SortField = 'title' | 'status' | 'priority' | 'due_date' | 'assignee';
type SortDirection = 'asc' | 'desc';

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string; bg: string }> = {
    user_story: { icon: BookOpen, color: '#6366F1', label: 'Story', bg: 'rgba(99,102,241,0.15)' },
    task: { icon: ClipboardList, color: '#F59E0B', label: 'Task', bg: 'rgba(245,158,11,0.15)' },
    bug: { icon: Bug, color: '#EF4444', label: 'Bug', bg: 'rgba(239,68,68,0.15)' },
    epic: { icon: Target, color: '#8B5CF6', label: 'Epic', bg: 'rgba(139,92,246,0.15)' },
};

const ListView: React.FC<ListViewProps> = ({ workItems, onTaskClick }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [priorityFilter, setPriorityFilter] = useState<string>('all');
    const [sortField, setSortField] = useState<SortField>('status');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [groupBy, setGroupBy] = useState<string>('none');
    const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);

    const filteredAndSortedItems = useMemo(() => {
        let items = [...workItems];

        // Filter
        if (searchTerm) {
            items = items.filter(item => 
                item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.key.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        if (statusFilter !== 'all') {
            items = items.filter(item => item.status === statusFilter);
        }
        if (priorityFilter !== 'all') {
            items = items.filter(item => item.priority === priorityFilter);
        }

        // Sort
        items.sort((a, b) => {
            let aVal: any = a[sortField];
            let bVal: any = b[sortField];
            
            if (sortField === 'due_date') {
                aVal = a.due_date ? new Date(a.due_date).getTime() : Infinity;
                bVal = b.due_date ? new Date(b.due_date).getTime() : Infinity;
            }
            
            if (aVal === undefined || aVal === null) aVal = '';
            if (bVal === undefined || bVal === null) bVal = '';
            
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = (bVal as string).toLowerCase();
            }
            
            const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        return items;
    }, [workItems, searchTerm, statusFilter, priorityFilter, sortField, sortDirection]);

    const groupedItems = useMemo(() => {
        if (groupBy === 'none') return { 'All Items': filteredAndSortedItems };
        
        return filteredAndSortedItems.reduce((acc, item) => {
            let key: string;
            switch (groupBy) {
                case 'status':
                    key = item.status;
                    break;
                case 'assignee':
                    key = item.assignee || 'Unassigned';
                    break;
                case 'sprint':
                    key = item.sprint || 'No Sprint';
                    break;
                default:
                    key = 'All Items';
            }
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {} as Record<string, WorkItem[]>);
    }, [filteredAndSortedItems, groupBy]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'done':
                return <CheckCircle2 className="w-4 h-4 text-[#10B981]" />;
            case 'in_progress':
                return <Clock className="w-4 h-4 text-[#F59E0B]" />;
            case 'in_review':
                return <AlertCircle className="w-4 h-4 text-[#8B5CF6]" />;
            default:
                return <Circle className="w-4 h-4 text-[#64748B]" />;
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'high':
                return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'medium':
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            default:
                return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
        <th 
            className="text-left py-3 px-4 text-xs font-medium text-[#64748B] uppercase cursor-pointer hover:text-white transition-colors"
            onClick={() => handleSort(field)}
        >
            <div className="flex items-center gap-1">
                {label}
                {sortField === field && (
                    sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                )}
            </div>
        </th>
    );

    return (
        <Card className="bg-[#0F0F1A] border-[rgba(244,246,255,0.1)]">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-white">List View</CardTitle>
                    <span className="text-[#64748B] text-sm">{filteredAndSortedItems.length} items</span>
                </div>
                
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 mt-4">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                        <Input
                            placeholder="Search tasks..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 bg-[#0A0A14] border-[rgba(244,246,255,0.1)] text-white"
                        />
                    </div>
                    
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[130px] bg-[#0A0A14] border-[rgba(244,246,255,0.1)] text-white">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="in_review">In Review</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                    </Select>
                    
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <SelectTrigger className="w-[130px] bg-[#0A0A14] border-[rgba(244,246,255,0.1)] text-white">
                            <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Priority</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                    </Select>
                    
                    <Select value={groupBy} onValueChange={setGroupBy}>
                        <SelectTrigger className="w-[130px] bg-[#0A0A14] border-[rgba(244,246,255,0.1)] text-white">
                            <SelectValue placeholder="Group by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">No Grouping</SelectItem>
                            <SelectItem value="status">Status</SelectItem>
                            <SelectItem value="assignee">Assignee</SelectItem>
                            <SelectItem value="sprint">Sprint</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            
            <CardContent>
                {Object.entries(groupedItems).map(([group, items]) => (
                    <div key={group} className="mb-6 last:mb-0">
                        {groupBy !== 'none' && (
                            <div className="flex items-center gap-2 mb-3">
                                <Badge variant="outline" className="border-[rgba(244,246,255,0.1)] text-[#8B5CF6]">
                                    {group}
                                </Badge>
                                <span className="text-[#64748B] text-sm">{items.length} items</span>
                            </div>
                        )}
                        
                        <div className="overflow-x-auto rounded-lg border border-[rgba(244,246,255,0.06)]">
                            <table className="w-full">
                                <thead className="bg-[#0A0A14]">
                                    <tr>
                                        <th className="w-10"></th>
                                        <SortHeader field="title" label="Task" />
                                        <SortHeader field="status" label="Status" />
                                        <SortHeader field="priority" label="Priority" />
                                        <SortHeader field="assignee" label="Assignee" />
                                        <SortHeader field="due_date" label="Due Date" />
                                        <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B] uppercase">Est / Logged</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item) => (
                                        <tr 
                                            key={item.id}
                                            className="border-t border-[rgba(244,246,255,0.04)] hover:bg-[rgba(244,246,255,0.02)] cursor-pointer transition-colors"
                                            onClick={() => { setSelectedItem(item); onTaskClick?.(item); }}
                                        >
                                            <td className="py-3 px-4">{getStatusIcon(item.status)}</td>
                                            <td className="py-3 px-4">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-medium">{item.key}</span>
                                                    <span className="text-[#64748B] text-sm truncate max-w-[300px]">{item.title}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <Badge variant="outline" className="border-[rgba(244,246,255,0.1)] text-[#94A3B8]">
                                                    {item.status.replace('_', ' ')}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4">
                                                <Badge variant="outline" className={getPriorityColor(item.priority)}>
                                                    {item.priority}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4 text-[#94A3B8]">{item.assignee || 'Unassigned'}</td>
                                            <td className="py-3 px-4 text-[#94A3B8]">
                                                {item.due_date ? new Date(item.due_date).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="py-3 px-4 text-[#94A3B8]">
                                                {item.estimated_hours || 0}h / {item.logged_hours || 0}h
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
                
                {filteredAndSortedItems.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-[#64748B]">No tasks match your filters</p>
                    </div>
                )}
            </CardContent>

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
                                    const ti = TYPE_CONFIG[selectedItem.type] || TYPE_CONFIG.task;
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
                                <Badge
                                    variant="outline"
                                    className="border-[rgba(244,246,255,0.1)] text-[#94A3B8] capitalize"
                                >
                                    {selectedItem.status.replace(/_/g, ' ')}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className={getPriorityColor(selectedItem.priority)}
                                >
                                    {selectedItem.priority}
                                </Badge>
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
                                        label: 'Due Date',
                                        value: selectedItem.due_date
                                            ? new Date(selectedItem.due_date).toLocaleDateString()
                                            : 'Not set',
                                    },
                                ].map(({ label, value }) => (
                                    <div
                                        key={label}
                                        className="bg-[rgba(244,246,255,0.03)] rounded-xl p-3"
                                    >
                                        <p className="text-xs text-[#64748B] mb-1">{label}</p>
                                        <p className="text-sm font-medium text-white">{value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </Card>
    );
};

export default ListView;
