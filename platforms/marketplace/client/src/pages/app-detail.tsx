import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ExternalLink, ArrowLeft, Store } from "lucide-react";
import appsData from "@/data/apps.json";

// Mock detailed descriptions for each app
const appDetails: Record<string, { fullDescription: string; screenshots: string[] }> = {
  "eid-wallet": {
    fullDescription: "eID for W3DS is a comprehensive digital identity solution that puts you in control of your personal information. Built on the W3DS framework, it provides secure authentication, verifiable credentials, and seamless integration across the MetaState ecosystem.\n\nWith advanced cryptographic protocols and user-centric design, eID for W3DS ensures your identity remains sovereign and under your control at all times.",
    screenshots: []
  },
  "blabsy": {
    fullDescription: "Blabsy is a decentralized micro-blogging platform where you own your content and control your data. Share your thoughts, engage with communities, and build your network while maintaining full sovereignty over your digital presence.\n\nExperience social media reimagined with privacy-first principles and community-driven governance.",
    screenshots: []
  },
  "pictique": {
    fullDescription: "Pictique revolutionizes photo sharing with privacy-first principles. Share your moments with complete control over who sees what, when, and for how long. All while maintaining ownership of your precious memories.\n\nBuilt on the W3DS framework, Pictique ensures your photos are stored securely and shared on your terms.",
    screenshots: []
  },
  "evoting": {
    fullDescription: "eVoting brings democracy to the digital age with end-to-end verifiable elections. Using advanced cryptographic techniques, every vote is counted accurately while maintaining voter privacy. Perfect for organizations, communities, and governance bodies.\n\nTransparent, secure, and verifiable - democracy as it should be.",
    screenshots: []
  },
  "group-charter": {
    fullDescription: "Charter Manager empowers communities to establish clear governance structures. Create charters, define rules, manage memberships, and ensure transparent decision-making processes. Build self-sovereign communities with accountable governance.\n\nFrom small groups to large organizations, Charter Manager provides the tools you need for effective community governance.",
    screenshots: []
  },
  "dreamsync": {
    fullDescription: "DreamSync helps you discover meaningful connections based on shared interests, values, and aspirations. Navigate the W3DS ecosystem to find individuals who resonate with your vision and collaborate on projects that matter.\n\nConnect, collaborate, and create together in the decentralized future.",
    screenshots: []
  }
};

export default function AppDetailPage() {
  const [, params] = useRoute("/app/:id");
  const appId = params?.id;

  const app = appsData.find(a => a.id === appId);
  const details = appId ? appDetails[appId] : null;


  if (!app) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Store className="w-20 h-20 text-gray-300 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-black mb-4">App not found</h2>
          <p className="text-gray-600 font-medium mb-6">The app you're looking for doesn't exist.</p>
          <Link href="/">
            <Button className="text-black font-bold px-8 py-4 rounded-full hover:scale-105 transition-transform duration-200" style={{ backgroundColor: 'hsl(85, 100%, 85%)' }}>
              Back to marketplace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back button */}
        <Link href="/">
          <Button className="mb-8 text-black font-bold px-6 py-3 rounded-full hover:scale-105 transition-all duration-200 border-2 border-gray-200 bg-white hover:border-black">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to marketplace
          </Button>
        </Link>

        {/* App header */}
        <div className="bg-white rounded-3xl p-8 border border-gray-100 mb-8">
          <div className="flex items-start space-x-6 mb-6">
            {app.logoUrl ? (
              <img 
                src={app.logoUrl} 
                alt={`${app.name} logo`} 
                className="w-24 h-24 rounded-2xl object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'hsl(270, 100%, 85%)' }}>
                <Store className="w-12 h-12 text-black" />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-4xl font-black text-black mb-3">{app.name}</h1>
              <p className="text-gray-700 text-lg font-medium mb-4">{app.description}</p>
              <div className="flex items-center space-x-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide px-3 py-1 bg-gray-100 rounded-full">
                  {app.category}
                </div>
              </div>
            </div>
          </div>

          <div className="flex space-x-4">
            {(app as any).appStoreUrl && (app as any).playStoreUrl ? (
              <>
                <a href={(app as any).appStoreUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button className="w-full text-black font-bold px-8 py-4 rounded-full hover:scale-105 transition-all duration-200" style={{ backgroundColor: 'hsl(85, 100%, 85%)' }}>
                    <ExternalLink className="w-5 h-5 mr-3" />
                    App Store
                  </Button>
                </a>
                <a href={(app as any).playStoreUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button className="w-full text-black font-bold px-8 py-4 rounded-full hover:scale-105 transition-all duration-200" style={{ backgroundColor: 'hsl(270, 100%, 85%)' }}>
                    <ExternalLink className="w-5 h-5 mr-3" />
                    Play Store
                  </Button>
                </a>
              </>
            ) : (
              <a href={(app as any).url} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button className="w-full text-black font-bold px-8 py-4 rounded-full hover:scale-105 transition-all duration-200" style={{ backgroundColor: 'hsl(85, 100%, 85%)' }}>
                  <ExternalLink className="w-5 h-5 mr-3" />
                  Visit Website
                </Button>
              </a>
            )}
          </div>
        </div>

        {/* Description */}
        {details?.fullDescription && (
          <div className="bg-white rounded-3xl p-8 border border-gray-100 mb-8">
            <h3 className="text-2xl font-black text-black mb-6">About this app</h3>
            <div className="prose-lg max-w-none">
              {details.fullDescription.split('\n').map((paragraph, index) => (
                <p key={index} className="text-gray-700 font-medium mb-4 last:mb-0 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Reviews Section - Coming Soon */}
        <div className="bg-white rounded-3xl p-8 border border-gray-100">
          <div className="text-center py-12">
            <h3 className="text-2xl font-black text-black mb-4">Reviews & Ratings</h3>
            <p className="text-gray-600 font-medium text-lg">Reviews feature coming soon</p>
          </div>
        </div>

        {/* 
        Reviews section commented out for future implementation
        
        <div className="bg-white rounded-3xl p-8 border border-gray-100">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-black text-black">Reviews & Ratings</h3>
            <Button 
              onClick={() => setShowReviewForm(!showReviewForm)}
              className="text-black font-bold px-6 py-3 rounded-full hover:scale-105 transition-all duration-200 border-2 border-gray-200 bg-white hover:border-black"
            >
              {showReviewForm ? "Cancel" : "Write Review"}
            </Button>
          </div>
          ... rest of reviews code ...
        </div>
        */}
      </div>
    </div>
  );
}
