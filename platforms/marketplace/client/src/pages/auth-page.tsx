import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Eye, EyeOff } from "lucide-react";

export default function AuthPage() {
  const { user, loginMutation } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });

  // Redirect if already logged in
  if (user) {
    return <Redirect to="/admin" />;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({
      email: loginForm.email,
      password: loginForm.password,
    });
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: 'hsl(270, 100%, 85%)' }}>
              <Shield className="w-8 h-8 text-black" />
            </div>
            <h2 className="text-4xl font-black text-black mb-2">Admin Access</h2>
            <p className="text-gray-600 font-medium">Manage your W3DS marketplace</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <Label htmlFor="email" className="text-black font-bold">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="admin@example.com"
                className="mt-2 rounded-xl border-2 border-gray-200 px-4 py-3"
                required
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-black font-bold">Password</Label>
              <div className="relative mt-2">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter your password"
                  className="rounded-xl border-2 border-gray-200 px-4 py-3 pr-12"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Checkbox
                  id="remember"
                  checked={loginForm.rememberMe}
                  onCheckedChange={(checked) => 
                    setLoginForm(prev => ({ ...prev, rememberMe: checked as boolean }))
                  }
                />
                <Label htmlFor="remember" className="ml-2 text-sm text-gray-600">
                  Remember me
                </Label>
              </div>
              <Button variant="link" className="text-sm text-gray-600 p-0 h-auto">
                Forgot password?
              </Button>
            </div>

            <Button 
              type="submit" 
              className="w-full text-black font-bold px-8 py-4 rounded-full hover:scale-105 transition-all duration-200"
              style={{ backgroundColor: 'hsl(85, 100%, 85%)' }}
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}