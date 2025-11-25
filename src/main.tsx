import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css'; // Vite will extract this to a separate file during build
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { checkBrowserCompatibility, showBrowserIncompatibility } from './utils/browserCheck';

// Debug logging
console.log('🚀 App Starting...');
console.log('Build Environment:', import.meta.env.MODE);
console.log('API URL:', import.meta.env.VITE_API_URL);
console.log('React Version:', React.version);

// Browser compatibility check
if (typeof window !== 'undefined') {
  const compatibility = checkBrowserCompatibility();
  if (!compatibility.compatible) {
    console.error('❌ Browser not compatible:', compatibility.missingFeatures);
    showBrowserIncompatibility(compatibility.missingFeatures);
    throw new Error(`Browser missing required features: ${compatibility.missingFeatures.join(', ')}`);
  }
  console.log('✅ Browser compatibility check passed');
}

// Get root element
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found!');
}

// Remove loading spinner once React mounts
const loadingDiv = rootElement.querySelector('div[style*="loading-spinner"]');
if (loadingDiv && rootElement.children.length === 1) {
  // Only clear if it's just the loading spinner
  rootElement.innerHTML = '';
}

// Initialize React app with error boundary
try {
  const root = createRoot(rootElement);
  
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ErrorBoundary>
    </StrictMode>
  );
  
  console.log('✅ App rendered successfully');
} catch (error) {
  console.error('❌ Failed to render app:', error);
  
  // Show error in root element
  rootElement.innerHTML = `
    <div style="
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
      text-align: center;
    ">
      <div>
        <h1 style="font-size: 2rem; margin-bottom: 1rem;">Failed to Load App</h1>
        <p style="margin-bottom: 2rem;">An error occurred while loading the application.</p>
        <button onclick="window.location.reload()" style="
          background: white;
          color: #667eea;
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        ">Reload Page</button>
        ${process.env.NODE_ENV === 'development' ? `<pre style="margin-top: 2rem; text-align: left; font-size: 0.875rem;">${error}</pre>` : ''}
      </div>
    </div>
  `;
  
  throw error;
}
