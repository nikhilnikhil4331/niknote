// ============================================================
// NikNote 4.0 — App Entry (SAFE — reverted to working base)
// ============================================================

import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PremiumProvider } from "@/contexts/PremiumContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { InstallBanner } from "@/components/InstallBanner";
import { ShareButtons } from "@/components/promotion/ShareButtons";
import { HandwritingDNAProvider } from "@/contexts/HandwritingDNAContext";
import Index from "./pages/Index";
import Welcome from "./pages/Welcome";
import NotFound from "./pages/NotFound";
import { AuthPage } from "@/components/auth/AuthPage";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Signup from "./pages/Signup";
import Upgrade from "./pages/Upgrade";
import Donate from "./pages/Donate";
import Payment from "./pages/Payment";
import Admin from "./pages/Admin";
import AdminPanelNikhil from "./pages/AdminPanelNikhil";
import AdminLogin from "./pages/AdminLogin";
import History from "./pages/History";
import Account from "./pages/Account";
import Achievements from "./pages/Achievements";
import MyNotebooks from "./pages/MyNotebooks";
import PremiumLanding from "./pages/PremiumLanding";
import Onboarding from "./pages/Onboarding";
import LegalPage from "./pages/LegalPage";
import { AppDock } from "@/components/AppDock";
import { CookieConsent } from "./components/CookieConsent";
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileExperience } from '@/components/mobile/MobileExperience';
import '@/components/mobile/mobile.css';
import { NiknoteLoader } from '@/components/motion/NiknoteLoader';

// Lazy load heavy/new pages — if they crash, main app stays alive
const AISolverPage = lazy(() =>
  import("@/components/ai/AISolverPage").then(m => ({ default: m.AISolverPage }))
);
const AI4Page = lazy(() =>
  import("@/components/ai4/AI4Page").then(m => ({ default: m.AI4Page }))
);
const DocumentIntelligence = lazy(() =>
  import("@/components/document-intelligence/DocumentIntelligence").then(m => ({ default: m.default }))
);
const QAPage = lazy(() =>
  import("@/pages/QA").then(m => ({ default: m.default }))
);
const BlogPage = lazy(() =>
  import("@/pages/Blog").then(m => ({ default: m.default }))
);
const B2BPage = lazy(() =>
  import("@/pages/B2BLanding").then(m => ({ default: m.default }))
);
const FeedbackPage = lazy(() =>
  import("@/pages/Feedback").then(m => ({ default: m.default }))
);
const HandbookPage = lazy(() => import("@/pages/Handbook"));
const AgentConsolePage = lazy(() => import("@/pages/AgentConsole"));
const AuditReportsPage = lazy(() => import("@/pages/AuditReports"));
const FlashcardsPage = lazy(() => import("@/pages/Flashcards"));
const HubPage = lazy(() => import("@/pages/Hub"));
const MoneyTrackerPage = lazy(() => import("@/pages/MoneyTracker"));
const BoardPageRoute = lazy(() => import("@/pages/Board"));
const NikHabitPage = lazy(() => import("@/pages/RoutineApp"));

// Simple page loader
const PageLoader = () => <NiknoteLoader />;

import { registerServiceWorker } from "@/hooks/useServiceWorkerRegistration";
import { checkReferral } from "@/utils/referral";
import { trackPageView } from "@/utils/analytics";

const queryClient = new QueryClient();

const DOCK_ROUTES = ["/notebooks","/flashcards","/history","/account","/achievements","/ai-solver","/ai","/documents","/handbook","/feedback","/upgrade"];
function GlobalDock() {
  const { pathname } = useLocation();
  const mobile = useIsMobile();
  if (mobile && ['/', '/hub', '/notebooks', '/ai', '/account', '/appearance', '/templates'].includes(pathname)) return null;
  if (!DOCK_ROUTES.includes(pathname)) return null;
  return <><div className="h-24 md:hidden" aria-hidden /><AppDock /></>;
}

