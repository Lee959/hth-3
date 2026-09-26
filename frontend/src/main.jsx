import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App.jsx'
import { AppAuthProvider } from './auth/Auth0ProviderWithNavigate.jsx'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppAuthProvider>
        <App />
      </AppAuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
