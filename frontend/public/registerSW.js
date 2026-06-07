if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
      // Check for an updated SW immediately on each page load rather than
      // waiting for the default browser interval (~24 hours).
      reg.update()
    })
  })
}
