import { track } from './analytics'

/** Register the conservative offline shell service worker. */
export function registerPwa() {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
  window.addEventListener('appinstalled', () => track('pwa_installed'))
}
