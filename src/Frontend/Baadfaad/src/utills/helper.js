export function generateUniqueId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function getInitials(name = '') {
  const parts = String(name).trim().split(/\s+/);
  if (!parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function base64Decode(base64) {
  if (!base64) {
    console.error("Base64 string is null or undefined");
    return null;
  }
  try {
    const standardBase64 = base64.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(standardBase64);
    return JSON.parse(decoded);
  } catch (error) {
    console.error("Error decoding base64 string:", error);
    return null;
  }
}