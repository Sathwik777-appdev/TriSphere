import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMaintenanceMode } from '../hooks/useMaintenanceMode';
import MaintenanceBanner from './MaintenanceBanner';

/**
 * MaintenanceGate
 * ───────────────────────────────────────────────────────────────────
 * Wrap any dashboard with this to make it honor the platform-wide
 * maintenance flag. Behavior:
 *
 *   • If maintenance is OFF → renders children normally.
 *   • If maintenance is ON  → renders the MaintenanceBanner instead.
 *   • DEVELOPER role ALWAYS bypasses — even when maintenance is ON
 *     they see their dashboard, because they're the one who needs to
 *     flip the switch back to OFF.
 *
 * Render is stable across refreshes / app restarts because
 * useMaintenanceMode reads from a Firestore doc that only the
 * developer can write to. Nothing here is cached locally — closing
 * and reopening the browser shows whatever the developer last set.
 */
export default function MaintenanceGate({ children }) {
  const { userData } = useAuth();
  const { loading, enabled, message } = useMaintenanceMode();

  // While the first snapshot is in flight, render the dashboard
  // normally rather than block on it. The flag will arrive within
  // milliseconds and snap into place — better than flashing a
  // maintenance screen on every page load.
  if (loading) return children;

  // Developer is exempt by design.
  if (userData?.role === 'developer') return children;

  if (enabled) {
    return <MaintenanceBanner message={message} />;
  }

  return children;
}
