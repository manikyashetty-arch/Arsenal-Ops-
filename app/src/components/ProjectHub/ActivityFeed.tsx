import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Activity, GitBranch, CheckCircle2, MessageSquare, Clock, User, Edit, Trash2 } from 'lucide-react';

interface ActivityItem {
    id: number;
    action: string;
    entity_type: string;
    entity_id?: number;
    title: string;
    details?: Record<string, any>;
    created_at: string;
    user_name: string;
    user_email?: string;
}

interface ActivityFeedProps {
    activities: ActivityItem[];
    maxItems?: number;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities, maxItems = 20 }) => {
    const getActionIcon = (action: string) => {
        switch (action) {
            case 'created':
                return <GitBranch className="w-4 h-4 text-[#10B981]" />;
            case 'updated':
                return <Edit className="w-4 h-4 text-[#F59E0B]" />;
            case 'completed':
                return <CheckCircle2 className="w-4 h-4 text-[#10B981]" />;
            case 'deleted':
                return <Trash2 className="w-4 h-4 text-[#EF4444]" />;
            case 'commented':
                return <MessageSquare className="w-4 h-4 text-[#E0B954]" />;
            case 'logged_hours':
                return <Clock className="w-4 h-4 text-[#C79E3B]" />;
            case 'assigned':
                return <User className="w-4 h-4 text-[#06B6D4]" />;
            default:
                return <Activity className="w-4 h-4 text-[#737373]" />;
        }
    };

    const getEntityTypeColor = (entityType: string) => {
        switch (entityType) {
            case 'work_item':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'sprint':
                return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'goal':
                return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'milestone':
                return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'project':
                return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
            default:
                return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    const displayedActivities = activities.slice(0, maxItems);

    return (
        <Card className="bg-[#0d0d0d] border-[rgba(255,255,255,0.08)]">
            <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Activity Feed
                </CardTitle>
            </CardHeader>
            <CardContent>
                {displayedActivities.length === 0 ? (
                    <div className="text-center py-12">
                        <Activity className="w-12 h-12 text-[#737373] mx-auto mb-2" />
                        <p className="text-[#737373]">No activity yet</p>
                        <p className="text-[#737373] text-sm">Activity will appear here as the project progresses</p>
                    </div>
                ) : (
                    <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-[rgba(255,255,255,0.05)]" />

                        <div className="space-y-4">
                            {displayedActivities.map((activity) => (
                                <div key={activity.id} className="relative flex items-start gap-4 pl-10">
                                    {/* Timeline dot */}
                                    <div className="absolute left-3 w-4 h-4 rounded-full bg-[#0d0d0d] border-2 border-[rgba(255,255,255,0.08)] flex items-center justify-center">
                                        <div className="w-2 h-2 rounded-full bg-[#E0B954]" />
                                    </div>

                                    <div className="flex-1 p-3 bg-[#0A0A14] rounded-lg border border-[rgba(255,255,255,0.05)]">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="w-6 h-6 bg-[#E0B954]">
                                                    <AvatarFallback className="bg-[#E0B954] text-white text-xs">
                                                        {getInitials(activity.user_name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-white font-medium text-sm">{activity.user_name}</span>
                                                {getActionIcon(activity.action)}
                                            </div>
                                            <span className="text-[#737373] text-xs">
                                                {formatTimeAgo(activity.created_at)}
                                            </span>
                                        </div>

                                        <p className="text-[#a3a3a3] text-sm mb-2">{activity.title}</p>

                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className={getEntityTypeColor(activity.entity_type)}>
                                                {activity.entity_type.replace('_', ' ')}
                                            </Badge>
                                            <Badge variant="outline" className="border-[rgba(255,255,255,0.08)] text-[#737373]">
                                                {activity.action}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activities.length > maxItems && (
                    <div className="text-center mt-4">
                        <button className="text-[#E0B954] text-sm hover:underline">
                            View all {activities.length} activities
                        </button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ActivityFeed;
