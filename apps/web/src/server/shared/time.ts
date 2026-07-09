/** Compact form for list badges ("2m", "5h", "3d") vs relativeTime's
 *  longer "2 minutes ago" form used in detail views. */
export function shortRelativeTime(date: Date): string {
  const seconds = (Date.now() - date.getTime()) / 1000;
  if (seconds < 60) return "now";
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  return `${Math.round(days)}d`;
}

export function relativeTime(date: Date): string {
  const seconds = (Date.now() - date.getTime()) / 1000;
  if (seconds < 90) return "Just now";
  const minutes = seconds / 60;
  if (minutes < 90) return `${Math.round(minutes)} minutes ago`;
  const hours = minutes / 60;
  if (hours < 36) return `${Math.round(hours)} hours ago`;
  const days = hours / 24;
  if (days < 10) return `${Math.round(days)} days ago`;
  const weeks = days / 7;
  if (weeks < 5) return `${Math.round(weeks)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}
