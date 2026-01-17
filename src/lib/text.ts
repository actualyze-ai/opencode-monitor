// Text utilities for terminal display

/**
 * Truncate text to fit within a maximum width
 * Adds ellipsis (…) if truncated
 * @param text - Text to truncate
 * @param maxWidth - Maximum character width
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) return text;
  return text.slice(0, maxWidth - 1) + "…";
}
