import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { withLaunchDarkly } from '@/lib/launchdarkly';
import './index.css';

const WrappedApp = withLaunchDarkly(App);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WrappedApp />
  </StrictMode>
);
