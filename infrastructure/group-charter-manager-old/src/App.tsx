import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/layout/navbar";
import Dashboard from "@/pages/dashboard";
import CharterDetail from "@/pages/charter-detail";
import CreateCharter from "@/pages/create-charter";
import EditCharter from "@/pages/edit-charter";
import NotFound from "@/pages/not-found";

function Router() {
  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-black bg-opacity-10 rounded w-32 mx-auto"></div>
          <div className="h-4 bg-black bg-opacity-10 rounded w-48 mx-auto">Checking authentication...</div>
        </div>
      </div>
    );
  }

  // Show login button for unauthenticated users instead of auto-redirect
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-800">Group Charter</h1>
            <p className="text-gray-600">Please sign in to access your dashboard</p>
          </div>
          <button
            onClick={() => window.location.href = "/api/login"}
            className="gradient-primary text-white px-6 py-3 rounded-2xl font-medium hover:shadow-xl transform hover:scale-105 transition-all duration-300"
          >
            Sign In with Replit
          </button>
        </div>
      </div>
    );
  }

  // Show authenticated app
  return (
    <div className="min-h-screen gradient-bg">
      <Navbar />
      <div className="pt-10">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/charter/:id" component={CharterDetail} />
          <Route path="/charter/:id/edit" component={EditCharter} />
          <Route path="/create" component={CreateCharter} />
          <Route path="/create-charter" component={CreateCharter} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
