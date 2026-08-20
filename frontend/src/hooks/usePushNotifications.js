import { useEffect, useState } from 'react'

const STORAGE_KEY = 'logos-notification-settings'

const DEFAULT_SETTINGS = {
  enabled: false,
  verseOfDay: true,
  verseOfDayTime: '08:00',
  readingReminder: true,
  readingReminderTime: '20:00',
  prayerNudge: false,
  prayerNudgeTime: '12:00',
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

/**
 * Hook managing PWA push notification preferences and scheduling.
 * Uses the Notification API for local notifications (no server push needed for MVP).
 */
export function usePushNotifications() {
  const [settings, setSettings] = useState(loadSettings)
  const [permission, setPermission] = useState(() => {
    if (typeof Notification === 'undefined') return 'denied'
    return Notification.permission
  })

  // Persist settings on change
  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  // Schedule notifications when settings change
  useEffect(() => {
    if (!settings.enabled || permission !== 'granted') return

    const timers = []

    // Verse of the day notification
    if (settings.verseOfDay) {
      timers.push(scheduleNotification('verseOfDay', settings.verseOfDayTime, 'Verse of the Day', 'Open your daily verse'))
    }

    // Reading reminder
    if (settings.readingReminder) {
      timers.push(scheduleNotification('readingReminder', settings.readingReminderTime, 'Reading Plan', 'Complete today\'s readings'))
    }

    // Prayer nudge
    if (settings.prayerNudge) {
      timers.push(scheduleNotification('prayerNudge', settings.prayerNudgeTime, 'Prayer Journal', 'Take a moment to pray'))
    }

    return () => {
      timers.forEach(t => clearTimeout(t))
    }
  }, [settings, permission])

  async function requestPermission() {
    if (typeof Notification === 'undefined') {
      return 'denied'
    }
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === 'granted') {
        setSettings(s => ({ ...s, enabled: true }))
      }
      return result
    } catch {
      return 'denied'
    }
  }

  function updateSettings(updates) {
    setSettings(prev => ({ ...prev, ...updates }))
  }

  function toggleEnabled() {
    if (!settings.enabled) {
      requestPermission()
    } else {
      setSettings(s => ({ ...s, enabled: false }))
    }
  }

  return {
    settings,
    permission,
    isSupported: typeof Notification !== 'undefined',
    requestPermission,
    updateSettings,
    toggleEnabled,
  }
}

/**
 * Schedule a daily notification at a given time.
 * Returns a timeout ID for cleanup.
 */
function scheduleNotification(id, timeStr, title, body) {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const now = new Date()
  const scheduled = new Date()
  scheduled.setHours(hours, minutes, 0, 0)

  // If time has passed today, schedule for tomorrow
  if (scheduled <= now) {
    scheduled.setDate(scheduled.getDate() + 1)
  }

  const delay = scheduled - now

  return setTimeout(() => {
    // Show notification
    try {
      new Notification(`Scriptura — ${title}`, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: id,
        renotify: true,
      })
    } catch { /* ignore */ }

    // Reschedule for next day (simple recurring)
    scheduleNotification(id, timeStr, title, body)
  }, delay)
}
