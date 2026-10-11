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
import { InstallBanner } from "@/components/InstallBanner";
import { ShareButtons } from "@/components/promotion/ShareButtons";
import { HandwritingDNAProvider } from "@/contexts/HandwritingDNAContext";
import Index from "./pages/Index";
import Welcome from "./pages/Welcome";
import NotFound from "./pages/NotFound";
import { AuthPage } from "@/components/auth/AuthPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Upgrade from "./pages/Upgrade";
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
import { CookieConsent } from "./components/CookieConsent";

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
const RoutineTrackerPage = lazy(() => import("@/pages/RoutineTracker"));

// Simple page loader
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-white">
    <div className="text-center">
      <div className="text-2xl mb-3">✍️</div>
      <div className="text-sm text-gray-400">Loading...</div>
    </div>
  </div>
);

import { registerServiceWorker } from "@/hooks/useServiceWorkerRegistration";
import { checkReferral } from "@/utils/referral";
import { trackPageView } from "@/utils/analytics";

const queryClient = new QueryClient();

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
                    <Routes>
                      <Route path="/" element={<Index />} />
                    <Route path="/app" element={<Navigate to="/" replace />} />
                    <Route path="/welcome" element={<Welcome />} />
                    <Route path="/onboarding" element={<Onboarding />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/upgrade" element={<Upgrade />} />
                    <Route path="/payment" element={<Payment />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/admin-login" element={<AdminLogin />} />
                    <Route path="/admin-panel-nikhil" element={<AdminPanelNikhil />} />
                    <Route path="/ai-solver" element={<AISolverPage />} />
                    <Route path="/ai" element={<AI4Page />} />
                    <Route path="/documents" element={<DocumentIntelligence />} />
                    <Route path="/qa" element={<QAPage />} />
                    <Route path="/blog" element={<BlogPage />} />
                    <Route path="/blog/:slug" element={<BlogPage />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/account" element={<Account />} />
                    <Route path="/achievements" element={<Achievements />} />
                    <Route path="/notebooks" element={<MyNotebooks />} />
                    <Route path="/landing" element={<PremiumLanding />} />
                    <Route path="/schools" element={<Suspense fallback={<PageLoader />}><B2BPage /></Suspense>} />
                    <Route path="/institutions" element={<Suspense fallback={<PageLoader />}><B2BPage /></Suspense>} />
                    <Route path="/feedback" element={<Suspense fallback={<PageLoader />}><FeedbackPage /></Suspense>} />
                    <Route path="/handbook" element={<HandbookPage />} />
                    <Route path="/agents" element={<AgentConsolePage />} />
                    <Route path="/audit" element={<AuditReportsPage />} />
                    <Route path="/flashcards" element={<FlashcardsPage />} />
                    <Route path="/hub" element={<HubPage />} />
                    <Route path="/money" element={<MoneyTrackerPage />} />
                    <Route path="/routine" element={<RoutineTrackerPage />} />
                     <Route path="/privacy" element={<LegalPage policy="privacy" />} />
                     <Route path="/terms" element={<LegalPage policy="terms" />} />
                     <Route path="/refunds" element={<LegalPage policy="refunds" />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                   <CookieConsent />
                </Suspense>
              </BrowserRouter>
              <InstallBanner />
              <ShareButtons variant="floating" />
            </TooltipProvider>
          </HandwritingDNAProvider>
        </PremiumProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
