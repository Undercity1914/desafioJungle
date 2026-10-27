import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { worker } from './mocks/browser'

async function bootstrap() {
  const rootElement = document.getElementById('root')

  if (!rootElement) {
    throw new Error('Application root element #root was not found.')
  }

  const mocksEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_MSW === 'true'

  try {
    if (mocksEnabled) {
      await worker.start({
        serviceWorker: { url: '/mockServiceWorker.js' },
        onUnhandledFrame: 'bypass',
      })
    }

    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  } catch (error) {
    console.error('Failed to initialize the demo API mocks.', error)
    rootElement.textContent = ''

    const message = document.createElement('main')
    message.setAttribute('role', 'alert')
    message.style.cssText = 'max-width: 48rem; margin: 3rem auto; padding: 1.5rem; color: #fee2e2; background: #450a0a; border: 1px solid #ef4444; border-radius: 1rem; font: 16px/1.5 system-ui, sans-serif;'
    message.textContent = 'The demo API could not start. Check that /mockServiceWorker.js is deployed and served as JavaScript, then reload the page.'
    rootElement.append(message)
  }
}

void bootstrap()
