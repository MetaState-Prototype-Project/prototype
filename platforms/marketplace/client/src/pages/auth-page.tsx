import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: 'hsl(270, 100%, 85%)' }}>
              <Shield className="w-8 h-8 text-black" />
            </div>
            <h2 className="text-4xl font-black text-black mb-4">Authentication Disabled</h2>
            <p className="text-gray-600 font-medium mb-8">
              This marketplace is running in UI-only mode without database authentication.
            </p>
            <Link href="/">
              <Button 
                className="text-black font-bold px-8 py-4 rounded-full hover:scale-105 transition-all duration-200"
                style={{ backgroundColor: 'hsl(85, 100%, 85%)' }}
              >
                Go to Marketplace
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}