import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  Eye,
  Clock,
  CheckCircle2,
  MessageSquare,
  User,
  Calendar,
  Clock3,
  Inbox,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';
import { PRIORITY_COLOR } from '@/lib/workItemConfig';
import CommentThread, {
  type CommentThreadComment,
  type CommentThreadDeveloper,
  type CommentType,
} from '@/components/WorkItemPanel/CommentThread';

interface WorkItem {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  assignee?: string;
  assignee_id?: number;
  due_date?: string;
  estimated_hours?: number;
  logged_hours?: number;
  remaining_hours?: number;
}

interface ReviewerViewProps {
  workItems: WorkItem[];
  projectId: string;
  token: string;
  onTaskUpdate?: (itemId: string, updates: Record<string, unknown>) => void;
  /** Project developer roster used by the @mention picker. Optional —
   *  when absent (legacy callers), the picker shows "No matching
   *  developers" and the rest of the comment UX still works. */
  allDevelopers?: CommentThreadDeveloper[];
}

const ReviewerView: React.FC<ReviewerViewProps> = ({
  workItems,
  projectId: _projectId,
  token,
  onTaskUpdate,
  allDevelopers = [],
}) => {
  const { user } = useAuth();
  // Only the ticket's assignee can log hours (matches backend enforcement).
  // ReviewerView has no project-developer list to map email→developer id,
  // so we compare by display name. Fragile in edge cases (renames,
  // duplicates) but the backend rejects mismatches with 403 anyway — this
  // is just UI hide.
  const isAssigneeOf = (item: WorkItem) =>
    !!user?.name && !!item.assignee && user.name === item.assignee;

  const [comments, setComments] = useState<Record<string, CommentThreadComment[]>>({});
  const [logHoursInput, setLogHoursInput] = useState<Record<string, string>>({});
  const [showLogHours, setShowLogHours] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Filter to in_review items only. Kept local — the parent panel passes
  // every visible work item; we narrow here so adding new statuses
  // upstream doesn't bleed into the queue.
  const reviewItems = workItems.filter((item) => item.status === 'in_review');

  const fetchComments = useCallback(
    async (itemId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/comments/workitem/${itemId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data: CommentThreadComment[] = await res.json();
          setComments((prev) => ({ ...prev, [itemId]: data }));
        }
      } catch (err) {
        console.error('Failed to fetch comments:', err);
      }
    },
    [token],
  );

  // Initial fetch — once per visible review item. `reviewItems.length` is a
  // pragmatic dep; if items reorder without changing count the effect
  // skips, which is fine because comments are keyed by id (not index) and
  // each item already has its own fetch.
  useEffect(() => {
    reviewItems.forEach((item) => {
      fetchComments(item.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: we don't want a re-fetch storm when the array reference changes but the items haven't.
  }, [reviewItems.length, fetchComments]);

  const handleAddComment = async (itemId: string, content: string, type: CommentType) => {
    setLoading((prev) => ({ ...prev, [`comment-${itemId}`]: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/comments/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          work_item_id: parseInt(itemId),
          content,
          comment_type: type,
        }),
      });

      if (res.ok) {
        await fetchComments(itemId);
        toast.success('Comment added');
      } else {
        toast.error('Failed to add comment');
      }
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setLoading((prev) => ({ ...prev, [`comment-${itemId}`]: false }));
    }
  };

  const handleLogHours = async (itemId: string) => {
    const hours = parseFloat(logHoursInput[itemId]);
    if (!hours || hours <= 0) {
      toast.error('Please enter valid hours');
      return;
    }

    setLoading((prev) => ({ ...prev, [`log-${itemId}`]: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/workitems/${itemId}/log-hours`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ hours, description: 'Reviewed and logged' }),
      });

      if (res.ok) {
        setLogHoursInput((prev) => ({ ...prev, [itemId]: '' }));
        setShowLogHours((prev) => ({ ...prev, [itemId]: false }));
        toast.success(`${hours}h logged`);
        onTaskUpdate?.(itemId, {});
      } else {
        toast.error('Failed to log hours');
      }
    } catch {
      toast.error('Failed to log hours');
    } finally {
      setLoading((prev) => ({ ...prev, [`log-${itemId}`]: false }));
    }
  };

  // Generic status mutator used by both reviewer actions (Mark Done /
  // Send Back). Keyed loading entries so the two buttons can spin
  // independently if ever pressed back-to-back. Backend `PUT
  // /api/workitems/{id}` validates the target status (e.g. "subtask still
  // open" blocks marking a parent done); surface those messages verbatim.
  const handleStatusChange = async (
    itemId: string,
    newStatus: 'done' | 'in_progress',
    successMessage: string,
  ) => {
    const loadingKey = `status-${newStatus}-${itemId}`;
    setLoading((prev) => ({ ...prev, [loadingKey]: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/workitems/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast.success(successMessage);
        onTaskUpdate?.(itemId, { status: newStatus });
      } else {
        let detail = 'Failed to update status';
        try {
          const body = await res.json();
          if (body?.detail) detail = body.detail;
        } catch {
          // body wasn't JSON — keep the generic message
        }
        toast.error(detail);
      }
    } catch {
      toast.error('Failed to update status');
    } finally {
      setLoading((prev) => ({ ...prev, [loadingKey]: false }));
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'No due date';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (reviewItems.length === 0) {
    return (
      <Empty className="border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)]">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-[rgba(224,185,84,0.1)]">
            <Inbox className="text-[#E0B954]" />
          </EmptyMedia>
          <EmptyTitle className="text-white">Review queue is empty</EmptyTitle>
          <EmptyDescription>
            Items moved to <span className="text-[#a3a3a3]">In&nbsp;Review</span> will show up here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section header — outside the card list so it stays sticky-feeling
          while users scroll a long queue. */}
      <div className="flex items-center gap-2 px-1">
        <div className="w-8 h-8 rounded-xl bg-[rgba(224,185,84,0.1)] flex items-center justify-center">
          <Eye className="w-4 h-4 text-[#E0B954]" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-white">Review Queue</h2>
          <p className="text-[11px] text-[#737373]">Items awaiting your review</p>
        </div>
        <Badge className="bg-[rgba(224,185,84,0.15)] text-[#E0B954] border border-[rgba(224,185,84,0.3)]">
          {reviewItems.length}
        </Badge>
      </div>

      {reviewItems.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(224,185,84,0.25)] transition-colors p-4 space-y-3"
        >
          {/* Title row — ticket key + priority chip + title, plus
              right-aligned primary actions. */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-mono font-semibold text-[#E0B954]">{item.key}</span>
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase tracking-wider px-1.5 py-0 h-5"
                  style={{
                    borderColor: PRIORITY_COLOR[item.priority] || '#737373',
                    color: PRIORITY_COLOR[item.priority] || '#737373',
                  }}
                >
                  {item.priority}
                </Badge>
              </div>
              <h3 className="text-sm font-semibold text-white leading-snug">{item.title}</h3>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isAssigneeOf(item) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setShowLogHours((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                  }
                  className="h-8 text-xs text-[#737373] hover:text-[#F59E0B] hover:bg-[rgba(245,158,11,0.1)] rounded-lg"
                >
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  Log time
                </Button>
              )}
              {/* Send back to In Progress — reviewer rejection path. Ghost
                  variant so Mark Done stays the visual primary. Disabled
                  state checks its own loading key so it doesn't spin when
                  Mark Done is in flight. */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  handleStatusChange(item.id, 'in_progress', 'Moved back to In Progress')
                }
                disabled={loading[`status-in_progress-${item.id}`]}
                className="h-8 text-xs text-[#a3a3a3] hover:text-white hover:bg-[rgba(255,255,255,0.06)] rounded-lg disabled:opacity-60"
              >
                {loading[`status-in_progress-${item.id}`] ? (
                  <Spinner size="xs" tone="white" />
                ) : (
                  <>
                    <Undo2 className="w-3.5 h-3.5 mr-1" />
                    Move to In Progress
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={() => handleStatusChange(item.id, 'done', 'Marked as done')}
                disabled={loading[`status-done-${item.id}`]}
                className="h-8 text-xs bg-[#E0B954] hover:bg-[#C79E3B] text-[#080808] font-semibold rounded-lg disabled:opacity-60"
              >
                {loading[`status-done-${item.id}`] ? (
                  <Spinner size="xs" tone="white" />
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Mark done
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Meta strip — assignee · due · hours. Single row, dotted between
              fields for visual hierarchy. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#a3a3a3]">
            <span className="inline-flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#737373]" />
              <span className="text-[#f5f5f5]">{item.assignee || 'Unassigned'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#737373]" />
              {formatDate(item.due_date)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="w-3.5 h-3.5 text-[#737373]" />
              <span className="font-mono tabular-nums">
                {item.logged_hours || 0}h<span className="text-[#525252]"> / </span>
                {item.estimated_hours || 0}h
              </span>
              <span className="text-[#525252] text-[10px] uppercase tracking-wider">
                logged / estimated
              </span>
            </span>
          </div>

          {/* Log Hours input — only renders when the toggle is on AND user
              is the assignee. Slightly recessed background to read as a
              one-off form, not a permanent section. */}
          {showLogHours[item.id] && isAssigneeOf(item) && (
            <div className="flex items-center gap-2 p-3 bg-[rgba(245,158,11,0.04)] border border-[rgba(245,158,11,0.18)] rounded-xl">
              <Input
                type="number"
                placeholder="Hours"
                min="0.5"
                step="0.5"
                className="w-24 h-8 bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] text-sm rounded-lg"
                value={logHoursInput[item.id] || ''}
                onChange={(e) =>
                  setLogHoursInput((prev) => ({ ...prev, [item.id]: e.target.value }))
                }
              />
              <Button
                size="sm"
                onClick={() => handleLogHours(item.id)}
                disabled={loading[`log-${item.id}`]}
                className="h-8 text-xs bg-[#F59E0B] hover:bg-[#D97706] text-white rounded-lg disabled:opacity-60"
              >
                {loading[`log-${item.id}`] ? <Spinner size="xs" tone="white" /> : 'Log'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLogHours((prev) => ({ ...prev, [item.id]: false }))}
                className="h-8 text-xs text-[#737373] hover:text-white rounded-lg"
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Comments section — uses the shared CommentThread for full
              parity with the work-item side panel: @mention picker, link
              auto-linking, comment-type variants. Variant 'simple' shows
              a single Send button (Blocker / Business Review chips are
              omitted here since the item is already in review). */}
          <div className="pt-2.5 border-t border-[rgba(255,255,255,0.05)]">
            <div className="flex items-center gap-2 mb-2.5 text-xs font-semibold uppercase tracking-wider text-[#8A8A8A]">
              <MessageSquare className="w-3.5 h-3.5" />
              Comments
              <span className="text-[#525252] normal-case tracking-normal font-normal">
                ({comments[item.id]?.length || 0})
              </span>
            </div>
            <CommentThread
              comments={comments[item.id] || []}
              allDevelopers={allDevelopers}
              isPosting={loading[`comment-${item.id}`] || false}
              onSubmit={(content, type) => handleAddComment(item.id, content, type)}
              variant="simple"
              placeholder="Add a review comment… Use @ to mention someone"
              listMaxHeightPx={240}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReviewerView;
