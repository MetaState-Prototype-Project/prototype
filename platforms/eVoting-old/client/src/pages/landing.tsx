import { Plus, Vote, Shield, UserX, TrendingUp } from "lucide-react";

export default function Landing() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Welcome to eVoting
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          A secure, digital voting platform for creating polls and gathering public or anonymous feedback
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/api/login"
            className="btn-primary inline-flex items-center"
          >
            <Vote className="w-5 h-5 mr-2" />
            Sign In to Vote
          </a>
          <a
            href="/api/login"
            className="btn-secondary inline-flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Account
          </a>
        </div>
      </div>

      {/* Features Section */}
      <div className="grid md:grid-cols-3 gap-8">
        <div className="card p-6">
          <div className="text-center">
            <div className="bg-[--crimson-100] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="text-[--crimson] h-8 w-8" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Secure Voting</h3>
            <p className="text-gray-600">One user, one vote system with secure authentication and vote tracking</p>
          </div>
        </div>
        
        <div className="card p-6">
          <div className="text-center">
            <div className="bg-[--crimson-100] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserX className="text-[--crimson] h-8 w-8" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Public & Private</h3>
            <p className="text-gray-600">Choose between public voting (transparent) or anonymous voting modes</p>
          </div>
        </div>
        
        <div className="card p-6">
          <div className="text-center">
            <div className="bg-[--crimson-100] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="text-[--crimson] h-8 w-8" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Real-time Results</h3>
            <p className="text-gray-600">View live voting results with detailed analytics and visual charts</p>
          </div>
        </div>
      </div>

      {/* Getting Started */}
      <div className="card p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Get Started with eVoting</h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Create your account to start making polls, voting on important decisions, and viewing real-time results. 
            Your voice matters in our democratic digital platform.
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="flex flex-col items-center">
              <div className="bg-[--crimson] text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mb-3">
                1
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Sign Up</h3>
              <p className="text-gray-600 text-sm">Create your secure account to get started</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-[--crimson] text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mb-3">
                2
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Create or Vote</h3>
              <p className="text-gray-600 text-sm">Start creating polls or vote on existing ones</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-[--crimson] text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mb-3">
                3
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">View Results</h3>
              <p className="text-gray-600 text-sm">See real-time results and analytics</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}