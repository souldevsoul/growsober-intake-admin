export const STATUS_COLORS: Record<string, string> = {
  CALLED: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  INFO_COLLECTED: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  LINK_SENT: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  PAID: 'bg-green-500/20 text-green-300 border-green-500/30',
  MATCHED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  FAILED: 'bg-red-500/20 text-red-300 border-red-500/30',
};

export const ENROLLMENT_COLORS: Record<string, string> = {
  ACTIVE: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  COMPLETED: 'bg-green-500/20 text-green-300 border-green-500/30',
  PAUSED: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  CANCELLED: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

export const TRIGGER_LABELS: Record<string, string> = {
  MANUAL: 'Manual',
  ON_LEAD_CREATED: 'On Lead Created',
  ON_STATUS_CHANGE: 'On Status Change',
  ON_TAG_ADDED: 'On Tag Added',
};

export function formatStatus(status: string): string {
  return status.replaceAll('_', ' ');
}
