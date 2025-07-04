import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/lib/translations";
import Layout from "@/components/Layout";
import { useMobileConfig } from "@/hooks/useMobileConfig";
import Home from "@/pages/Home";
import Tickets from "@/pages/Tickets";
import Results from "@/pages/Results";
import Account from "@/pages/Account";
import AdminDashboard from "@/pages/AdminDashboard";
import AuditPage from "@/pages/AuditPage";
import AgentPortal from "@/pages/AgentPortal";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import VerifyIdentity from "@/pages/VerifyIdentity";
import USSDTest from "@/pages/USSDTest";

import FAQ from "@/pages/FAQ";
import { useEffect, useState } from "react";
import ZimbabweCurrencyLoader from "@/components/ZimbabweCurrencyLoader";
import { useAppLoading } from "@/hooks/useAppLoading";
import AuthGuard from "@/components/AuthGuard";
import AdminAuthGuard from "@/components/AdminAuthGuard";

function PWAInstallBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    setShowBanner(false);
    deferredPrompt.prompt();
    
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User ${outcome} the install prompt`);
    setDeferredPrompt(null);
  };

  if (!showBanner) return null;

  return (
    <div className="pwa-install-banner text-white p-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center">
        <svg className="w-6 h-6 text-yellow-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
          <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
        </svg>
        <span className="text-sm">Install Mutapa Lottery for the best experience</span>
      </div>
      <button 
        onClick={handleInstall}
        className="bg-yellow-400 text-green-800 px-4 py-2 rounded-lg font-medium text-sm hover:bg-yellow-300 transition-colors"
      >
        Install
      </button>
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <Switch>
        {/* Protected Routes - Require Authentication */}
        <Route path="/">
          <AuthGuard>
            <Home />
          </AuthGuard>
        </Route>
        <Route path="/tickets">
          <AuthGuard>
            <Tickets />
          </AuthGuard>
        </Route>
        <Route path="/results">
          <AuthGuard>
            <Results />
          </AuthGuard>
        </Route>
        <Route path="/account">
          <AuthGuard>
            <Account />
          </AuthGuard>
        </Route>
        <Route path="/admindash">
          <AdminAuthGuard>
            <AdminDashboard />
          </AdminAuthGuard>
        </Route>
        <Route path="/agentportal">
          <AuthGuard>
            <AgentPortal />
          </AuthGuard>
        </Route>
        <Route path="/verify-identity">
          <AuthGuard>
            <VerifyIdentity />
          </AuthGuard>
        </Route>
        <Route path="/ussd-test">
          <AuthGuard>
            <USSDTest />
          </AuthGuard>
        </Route>
        <Route path="/faq">
          <AuthGuard>
            <FAQ />
          </AuthGuard>
        </Route>
        
        {/* Public Audit Page - No auth required for transparency */}
        <Route path="/audit">
          <AuditPage />
        </Route>

        {/* Public Routes - Redirect to home if already logged in */}
        <Route path="/login">
          <AuthGuard requireAuth={false}>
            <Login />
          </AuthGuard>
        </Route>
        <Route path="/register">
          <AuthGuard requireAuth={false}>
            <Register />
          </AuthGuard>
        </Route>

        {/* Default Route */}
        <Route>
          <AuthGuard>
            <Home />
          </AuthGuard>
        </Route>
      </Switch>
    </Layout>
  );
}

function App() {
  const { isMobile, isOnline, platform } = useMobileConfig();
  const { isInitialLoading, markCurrencyShown } = useAppLoading();

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            console.log('SW registered: ', registration);
          })
          .catch(registrationError => {
            console.log('SW registration failed: ', registrationError);
          });
      });
    }
  }, []);

  // Show Zimbabwe currency loading screen on first app load
  return (
    <>
      <ZimbabweCurrencyLoader 
        isLoading={isInitialLoading} 
        onComplete={markCurrencyShown} 
      />
      {!isInitialLoading && (
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <TooltipProvider>
              <div className={`app ${isMobile ? 'mobile-app' : 'web-app'} ${platform}`}>
                {/* Network status indicator for mobile */}
                {isMobile && !isOnline && (
                  <div className="fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-2 text-sm z-50">
                    No internet connection - Working offline
                  </div>
                )}
                
                {/* Only show PWA banner on web, not in mobile app */}
                {!isMobile && <PWAInstallBanner />}
                
                <Toaster />
                <Router />
              </div>
            </TooltipProvider>
          </LanguageProvider>
        </QueryClientProvider>
      )}
    </>
  );
}

export default App;
