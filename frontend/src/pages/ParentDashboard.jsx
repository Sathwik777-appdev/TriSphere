import React, { lazy, Suspense } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import AppLoader from '../components/AppLoader';
import MaintenanceGate from '../components/MaintenanceGate';

// Both views are lazy so each device only downloads the chunk it needs —
// matches the StudentDashboard pattern. `useIsMobile` returns the correct
// value on the FIRST render so the right chunk starts loading immediately
// (no flash of the wrong layout).
const MobileView  = lazy(() => import('./ParentDashboardMobile'));
const DesktopView = lazy(() => import('../components/DesktopLockedMessage'));

export default function ParentDashboard(props) {
  const isMobile = useIsMobile();
  const View = isMobile ? MobileView : DesktopView;
  const label = isMobile ? 'Connecting Parent Portal…' : 'Loading Parent Hub…';

  // MaintenanceGate routes parents to the maintenance banner whenever
  // the developer has flipped the platform-wide flag — covers both
  // mobile and desktop in one place. Developer role bypasses.
  return (
    <MaintenanceGate>
      <Suspense fallback={<AppLoader message={label} />}>
        <View {...props} />
      </Suspense>
    </MaintenanceGate>
  );
}
