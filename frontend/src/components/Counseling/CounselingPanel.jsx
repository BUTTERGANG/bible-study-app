import { Heart } from 'lucide-react'

export default function CounselingPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-3">
      <Heart size={32} className="text-gray-300 dark:text-gray-600" />
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Counseling</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">Coming soon</p>
    </div>
  )
}
