import { Component } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const rootElement = document.getElementById('root');
let appMounted = false;

function renderStartupError(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[JUST GROOVE] App startup failed:', error);

  if (rootElement) {
    rootElement.innerHTML = `
      <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#0D0D0D;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;text-align:center">
        <section style="max-width:360px;padding:28px;border:1px solid #3a3a3a;border-radius:24px;background:#1B1B1B">
          <p style="color:#C8FF35;font-weight:700;letter-spacing:.08em">JUST GROOVE</p>
          <h1 style="font-size:24px">頁面暫時無法載入</h1>
          <p style="color:#A1A1AA;line-height:1.5">請重新開啟 App。若問題持續，請重新執行同步建置。</p>
          <small style="color:#777">${message.replace(/[<>&]/g, '')}</small>
        </section>
      </main>`;
  }
}

class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[JUST GROOVE] React render failed:', error, info);
  }

  render() {
    if (this.state.error) {
      return <main className="runtime-error"><p>JUST GROOVE</p><h1>頁面暫時無法載入</h1><span>請關閉後重新開啟 App。</span></main>;
    }
    return this.props.children;
  }
}

window.addEventListener('error', (event) => {
  if (!appMounted) renderStartupError(event.error || event.message);
  else console.error('[JUST GROOVE] Runtime error:', event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.name === 'AbortError') {
    event.preventDefault();
    return;
  }
  event.preventDefault();
  if (!appMounted) renderStartupError(event.reason);
  else console.error('[JUST GROOVE] Unhandled runtime rejection:', event.reason);
});

try {
  if (!rootElement) throw new Error('找不到 #root 容器。');
  createRoot(rootElement).render(<AppErrorBoundary><App /></AppErrorBoundary>);
  appMounted = true;
} catch (error) {
  renderStartupError(error);
}
