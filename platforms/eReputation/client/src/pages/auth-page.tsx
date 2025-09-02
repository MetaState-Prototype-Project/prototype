import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const { loginMutation, registerMutation } = useAuth();
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ 
    email: "", 
    password: "", 
    firstName: "", 
    lastName: "" 
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginForm);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate(registerForm);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-t from-fig/30 to-fig/10 relative overflow-hidden p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-32 h-32 bg-swiss-cheese rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-apple-red rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-700"></div>
        <div className="absolute bottom-20 left-1/3 w-28 h-28 bg-basil rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-300"></div>
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* eReputation Branding */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-4">
            <div className="w-16 h-16 bg-fig rounded-2xl mx-auto flex items-center justify-center shadow-xl transform rotate-12">
              <svg className="w-8 h-8 text-swiss-cheese transform -rotate-12" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
          </div>
          
          <div className="space-y-2 mb-4">
            <h1 className="text-3xl font-black text-fig tracking-tight">eReputation</h1>
            <p className="text-gray-800 text-xs leading-relaxed max-w-sm mx-auto font-medium">
              Manage your reputation in the MetaState
            </p>
          </div>
        </div>

        {/* Authentication Card */}
        <Card className="bg-fig-10 border-fig/20 shadow-2xl">
          <Tabs defaultValue="login" className="w-full">
            <CardHeader className="text-center pb-4">
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-fig/10">
                <TabsTrigger 
                  value="login"
                  className="data-[state=active]:bg-fig data-[state=active]:text-white"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="register"
                  className="data-[state=active]:bg-fig data-[state=active]:text-white"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            
            <CardContent>
              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-fig font-medium">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      className="bg-white border-fig/20 focus:border-fig relative z-10"
                      required
                      data-testid="input-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-fig font-medium">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="bg-white border-fig/20 focus:border-fig relative z-10"
                      required
                      data-testid="input-password"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={loginMutation.isPending}
                    className="w-full bg-fig hover:bg-fig/90 text-white font-semibold py-3 rounded-xl relative z-10"
                    data-testid="button-submit"
                  >
                    {loginMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="space-y-4">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-fig font-medium">First Name</Label>
                      <Input
                        id="firstName"
                        placeholder="First name"
                        value={registerForm.firstName}
                        onChange={(e) => setRegisterForm({ ...registerForm, firstName: e.target.value })}
                        className="bg-white/80 border-fig/20 focus:border-fig"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-fig font-medium">Last Name</Label>
                      <Input
                        id="lastName"
                        placeholder="Last name"
                        value={registerForm.lastName}
                        onChange={(e) => setRegisterForm({ ...registerForm, lastName: e.target.value })}
                        className="bg-white/80 border-fig/20 focus:border-fig"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registerEmail" className="text-fig font-medium">Email</Label>
                    <Input
                      id="registerEmail"
                      type="email"
                      placeholder="Enter your email"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      className="bg-white/80 border-fig/20 focus:border-fig"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registerPassword" className="text-fig font-medium">Password</Label>
                    <Input
                      id="registerPassword"
                      type="password"
                      placeholder="Create a password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      className="bg-white/80 border-fig/20 focus:border-fig"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={registerMutation.isPending}
                    className="w-full bg-fig hover:bg-fig/90 text-white font-semibold py-3 rounded-xl"
                  >
                    {registerMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Information Card */}
              <div className="pt-4 border-t border-fig/10 mt-6">
                <div className="bg-white/50 rounded-lg p-3">
                  <p className="text-xs text-gray-700 leading-relaxed">
                    You are entering <strong>eReputation</strong> - a social reputation platform built on the Web 3.0 Data Space (W3DS) architecture. This system is designed around the principle of data-platform separation, where all your personal content is stored in your own sovereign eVault, not on centralised servers.
                  </p>
                </div>
              </div>
            </CardContent>
          </Tabs>
        </Card>

        {/* W3DS Logo - Outside Card */}
        <div className="flex items-center justify-center">
          <img 
            src="https://blabsy.staging.metastate.foundation/assets/w3dslogo.svg" 
            alt="W3DS" 
            className="h-6 opacity-70"
          />
        </div>
      </div>
    </div>
  );
}