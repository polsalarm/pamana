import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { WalletProvider } from './contexts/WalletContext'
import { FeedbackProvider } from './contexts/FeedbackContext'
import { DesktopFrame } from './components/DesktopFrame'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <DesktopFrame>
          <FeedbackProvider>
            <App />
          </FeedbackProvider>
        </DesktopFrame>
      </WalletProvider>
    </BrowserRouter>
  </StrictMode>,
)
