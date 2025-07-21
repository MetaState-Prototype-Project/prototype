import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/navigation";
import Home from "@/pages/home";
import CreateVote from "@/pages/create-poll";
import Vote from "@/pages/vote";

import NotFound from "@/pages/not-found";

function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">eVoting</h1>
          <p className="text-lg text-gray-600 mb-8">
            Secure polling platform for democratic decision making
          </p>
        </div>
        
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-lg sm:px-10">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Welcome to eVoting</h2>
            <p className="text-gray-600 mb-8">
              Sign in to create polls, vote on active polls, and view results in real-time.
            </p>
            
            <a
              href="/api/login"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-(--crimson) hover:bg-(--crimson-50) hover:text-(--crimson) hover:border-(--crimson) focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-(--crimson) transition-colors"
            >
              Sign in with Replit
            </a>
            
            <div className="mt-8 text-sm text-gray-500">
              <p>Features you'll get access to:</p>
              <ul className="mt-2 text-left space-y-1">
                <li>• Create public and private polls</li>
                <li>• Vote on active polls</li>
                <li>• View real-time results</li>
                <li>• Manage your created polls</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--crimson)"></div>
      </div>
    );
  }

  // If not authenticated, show login page
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/create" component={CreateVote} />
          <Route path="/vote/:id" component={Vote} />
          <Route component={NotFound} />
        </Switch>
      </main>
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
