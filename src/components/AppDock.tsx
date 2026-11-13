// NikNote — app-wide mobile dock for non-editor screens
import { useLocation } from 'react-router-dom';
import { MobileNavigation } from '@/components/mobile/MobilePrimitives';
import { useMobileAppearance } from '@/components/mobile/useMobileAppearance';

export function AppDock() {
  const { pathname } = useLocation();
  const { attributes } = useMobileAppearance();
  const active = pathname === '/ai' || pathname === '/nikai'
    ? 'ai'
    : pathname === '/account'
      ? 'profile'
      : pathname === '/notebooks' || pathname === '/notes'
        ? 'notes'
        : 'home';

  return (
    <div className="nn-mobile md:hidden" {...attributes} style={{ minHeight: 0 }}>
      <MobileNavigation active={active} />
    </div>
  );
}
