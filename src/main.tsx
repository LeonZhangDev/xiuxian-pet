import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ErrorBoundary from './components/error-boundary'
import { desktop } from './lib/desktop-bridge'
import './index.css'
import App from './App.tsx'
import { installErrorHooks, uiLog } from './lib/logger'

installErrorHooks()
uiLog.info('boot', '页面启动', { ua: navigator.userAgent, screen: `${window.screen.width}x${window.screen.height}` })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary onError={(error) => desktop?.rendererFailed(error.message)}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
