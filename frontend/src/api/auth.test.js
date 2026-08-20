import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getAppPassword,
  setAppPassword,
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from './auth'

// vitest's node environment has no localStorage; provide a minimal in-memory
// stub so the auth helpers exercise their real storage path.
function makeStorage() {
  const store = new Map()
  return {
    getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
    setItem: (k, v) => void store.set(String(k), String(v)),
    removeItem: (k) => void store.delete(String(k)),
    clear: () => void store.clear(),
  }
}

let originalLS
beforeEach(() => {
  originalLS = globalThis.localStorage
  globalThis.localStorage = makeStorage()
})
afterEach(() => {
  if (originalLS === undefined) delete globalThis.localStorage
  else globalThis.localStorage = originalLS
})

describe('auth helpers', () => {
  it('starts with empty password and empty tokens', () => {
    expect(getAppPassword()).toBe('')
    expect(getAccessToken()).toBe('')
    expect(getRefreshToken()).toBe('')
  })

  it('setAppPassword stores and removes the password', () => {
    setAppPassword('secret')
    expect(getAppPassword()).toBe('secret')
    setAppPassword('')
    expect(getAppPassword()).toBe('')
    setAppPassword(null)
    expect(getAppPassword()).toBe('')
  })

  it('setTokens stores access and refresh; clearTokens removes them', () => {
    setTokens({ access_token: 'acc', refresh_token: 'ref' })
    expect(getAccessToken()).toBe('acc')
    expect(getRefreshToken()).toBe('ref')
    clearTokens()
    expect(getAccessToken()).toBe('')
    expect(getRefreshToken()).toBe('')
  })
})