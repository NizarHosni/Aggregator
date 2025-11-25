// Browser compatibility check
export function checkBrowserCompatibility(): { compatible: boolean; missingFeatures: string[] } {
  const requiredFeatures: Array<{ name: string; check: () => boolean }> = [
    { name: 'Promise', check: () => typeof Promise !== 'undefined' },
    { name: 'fetch', check: () => typeof fetch !== 'undefined' },
    { name: 'URLSearchParams', check: () => typeof URLSearchParams !== 'undefined' },
    { name: 'Object.entries', check: () => typeof Object.entries === 'function' },
    { name: 'Array.from', check: () => typeof Array.from === 'function' },
    { name: 'localStorage', check: () => {
      try {
        return typeof localStorage !== 'undefined';
      } catch {
        return false;
      }
    }},
  ];

  const missingFeatures = requiredFeatures
    .filter(feature => !feature.check())
    .map(feature => feature.name);

  return {
    compatible: missingFeatures.length === 0,
    missingFeatures,
  };
}

export function showBrowserIncompatibility(missingFeatures: string[]) {
  const root = document.getElementById('root');
  if (!root) return;

  root.innerHTML = `
    <div style="
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
    ">
      <div style="
        max-width: 500px;
        text-align: center;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        padding: 40px;
        border-radius: 20px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      ">
        <h1 style="font-size: 2rem; margin-bottom: 1rem;">Browser Not Supported</h1>
        <p style="margin-bottom: 1.5rem; opacity: 0.9;">
          Your browser is missing required features: <strong>${missingFeatures.join(', ')}</strong>
        </p>
        <p style="margin-bottom: 2rem; opacity: 0.8;">
          Please update your browser or use a modern browser like:
        </p>
        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
          <a href="https://www.google.com/chrome/" target="_blank" rel="noopener" style="
            background: white;
            color: #667eea;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
          ">Chrome</a>
          <a href="https://www.mozilla.org/firefox/" target="_blank" rel="noopener" style="
            background: white;
            color: #667eea;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
          ">Firefox</a>
          <a href="https://www.apple.com/safari/" target="_blank" rel="noopener" style="
            background: white;
            color: #667eea;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
          ">Safari</a>
        </div>
      </div>
    </div>
  `;
}

