import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * useMaintenanceMode
 * ───────────────────────────────────────────────────────────────────
 * Real-time listener on `systemConfig/maintenance`. Returns whether
 * the platform is in maintenance mode + a short message the developer
 * may have set on the doc.
 *
 * Why a snapshot listener and not a one-off read:
 *   - The whole point of maintenance mode is that flipping it ON
 *     should immediately push every connected user to the banner
 *     screen (and flipping it OFF should pull them back without a
 *     manual refresh). onSnapshot gives us that for free.
 *
 * Persistence semantics — answers the user's spec exactly:
 *   - The flag lives on a Firestore doc, NOT localStorage. That
 *     means: closing/refreshing the developer's browser does not
 *     change the state; only the developer explicitly toggling it
 *     does. On next login the state reflects exactly what the
 *     developer set, period.
 *
 * Returns: { loading, enabled, message, updatedAt, updatedBy }
 *   loading — first snapshot hasn't arrived yet. Treat as "unknown
 *             yet" — most callers should default-render the app
 *             rather than block on this.
 *   enabled — boolean. False if the doc doesn't exist yet (safe
 *             default — first deploy doesn't trip into maintenance).
 */
export function useMaintenanceMode() {
  const [state, setState] = useState({
    loading: true,
    enabled: false,
    message: '',
    updatedAt: null,
    updatedBy: '',
  });

  useEffect(() => {
    // We deliberately use ONE shared doc `systemConfig/maintenance`
    // (not one per user / per school) — maintenance is platform-wide.
    const ref = doc(db, 'systemConfig', 'maintenance');
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          // No doc yet → safe default: maintenance OFF. The developer
          // toggle will create the doc on first flip.
          setState({
            loading: false,
            enabled: false,
            message: '',
            updatedAt: null,
            updatedBy: '',
          });
          return;
        }
        const data = snap.data();
        setState({
          loading: false,
          enabled: !!data.enabled,
          message: typeof data.message === 'string' ? data.message : '',
          updatedAt: data.updatedAt || null,
          updatedBy: data.updatedBy || '',
        });
      },
      (err) => {
        // If the read fails (rules, network), don't trap users in a
        // maintenance screen they can't escape from. Fall back to
        // "not in maintenance" so the app stays usable.
        console.warn('Maintenance flag read failed; defaulting to OFF:', err);
        setState({
          loading: false,
          enabled: false,
          message: '',
          updatedAt: null,
          updatedBy: '',
        });
      }
    );

    return () => unsubscribe();
  }, []);

  return state;
}
