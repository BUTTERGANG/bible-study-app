import { Calendar } from 'lucide-react'

export default function PreachingSeriesPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-3">
      <Calendar size={32} className="text-gray-300 dark:text-gray-600" />
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Preaching Series</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">Coming soon</p>
    </div>
  )
}
