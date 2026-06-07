import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import AppRouter from './App'
import './index.css'

// When a lazy-loaded chunk fails to fetch (stale service worker cache after a
// rebuild), reload once to get the latest index.html and chunk manifest.
window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})

// When a new service worker takes control via skipWaiting + clientsClaim,
// reload so the page runs the fresh index.html with correct chunk hashes.
if ('serviceWorker' in navigator) {
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
