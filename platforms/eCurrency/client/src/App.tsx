import { Switch, Route } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./lib/auth-context";
import { useAuth } from "./hooks/useAuth";
import AuthPage from "./pages/auth-page";
import Dashboard from "./pages/dashboard";
import Currencies from "./pages/currencies";
import CurrencyDetail from "./pages/currency-detail";

const queryClient = new QueryClient();

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show auth page if loading or not authenticated
  if (isLoading || !isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <Switch>
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/currencies" component={Currencies} />
      <Route path="/currency/:currencyId" component={CurrencyDetail} />
      <Route path="/" component={Dashboard} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
