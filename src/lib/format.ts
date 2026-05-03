// Strip markdown markers for plain-text chat surfaces (LiveChat agent
// widget, ChatWidget on chat-bot.bet) that don't render markdown.
// Slovenian uses č/š/ž which are not in the Unicode mathematical-bold
// block, so unicode-bold conversion produces inconsistent text — strip
// is the safe option.
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[^\*])\*(?!\s)([^\*\n]+?)\*(?!\*)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2");
}
