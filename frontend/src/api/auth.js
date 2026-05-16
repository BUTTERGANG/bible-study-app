// Shared-secret password persistence. The backend uses a single APP_PASSWORD
// env var; if set, the frontend prompts once and stashes the value in
// localStorage. Cleared explicitly via `setAppPassword(null)`.

const KEY = 'bible-study-app-password'

export function getAppPassword() {
  try {
    return localStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}

export function setAppPassword(value) {
  try {
    if (value) localStorage.setItem(KEY, value)
    else localStorage.removeItem(KEY)
  } catch {
    /* localStorage disabled (private mode) — leave in-memory only */
  }
}
