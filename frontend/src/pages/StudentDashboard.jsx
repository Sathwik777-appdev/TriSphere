import React, { lazy, Suspense } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import AppLoader from '../components/AppLoader';
import MaintenanceGate from '../components/MaintenanceGate';

// Both dashboards are lazy so the device only downloads the one it needs —
// no wasted KBs on the wrong layout, and no flash of the wrong UI on first
// paint. `useIsMobile` returns the correct value SYNCHRONOUSLY on the very
// first render (see useMediaQuery.js), so the right chunk starts loading
// immediately.
const MobileView  = lazy(() => import('./StudentDashboardMobile'));
const DesktopView = lazy(() => import('../components/DesktopLockedMessage'));

export default function StudentDashboard(props) {
  const isMobile = useIsMobile();
  const View = isMobile ? MobileView : DesktopView;
  const label = isMobile ? 'Loading Mobile Experience…' : 'Loading Dashboard…';

  // Maintenance gate wraps the dashboard so that when the developer
  // turns maintenance ON, every student (mobile and desktop) sees the
  // banner instead of their normal dashboard. Developer role bypasses.
  return (
    <MaintenanceGate>
      <Suspense fallback={<AppLoader message={label} />}>
        <View {...props} />
      </Suspense>
    </MaintenanceGate>
  );
}
