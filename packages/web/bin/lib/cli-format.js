/**
 * Small presentation helpers shared by resource CLI commands. These are pure
 * formatting utilities — they must not contain validation or policy.
 */

function truncate(value, max = 60) {
  const str = typeof value === 'string' ? value : (value == null ? '' : String(value));
  if (str.length <= max) return str;
  if (max <= 1) return str.slice(0, max);
  return `${str.slice(0, max - 1)}…`;
}

function formatRelativeTime(epochMs, now = Date.now()) {
  if (!Number.isFinite(epochMs) || epochMs <= 0) return 'unknown';
  const deltaMs = now - epochMs;
  if (deltaMs < 0) return 'just now';
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function formatModel(model) {
  if (!model || typeof model !== 'object') return '';
  const provider = typeof model.providerID === 'string' ? model.providerID : '';
  const id = typeof model.id === 'string' ? model.id : (typeof model.modelID === 'string' ? model.modelID : '');
  if (provider && id) return `${provider}/${id}`;
  return id || provider || '';
}

export {
  truncate,
  formatRelativeTime,
  formatModel,
};
