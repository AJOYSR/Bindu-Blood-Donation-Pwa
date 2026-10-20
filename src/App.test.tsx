import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppProvider } from './app/AppContext'
import App from './App'
import { AuthProvider } from './app/AuthContext'
import { PermissionsProvider } from './lib/permissions'
import { I18nProvider } from './i18n'

test('renders the primary landing action', () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <I18nProvider>
          <AuthProvider>
            <PermissionsProvider>
              <AppProvider>
                <App />
              </AppProvider>
            </PermissionsProvider>
          </AuthProvider>
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
  expect(screen.getByRole('heading', { name: /the right donor/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /find a donor/i })).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: /find donors/i }).length).toBeGreaterThan(0)
})
