import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AppDataProvider } from './context/AppDataContext.jsx'
import { LanguageProvider } from './i18n/LanguageContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <AppDataProvider>
        <App />
      </AppDataProvider>
    </LanguageProvider>
  </React.StrictMode>
)
