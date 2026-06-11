// Pure render helpers + avatar palette extracted verbatim from WorkItemPanel.
// No hooks, no side effects — safe to call during render of any sub-component.

import type { WorkItem } from '../types';

/**
 * Pure predicate mirroring the original `renderCompactHierarchy()` truthiness
 * gate (it returned `null` when there was nothing to show). The view-mode
 * region used the function's return value both to decide whether to render the
 * "Linked Items" wrapper AND as the content — this keeps that behavior without
 * rendering the component twice.
 */
export function hasCompactHierarchy(item: WorkItem): boolean {
  if (item.type === 'subtask') return !!item.parent_key;
  return !!item.epic_key;
}

export function renderTextWithNewlines(text: string) {
  if (!text) return null;
  return text
    .split('\n')
    .flatMap((line, i, arr) => [
      <span key={`l-${i}`}>{line}</span>,
      i < arr.length - 1 ? <br key={`b-${i}`} /> : null,
    ])
    .filter(Boolean);
}

export function renderCommentContent(
  content: string,
  mentions: number[] = [],
  devMap: Map<number, string>,
) {
  let result = content;
  mentions.forEach((devId) => {
    const devName = devMap.get(devId);
    if (devName) {
      const regex = new RegExp(`@${devName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      result = result.replace(regex, `<<<M_${devId}>>>`);
    }
  });
  const urls: string[] = [];
  result = result.replace(/(https?:\/\/[^\s]+)/g, (m) => {
    urls.push(m);
    return `<<<U_${urls.length - 1}>>>`;
  });
  const parts = result.split(/(<<<M_\d+>>>|<<<U_\d+>>>)/g);
  let idx = 0;
  return parts.flatMap((part) => {
    const mm = part.match(/<<<M_(\d+)>>>/);
    if (mm) {
      return (
        <span
          key={`m-${idx++}`}
          className="bg-[rgba(224,185,84,0.2)] text-[#E0B954] px-1.5 py-0.5 rounded-md font-medium"
        >
          @{devMap.get(parseInt(mm[1]))}
        </span>
      );
    }
    const um = part.match(/<<<U_(\d+)>>>/);
    if (um) {
      const url = urls[parseInt(um[1])];
      return (
        <a
          key={`u-${idx++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#E0B954] hover:text-[#C79E3B] underline hover:no-underline transition-colors break-all"
        >
          {url}
        </a>
      );
    }
    return part
      .split('\n')
      .flatMap((line, li, arr) => [
        <span key={`t-${idx}-${li}`}>{line}</span>,
        li < arr.length - 1 ? <br key={`tb-${idx}-${li}`} /> : null,
      ])
      .filter(Boolean);
  });
}

export const AVATAR_PALETTE = ['#E0B954', '#60A5FA', '#34D399', '#A78BFA', '#F97316', '#F43F5E'];

export const avatarColor = (id: number | null | undefined) =>
  AVATAR_PALETTE[(id ?? 0) % AVATAR_PALETTE.length];
