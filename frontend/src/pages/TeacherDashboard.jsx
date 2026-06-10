import React, { lazy, Suspense } from 'react';
import DesktopView from './TeacherDashboardDesktop';
import { useIsMobile } from '../hooks/useMediaQuery';
import AppLoader from '../components/AppLoader';
import MaintenanceGate from '../components/MaintenanceGate';

const MobileView = lazy(() => import('./TeacherDashboardMobile'));

export default function TeacherDashboard(props) {
  const isMobile = useIsMobile();

  // The MaintenanceGate wrapper lives at the TOP of the device branch
  // so both mobile and desktop teachers see the maintenance banner
  // when the developer flips the platform-wide flag. Developer role
  // bypasses the gate so they can still reach their own console.
  if (isMobile) {
    return (
      <MaintenanceGate>
        <Suspense fallback={<AppLoader message="Loading Class Monitor..." />}>
          <MobileView {...props} />
        </Suspense>
      </MaintenanceGate>
    );
  }

  return (
    <MaintenanceGate>
      <DesktopView {...props} />
    </MaintenanceGate>
  );
}
