import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { useAuth } from "@/hooks/useAuth";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";
import DeeplinkLogin from "@/pages/deeplink-login";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // Allow deeplink-login to be accessible even when not authenticated
  if (location === "/deeplink-login") {
    return (
      <Switch>
        <Route path="/deeplink-login" component={DeeplinkLogin} />
      </Switch>
    );
  }

  // Show auth page if loading or not authenticated
  if (isLoading || !isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <Switch>
      <Route path="/deeplink-login" component={DeeplinkLogin} />
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;