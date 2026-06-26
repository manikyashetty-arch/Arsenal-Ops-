/**
 * Strip common Markdown syntax to plain text for line-clamped previews
 * (cards, list snippets) so stray `#`, `*`, `` ` ``, or link syntax don't leak
 * into truncated text. This is intentionally conservative and regex-based — it
 * is NOT a parser. For full rendering use the `Markdown` component instead.
 */
export function stripMarkdown(text: string): string {
  if (!text) return '';
  return (
    text
      // Fenced code blocks → keep inner text, drop the fences.
      .replace(/```[^\n]*\n?([\s\S]*?)```/g, '$1')
      // Images ![alt](url) → alt text.
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Links [text](url) → text.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Inline code `code` → code.
      .replace(/`([^`]+)`/g, '$1')
      // Bold/italic markers ** * __ _ → drop.
      .replace(/(\*\*|__|\*|_)(.*?)\1/g, '$2')
      // Strikethrough ~~text~~ → text.
      .replace(/~~(.*?)~~/g, '$1')
      // Leading heading hashes, blockquotes, list markers per line.
      .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+)/gm, '')
      // Collapse leftover whitespace/newlines into single spaces.
      .replace(/\s+/g, ' ')
      .trim()
  );
}
