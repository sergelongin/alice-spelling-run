import type { ComponentType } from 'react';
import { withLDProvider } from 'launchdarkly-react-client-sdk';
import Observability from '@launchdarkly/observability';
import SessionReplay from '@launchdarkly/session-replay';

const clientSideID = import.meta.env.VITE_LAUNCHDARKLY_CLIENT_ID;

/**
 * Wraps an app component with LaunchDarkly provider for feature flags and observability.
 *
 * Features enabled:
 * - Observability: Error monitoring, logging, performance tracing
 * - Session Replay: User session recording with privacy controls
 *
 * Gracefully degrades if no client ID is configured.
 */
export function withLaunchDarkly(App: ComponentType): ComponentType {
  if (!clientSideID) {
    console.warn('[LaunchDarkly] Client ID not configured - running without LaunchDarkly');
    return App;
  }

  return withLDProvider({
    clientSideID,
    context: { kind: 'user', anonymous: true },
    options: {
      plugins: [
        new Observability({
          tracingOrigins: true,
          networkRecording: { enabled: true, recordHeadersAndBody: false }
        }),
        new SessionReplay({ privacySetting: 'default' })
      ]
    }
  })(App);
}
