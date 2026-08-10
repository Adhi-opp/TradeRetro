import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Self-hosted faces. The stylesheet declared 'Inter' and 'JetBrains Mono'
// without ever loading them, so every surface silently fell back to the
// platform UI font — different typography on every machine.
// Archivo: grotesque with tight apertures, holds up at heavy display weights.
// IBM Plex Mono: engineered, unambiguous 0/O and 1/l, real tabular figures.
import '@fontsource-variable/archivo'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'

import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
