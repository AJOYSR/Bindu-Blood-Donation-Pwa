import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AppProvider } from './app/AppContext'
import { ToastStack } from './components/ToastStack'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AnalyticsListener } from './components/AnalyticsListener'
import './styles.css'
import { initAnalytics } from './lib/analytics'
import { initMonitoring, reportError } from './lib/monitoring'
import { AuthProvider } from './app/AuthContext'
import { PermissionsProvider } from './lib/permissions'
import { registerPwa } from './lib/pwa'
import { I18nProvider } from './i18n'

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      reportError(error, {
        source: 'react_query',
        query: String(query.queryKey[0] ?? 'unknown')
      })
    }
  }),
  mutationCache: new MutationCache({
    onError: (error) => reportError(error, { source: 'react_query_mutation' })
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: true
    }
  }
})

void initMonitoring()
initAnalytics()
registerPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <I18nProvider>
          <AuthProvider>
            <PermissionsProvider>
              <AppProvider>
                <ErrorBoundary>
                  <AnalyticsListener />
                  <App />
                  <ToastStack />
                </ErrorBoundary>
              </AppProvider>
            </PermissionsProvider>
          </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)

requestAnimationFrame(() => {
  const boot = document.getElementById('boot')
  if (!boot) return
  boot.classList.add('is-hidden')
  window.setTimeout(() => boot.remove(), 450)
})