function ResponsivePage({ children }: { children: React.ReactNode }) {
  const mobile = useIsMobile();
  return mobile ? <MobileExperience /> : <>{children}</>;
}
function WorkspaceEntry() {
  const mobile = useIsMobile();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  return mobile && !params.has('editor') && !params.has('notebook') ? <MobileExperience /> : <Index />;
}
function LegacyEditorRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/${search || '?editor=1'}`} replace />;
}
function DesktopFloatingShare() {
  const mobile = useIsMobile();
  return mobile ? null : <ShareButtons variant="floating" />;
}

function RouteAnalytics() {
  const { pathname } = useLocation();
  useEffect(() => { trackPageView(pathname); }, [pathname]);
  return null;
}

const App = () => {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
    
    // CRITICAL: Clear ALL stale caches from old SW versions before registering new
    // This prevents "Zap is not defined" crash from stale HTML+JS mismatch
    if (import.meta.env.PROD) {
      // First clear caches, then register new SW
      try {
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => {
              // Delete ALL old caches - only keep current version
              if (!name.includes('v5.0.2')) {
                console.log('[App] Purging stale cache:', name);
                caches.delete(name);
              }
            });
          });
        }
      } catch {}
      
      registerServiceWorker();
    }
    
    // Track referral on first visit
    try { checkReferral(); } catch {}
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PremiumProvider>
            <HandwritingDNAProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                   <RouteAnalytics />
                  <Suspense fallback={<PageLoader />}>
                    <RouteErrorBoundary>
                    <Routes>
                      <Route path="/" element={<WorkspaceEntry />} />
                    <Route path="/app" element={<LegacyEditorRedirect />} />
                    <Route path="/account-details" element={<Account />} />
                    <Route path="/ai-workspace" element={<AI4Page />} />
                    <Route path="/appearance" element={<MobileExperience />} />
                    <Route path="/templates" element={<MobileExperience />} />
                    <Route path="/welcome" element={<Welcome />} />
                    <Route path="/onboarding" element={<Onboarding />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/upgrade" element={<Upgrade />} />
                    <Route path="/donate" element={<Donate />} />
                    <Route path="/payment" element={<Payment />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/admin-login" element={<AdminLogin />} />
                    <Route path="/admin-panel-nikhil" element={<AdminPanelNikhil />} />
                    <Route path="/ai-solver" element={<AISolverPage />} />
                    <Route path="/ai" element={<ResponsivePage><AI4Page /></ResponsivePage>} />
                    <Route path="/documents" element={<DocumentIntelligence />} />
                    <Route path="/qa" element={<QAPage />} />
                    <Route path="/blog" element={<BlogPage />} />
                    <Route path="/blog/:slug" element={<BlogPage />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/account" element={<ResponsivePage><Account /></ResponsivePage>} />
                    <Route path="/achievements" element={<Achievements />} />
                    <Route path="/notebooks" element={<ResponsivePage><MyNotebooks /></ResponsivePage>} />
                    <Route path="/landing" element={<PremiumLanding />} />
                    <Route path="/schools" element={<Suspense fallback={<PageLoader />}><B2BPage /></Suspense>} />
                    <Route path="/institutions" element={<Suspense fallback={<PageLoader />}><B2BPage /></Suspense>} />
                    <Route path="/feedback" element={<Suspense fallback={<PageLoader />}><FeedbackPage /></Suspense>} />
                    <Route path="/handbook" element={<HandbookPage />} />
                    <Route path="/agents" element={<AgentConsolePage />} />
                    <Route path="/audit" element={<AuditReportsPage />} />
                    <Route path="/flashcards" element={<FlashcardsPage />} />
                    <Route path="/hub" element={<ResponsivePage><HubPage /></ResponsivePage>} />
                    <Route path="/board" element={<Suspense fallback={<PageLoader />}><BoardPageRoute /></Suspense>} />
                    <Route path="/money" element={<MoneyTrackerPage />} />
                    <Route path="/routine" element={<Navigate to="/habit" replace />} />
                    <Route path="/habit" element={<NikHabitPage />} />
                     <Route path="/privacy" element={<LegalPage policy="privacy" />} />
                     <Route path="/terms" element={<LegalPage policy="terms" />} />
                     <Route path="/refunds" element={<LegalPage policy="refunds" />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                    </RouteErrorBoundary>
                   <GlobalDock />
                   <CookieConsent />
                </Suspense>
              </BrowserRouter>
              <InstallBanner />
              <DesktopFloatingShare />
            </TooltipProvider>
          </HandwritingDNAProvider>
        </PremiumProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
