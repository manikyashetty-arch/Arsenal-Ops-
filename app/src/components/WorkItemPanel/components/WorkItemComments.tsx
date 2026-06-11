import { MessageSquare, AlertCircle, Target } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import type { AllDeveloper, Comment } from '../types';
import { renderCommentContent } from '../lib/renderContent';

export interface WorkItemCommentsProps {
  newComment: string;
  onCommentChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  showMentions: boolean;
  mentionFilter: string;
  allDevelopers: AllDeveloper[];
  onInsertMention: (dev: { id: number; name: string }) => void;
  onSubmitComment: (type?: Comment['comment_type']) => void;
  isSubmitting: boolean;
  comments: Comment[];
  devMap: Map<number, string>;
}

export const WorkItemComments = ({
  newComment,
  onCommentChange,
  showMentions,
  mentionFilter,
  allDevelopers,
  onInsertMention,
  onSubmitComment,
  isSubmitting,
  comments,
  devMap,
}: WorkItemCommentsProps) => (
  <div className="pt-4 border-t border-[rgba(255,255,255,0.05)]">
    <div className="text-xs text-[#8A8A8A] mb-3 font-semibold uppercase tracking-wider">
      Activity &amp; Comments
    </div>
    <div className="relative mb-4">
      <Textarea
        value={newComment}
        onChange={onCommentChange}
        placeholder="Add a comment… Use @ to mention someone"
        className="bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] text-[#F4F6FF] rounded-xl min-h-[80px] placeholder:text-[#334155] resize-none"
      />
      {showMentions && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-[#1A1D26] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
          {allDevelopers
            .filter((d) => d.name.toLowerCase().includes(mentionFilter.toLowerCase()))
            .slice(0, 5)
            .map((dev) => (
              <button
                key={dev.id}
                onClick={() => onInsertMention(dev)}
                className="w-full px-3 py-2 text-left text-sm text-[#f5f5f5] hover:bg-[rgba(224,185,84,0.1)] flex items-center gap-2"
              >
                <div className="w-6 h-6 rounded-full bg-[rgba(224,185,84,0.2)] flex items-center justify-center text-xs text-[#E0B954]">
                  {dev.name.charAt(0).toUpperCase()}
                </div>
                <span>{dev.name}</span>
                <span className="text-[#737373] text-xs ml-auto">{dev.email}</span>
              </button>
            ))}
          {allDevelopers.filter((d) => d.name.toLowerCase().includes(mentionFilter.toLowerCase()))
            .length === 0 && (
            <div className="px-3 py-2 text-sm text-[#737373]">No matching developers</div>
          )}
        </div>
      )}
      <div className="flex gap-2 mt-2 flex-wrap">
        <Button
          size="sm"
          onClick={() => onSubmitComment('comment')}
          disabled={!newComment.trim() || isSubmitting}
          className="bg-[rgba(224,185,84,0.1)] border border-[rgba(224,185,84,0.3)] text-[#E0B954] hover:bg-[rgba(224,185,84,0.2)] rounded-lg text-xs h-8"
        >
          <MessageSquare className="w-3 h-3 mr-1" /> Comment
        </Button>
        <Button
          size="sm"
          onClick={() => onSubmitComment('blocker')}
          disabled={!newComment.trim() || isSubmitting}
          className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[#EF4444] hover:bg-[rgba(239,68,68,0.2)] rounded-lg text-xs h-8"
        >
          <AlertCircle className="w-3 h-3 mr-1" /> Report Blocker
        </Button>
        <Button
          size="sm"
          onClick={() => onSubmitComment('business_review')}
          disabled={!newComment.trim() || isSubmitting}
          className="bg-[rgba(167,139,250,0.1)] border border-[rgba(167,139,250,0.3)] text-[#A78BFA] hover:bg-[rgba(167,139,250,0.2)] rounded-lg text-xs h-8"
        >
          <Target className="w-3 h-3 mr-1" /> Business Review
        </Button>
      </div>
    </div>
    <div className="space-y-3 max-h-64 overflow-y-auto">
      {comments.length === 0 ? (
        <div className="text-center py-6 text-[#737373] text-sm">
          No comments yet. Be the first to comment!
        </div>
      ) : (
        comments.map((comment) => (
          <div
            key={comment.id}
            className={`p-3 rounded-xl ${
              comment.comment_type === 'blocker'
                ? 'bg-[rgba(239,68,68,0.05)] border border-[rgba(239,68,68,0.2)]'
                : comment.comment_type === 'business_review'
                  ? 'bg-[rgba(167,139,250,0.05)] border border-[rgba(167,139,250,0.2)]'
                  : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  comment.comment_type === 'blocker'
                    ? 'bg-[rgba(239,68,68,0.2)] text-[#EF4444]'
                    : comment.comment_type === 'business_review'
                      ? 'bg-[rgba(167,139,250,0.2)] text-[#A78BFA]'
                      : 'bg-[rgba(224,185,84,0.2)] text-[#E0B954]'
                }`}
              >
                {comment.author_name?.charAt?.(0)?.toUpperCase() || '?'}
              </div>
              <span className="text-sm font-medium text-[#f5f5f5]">{comment.author_name}</span>
              {comment.comment_type === 'blocker' && (
                <span className="px-1.5 py-0.5 rounded-md bg-[rgba(239,68,68,0.2)] text-[#EF4444] text-[10px] font-medium">
                  BLOCKER
                </span>
              )}
              {comment.comment_type === 'business_review' && (
                <span className="px-1.5 py-0.5 rounded-md bg-[rgba(167,139,250,0.2)] text-[#A78BFA] text-[10px] font-medium">
                  BUSINESS REVIEW
                </span>
              )}
              <span className="text-xs text-[#737373] ml-auto">
                {new Date(comment.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-sm text-[#a3a3a3] leading-relaxed">
              {renderCommentContent(comment.content, comment.mentions, devMap)}
            </p>
          </div>
        ))
      )}
    </div>
  </div>
);
