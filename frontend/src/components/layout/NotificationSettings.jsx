import { Bell, BellOff, Clock, Heart, BookOpen } from 'lucide-react'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import clsx from 'clsx'

export default function NotificationSettings() {
  const { settings, permission, isSupported, requestPermission, updateSettings, toggleEnabled } = usePushNotifications()

  if (!isSupported) {
    return (
      <div className="p-4 text-center">
        <BellOff size={24} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Notifications not supported in this browser
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        {settings.enabled ? (
          <Bell size={16} className="text-blue-500" />
        ) : (
          <BellOff size={16} className="text-gray-400" />
        )}
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Notifications</h3>
      </div>

      {/* Permission prompt */}
      {permission !== 'granted' && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
          <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
            Enable notifications to receive daily reminders and verse of the day.
          </p>
          <button
            onClick={requestPermission}
            className="w-full text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-1.5 font-medium transition-colors"
          >
            Enable Notifications
          </button>
        </div>
      )}

      {/* Master toggle */}
      {permission === 'granted' && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600 dark:text-gray-300">Notifications</span>
          <button
            onClick={toggleEnabled}
            className={clsx(
              'relative w-10 h-5 rounded-full transition-colors',
              settings.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
            )}
          >
            <div className={clsx(
              'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
              settings.enabled ? 'translate-x-5' : 'translate-x-0.5'
            )} />
          </button>
        </div>
      )}

      {/* Notification types */}
      {permission === 'granted' && (
        <div className="space-y-3 opacity-100">
          {/* Verse of the day */}
          <NotificationOption
            icon={<BookOpen size={14} />}
            label="Verse of the Day"
            time={settings.verseOfDayTime}
            enabled={settings.verseOfDay}
            onToggle={() => updateSettings({ verseOfDay: !settings.verseOfDay })}
            onTimeChange={(t) => updateSettings({ verseOfDayTime: t })}
          />

          {/* Reading reminder */}
          <NotificationOption
            icon={<Clock size={14} />}
            label="Reading Plan Reminder"
            time={settings.readingReminderTime}
            enabled={settings.readingReminder}
            onToggle={() => updateSettings({ readingReminder: !settings.readingReminder })}
            onTimeChange={(t) => updateSettings({ readingReminderTime: t })}
          />

          {/* Prayer nudge */}
          <NotificationOption
            icon={<Heart size={14} />}
            label="Prayer Journal Nudge"
            time={settings.prayerNudgeTime}
            enabled={settings.prayerNudge}
            onToggle={() => updateSettings({ prayerNudge: !settings.prayerNudge })}
            onTimeChange={(t) => updateSettings({ prayerNudgeTime: t })}
          />
        </div>
      )}

      <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
        Notifications use your browser's notification system. No server push required.
      </p>
    </div>
  )
}

function NotificationOption({ icon, label, time, enabled, onToggle, onTimeChange }) {
  return (
    <div className={clsx(
      'rounded-lg border p-3 transition-colors',
      enabled
        ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/10'
        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
    )}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={enabled ? 'text-blue-500' : 'text-gray-400'}>{icon}</span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{label}</span>
        </div>
        <button
          onClick={onToggle}
          className={clsx(
            'relative w-8 h-4 rounded-full transition-colors',
            enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
          )}
        >
          <div className={clsx(
            'absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform',
            enabled ? 'translate-x-4' : 'translate-x-0.5'
          )} />
        </button>
      </div>
      {enabled && (
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[10px] text-gray-400">at</span>
          <input
            type="time"
            value={time}
            onChange={(e) => onTimeChange(e.target.value)}
            className="text-[10px] border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
          />
        </div>
      )}
    </div>
  )
}
