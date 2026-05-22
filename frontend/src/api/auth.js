// Auth helpers: JWT tokens (user accounts) + legacy APP_PASSWORD fallback.

const PASSWORD_KEY = 'bible-study-app-password'
const ACCESS_KEY   = 'bible-study-jwt'
const REFRESH_KEY  = 'bible-study-refresh'

// --- Legacy APP_PASSWORD ---

export function getAppPassword() {
  try { return localStorage.getItem(PASSWORD_KEY) || '' } catch { return '' }
}

export function setAppPassword(value) {
  try {
    if (value) localStorage.setItem(PASSWORD_KEY, value)
    else localStorage.removeItem(PASSWORD_KEY)
  } catch { /* private mode */ }
}

// --- JWT ---

export function getAccessToken() {
  try { return localStorage.getItem(ACCESS_KEY) || '' } catch { return '' }
}

export function getRefreshToken() {
  try { return localStorage.getItem(REFRESH_KEY) || '' } catch { return '' }
}

export function setTokens({ access_token, refresh_token }) {
  try {
    localStorage.setItem(ACCESS_KEY, access_token)
    if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token)
  } catch { /* private mode */ }
}

export function clearTokens() {
  try {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  } catch { /* private mode */ }
}
