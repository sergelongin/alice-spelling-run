import { useLDClient } from 'launchdarkly-react-client-sdk';
import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';

/**
 * Identifies the current user to LaunchDarkly when auth state changes.
 *
 * Updates LaunchDarkly context with:
 * - User ID and email when logged in
 * - Active child ID and grade level for targeting
 * - Anonymous context when logged out
 */
export function useLaunchDarklyIdentify() {
  const ldClient = useLDClient();
  const { user, activeChild } = useAuth();

  useEffect(() => {
    if (!ldClient) return;

    if (user) {
      ldClient.identify({
        kind: 'user',
        key: user.id,
        email: user.email,
        custom: {
          activeChildId: activeChild?.id,
          activeChildGrade: activeChild?.grade_level
        }
      });
    } else {
      ldClient.identify({ kind: 'user', anonymous: true });
    }
  }, [ldClient, user, activeChild]);
}
