// ============================================================
// NikNote 6.0 — App Entry (Mobile Touch Safe + Asta Ultra AI)
// ============================================================

import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { NKToaster } from "@/components/nk/NKToast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PremiumProvider } from "@/contexts/PremiumContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { InstallBanner } from "@/components/InstallBanner";
import { PricingPopup } from "@/components/premium/PricingPopup";
import { ShareButtons } from "@/components/promotion/ShareButtons";
import { HandwritingDNAProvider } from "@/contexts/HandwritingDNAContext";
import { TouchHealthGuard } from "@/components/mobile/TouchHealthGuard";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { AuthPage } from "@/components/auth/AuthPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { AppDock } from "@/components/AppDock";
import { CookieConsent } from "./components/CookieConsent";
import { SeoHead } from "@/components/seo/SeoHead";
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileExperience } from '@/components/mobile/MobileExperience';
import '@/components/mobile/mobile.css';
import { NiknoteLoader } from '@/components/motion/NiknoteLoader';
import { initNativeShell } from '@/lib/nativeNav';
import { initTracking, trackRouteView } from '@/lib/tracking';

// Lazy load secondary, admin & heavy pages — keeps initial entry bundle fast
const Welcome = lazy(() => import("./pages/Welcome"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Upgrade = lazy(() => import("./pages/Upgrade"));
const Donate = lazy(() => import("./pages/Donate"));
const Payment = lazy(() => import("./pages/Payment"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminPanelNikhil = lazy(() => import("./pages/AdminPanelNikhil"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const History = lazy(() => import("./pages/History"));
const Account = lazy(() => import("./pages/Account"));
const Achievements = lazy(() => import("./pages/Achievements"));
const MyNotebooks = lazy(() => import("./pages/MyNotebooks"));
const PremiumLanding = lazy(() => import("./pages/PremiumLanding"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const AstaAIWorkspace = lazy(() => import("@/components/asta/AstaAIWorkspace"));
const AISolverPage = lazy(() =>
  import("@/components/ai/AISolverPage").then(m => ({ default: m.AISolverPage }))
);
const AI4Page = lazy(() =>
  import("@/components/ai4/AI4Page").then(m => ({ default: m.AI4Page }))
);
const DocumentIntelligence = lazy(() =>
  import("@/components/document-intelligence/DocumentIntelligence").then(m => ({ default: m.default }))
);
const PdfStudioPage = lazy(() => import("@/components/pdf-studio/PdfStudio"));
const PdfToolsPage = lazy(() => import("@/components/pdf-tools/PdfTools"));
const CheckupPage = lazy(() => import("@/pages/Checkup"));
const ScanNotesPage = lazy(() => import("@/pages/ScanNotes"));
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
const RoutineTrackerPage = lazy(() => import("@/pages/RoutineTracker"));
const NikHabitPage = lazy(() => import("@/pages/RoutineApp"));
// Desktop workspace (Notion-style enhanced UI) — desktop routes only;
// mobile keeps rendering MobileExperience exactly as before.
const DesktopHome = lazy(() => import("@/pages/DesktopHome"));
const DesktopNotes = lazy(() => import("@/pages/DesktopNotes"));
const DesktopTemplates = lazy(() => import("@/pages/DesktopTemplates"));
const DesktopCalendar = lazy(() => import("@/pages/DesktopCalendar"));
const DesktopTasks = lazy(() => import("@/pages/DesktopTasks"));
const DesktopTrash = lazy(() => import("@/pages/DesktopTrash"));
const DesktopShared = lazy(() => import("@/pages/DesktopShared"));
const DesktopFocus = lazy(() => import("@/pages/DesktopFocus"));

const PageLoader = () => <NiknoteLoader />;

import { registerServiceWorker } from "@/hooks/useServiceWorkerRegistration";
import { checkReferral } from "@/utils/referral";

const queryClient = new QueryClient();

const DOCK_ROUTES = ["/notebooks","/flashcards","/history","/account","/achievements","/ai-solver","/documents","/handbook","/feedback","/upgrade","/pdf-editor","/pdf-tools"];
function GlobalDock() {
  const { pathname } = useLocation();
  const mobile = useIsMobile();
  if (mobile && ['/', '/hub', '/notebooks', '/notes', '/ai', '/nikai', '/account', '/appearance', '/templates'].includes(pathname)) return null;
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
  const wantsEditor = params.has('editor') || params.has('notebook');
  // Desktop lands on the new Notion-style Home; the editor (Index) opens
  // when a note is being written. Mobile flow is unchanged.
  if (!mobile && !wantsEditor) return <DesktopHome />;
  return mobile && !wantsEditor ? <MobileExperience /> : <Index />;
}
function LegacyEditorRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/${search || '?editor=1'}`} replace />;
}
const NIKAI_FULLSCREEN_ROUTES = ['/ai', '/nikai', '/ai-workspace', '/agents'];

function DesktopFloatingShare() {
  const mobile = useIsMobile();
  const { pathname } = useLocation();
  if (mobile || NIKAI_FULLSCREEN_ROUTES.includes(pathname) || pathname.startsWith('/habit')) {
    return null;
  }
  return <ShareButtons variant="floating" />;
}

function GlobalCookieConsent() {
  const { pathname } = useLocation();
  if (NIKAI_FULLSCREEN_ROUTES.includes(pathname)) return null;
  return <CookieConsent />;
}

function RouteAnalytics() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    trackRouteView(pathname, search);
  }, [pathname, search]);
  return null;
}

const App = () => {
  useEffect(() => {
    // Android hardware Back (no-op on web)
    void initNativeShell();
    initTracking();
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");

    if (import.meta.env.PROD) {
      try {
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => {
              if (!name.includes('v8.0.0')) {
                console.log('[App] Purging stale cache:', name);
                caches.delete(name);
              }
            });
          });
        }
      } catch {}

      registerServiceWorker();
    }

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
                <NKToaster />
                <BrowserRouter>
                  <SeoHead />
                  <TouchHealthGuard />
                  <RouteAnalytics />
                  <Suspense fallback={<PageLoader />}>
                    <RouteErrorBoundary>
                      <Routes>
                        <Route path="/" element={<WorkspaceEntry />} />
                        <Route path="/home" element={<WorkspaceEntry />} />
                        <Route path="/studio" element={<Index />} />
                        <Route path="/app" element={<LegacyEditorRedirect />} />
                        <Route path="/account-details" element={<Account />} />
                        <Route path="/ai" element={<AstaAIWorkspace />} />
                        <Route path="/nikai" element={<AstaAIWorkspace />} />
                        <Route path="/ai-workspace" element={<AstaAIWorkspace />} />
                        <Route path="/ai-classic" element={<AI4Page />} />
                        <Route path="/appearance" element={<MobileExperience />} />
                        <Route path="/templates" element={<ResponsivePage><DesktopTemplates /></ResponsivePage>} />
                        <Route path="/calendar" element={<ResponsivePage><DesktopCalendar /></ResponsivePage>} />
                        <Route path="/tasks" element={<ResponsivePage><DesktopTasks /></ResponsivePage>} />
                        <Route path="/focus" element={<ResponsivePage><DesktopFocus /></ResponsivePage>} />
                        <Route path="/trash" element={<ResponsivePage><DesktopTrash /></ResponsivePage>} />
                        <Route path="/shared" element={<ResponsivePage><DesktopShared /></ResponsivePage>} />
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
                        <Route path="/documents" element={<DocumentIntelligence />} />
                        <Route path="/pdf-editor" element={<PdfStudioPage />} />
                        <Route path="/pdf" element={<PdfStudioPage />} />
                        <Route path="/pdf-tools" element={<PdfToolsPage />} />
                        <Route path="/scan-notes" element={<ScanNotesPage />} />
                        <Route path="/checkup" element={<CheckupPage />} />
                        <Route path="/qa" element={<QAPage />} />
                        <Route path="/blog" element={<BlogPage />} />
                        <Route path="/blog/:slug" element={<BlogPage />} />
                        <Route path="/history" element={<History />} />
                        <Route path="/account" element={<ResponsivePage><Account /></ResponsivePage>} />
                        <Route path="/achievements" element={<Achievements />} />
                        <Route path="/notebooks" element={<ResponsivePage><DesktopNotes /></ResponsivePage>} />
                        <Route path="/notes" element={<ResponsivePage><DesktopNotes /></ResponsivePage>} />
                        <Route path="/notebooks-classic" element={<ResponsivePage><MyNotebooks /></ResponsivePage>} />
                        <Route path="/landing" element={<PremiumLanding />} />
                        <Route path="/schools" element={<Suspense fallback={<PageLoader />}><B2BPage /></Suspense>} />
                        <Route path="/institutions" element={<Suspense fallback={<PageLoader />}><B2BPage /></Suspense>} />
                        <Route path="/feedback" element={<Suspense fallback={<PageLoader />}><FeedbackPage /></Suspense>} />
                        <Route path="/handbook" element={<HandbookPage />} />
                        <Route path="/agents" element={<AstaAIWorkspace />} />
                        <Route path="/audit" element={<AuditReportsPage />} />
                        <Route path="/flashcards" element={<FlashcardsPage />} />
                        <Route path="/hub" element={<ResponsivePage><HubPage /></ResponsivePage>} />
                        <Route path="/board" element={<Suspense fallback={<PageLoader />}><BoardPageRoute /></Suspense>} />
                        <Route path="/money" element={<MoneyTrackerPage />} />
                        <Route path="/routine" element={<RoutineTrackerPage />} />
                        <Route path="/habit" element={<NikHabitPage />} />
                        <Route path="/privacy" element={<LegalPage policy="privacy" />} />
                        <Route path="/terms" element={<LegalPage policy="terms" />} />
                        <Route path="/refunds" element={<LegalPage policy="refunds" />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </RouteErrorBoundary>
                    <GlobalDock />
                    <GlobalCookieConsent />
                    {/* InstallBanner calls useLocation(), so it MUST stay inside
                        the router. Mounting it outside threw "useLocation() may
                        be used only in the context of a <Router> component" on
                        every route and sent the whole app to the global error
                        screen. See src/lib/appShell.test.tsx. */}
                    <InstallBanner />
                    {/* Pricing offer. Lives inside the router because it reads
                        useLocation/useNavigate, and inside AuthProvider because
                        it asks usePremium() whether this visitor already pays.
                        It suppresses itself on checkout, auth and B2B routes and
                        remembers a dismissal for a week. */}
                    <PricingPopup />
                    <DesktopFloatingShare />
                  </Suspense>
                </BrowserRouter>
              </TooltipProvider>
            </HandwritingDNAProvider>
          </PremiumProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
