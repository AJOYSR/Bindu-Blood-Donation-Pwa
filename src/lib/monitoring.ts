export async function initMonitoring(){
  const dsn=import.meta.env.VITE_SENTRY_DSN
  if(!dsn) return
  const Sentry=await import('@sentry/react')
  Sentry.init({dsn,environment:import.meta.env.MODE,tracesSampleRate:.05,replaysSessionSampleRate:0,replaysOnErrorSampleRate:0})
}
