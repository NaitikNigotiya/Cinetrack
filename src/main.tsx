import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'

import { ThemeProvider } from '@/contexts/ThemeContext'
import { queryClient } from '@/lib/queryClient'

import './styles/tokens.css'
import './styles/animations.css'

import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* ThemeProvider → applies [data-theme] to <html> before anything renders */}
    <ThemeProvider>
      {/* QueryClientProvider → shared cache for all TMDb + Firestore queries */}
      <QueryClientProvider client={queryClient}>
        {/* App → RouterProvider with all routes */}
        <App />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
