/**
 * @fileoverview Application Entry Point
 * @description Mounts the root React component into the DOM.
 *              Renders inside React.StrictMode for development warnings.
 *              Imports global Tailwind CSS styles from index.css.
 *
 * @module main
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if (import.meta.env.VITE_ENABLE_TAWK === 'true') {
  const script = document.createElement('script')
  script.async = true
  script.src = 'https://embed.tawk.to/699ef63c865cc31c343adb9e/1jiaf3ngf'
  script.charset = 'UTF-8'
  script.crossOrigin = 'anonymous'
  document.head.appendChild(script)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
