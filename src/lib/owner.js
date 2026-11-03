// Lightweight "identity": a random token kept in this browser's localStorage.
// It lets the server know which reviews were posted from this browser (no login needed).
const ownerKey = 'framelog-owner-v1';
const nameKey = 'framelog-reviewer-name-v1';

function randomToken() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

let memoryOwner = '';
export function getOwnerId() {
  try {
    let id = localStorage.getItem(ownerKey);
    if (!id) {
      id = randomToken();
      localStorage.setItem(ownerKey, id);
    }
    return id;
  } catch {
    // Storage blocked: fall back to a token that lasts until the page is closed.
    if (!memoryOwner) memoryOwner = randomToken();
    return memoryOwner;
  }
}

export function getSavedName() {
  try { return localStorage.getItem(nameKey) || ''; } catch { return ''; }
}

export function saveName(name) {
  try { localStorage.setItem(nameKey, name); } catch { /* Browser storage can be unavailable. */ }
}

export function formatDate(createdAt) {
  return new Date(`${createdAt.replace(' ', 'T')}Z`).toLocaleDateString();
}
