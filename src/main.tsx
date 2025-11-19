import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css'; // Vite will extract this to a separate file during build
import { AuthProvider } from './context/AuthContext';

// Remove loading spinner once React mounts
const rootElement = document.getElementById('root');
if (rootElement) {
  const loadingDiv = rootElement.querySelector('div[style*="loading-spinner"]');
  if (loadingDiv && rootElement.children.length === 1) {
    // Only clear if it's just the loading spinner
    rootElement.innerHTML = '';
  }
}

createRoot(rootElement!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
