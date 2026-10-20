import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AppProvider } from './app/AppContext'
import { ToastStack } from './components/ToastStack'
import './styles.css'
import { initMonitoring } from './lib/monitoring'
import { AuthProvider } from './app/AuthContext'
import { PermissionsProvider } from './lib/permissions'
import { registerPwa } from './lib/pwa'
import { I18nProvider } from './i18n'

const queryClient=new QueryClient({defaultOptions:{queries:{staleTime:30_000,retry:2,refetchOnWindowFocus:true}}})
void initMonitoring()
registerPwa()
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><I18nProvider><AuthProvider><PermissionsProvider><AppProvider><App/><ToastStack/></AppProvider></PermissionsProvider></AuthProvider></I18nProvider></BrowserRouter></QueryClientProvider></StrictMode>)

// Fade out the pre-JS boot splash once React has painted.
requestAnimationFrame(() => {
  const boot = document.getElementById('boot')
  if (!boot) return
  boot.classList.add('is-hidden')
  window.setTimeout(() => boot.remove(), 450)
})
