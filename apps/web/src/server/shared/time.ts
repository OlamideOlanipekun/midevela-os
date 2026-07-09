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
