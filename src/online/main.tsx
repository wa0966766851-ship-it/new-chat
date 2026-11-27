import React, { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { FullscreenProvider } from '../contexts/FullscreenContext';
import { PageErrorBoundary } from '../components/PageErrorBoundary';
import '../index.css';

const OnlineLobby = lazy(() => import('./OnlineLobby'));

function OnlineApp() {
  return <FullscreenProvider>
    <PageErrorBoundary onBack={() => location.reload()}>
      <Suspense fallback={<p role="status">載入雙人遊戲大廳…</p>}><OnlineLobby/></Suspense>
    </PageErrorBoundary>
  </FullscreenProvider>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><OnlineApp /></StrictMode>);
