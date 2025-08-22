import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Vote, UserX, Shield } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Poll } from "@shared/schema";

interface BlindVotingInterfaceProps {
  poll: Poll;
  userId: string;
  hasVoted: boolean;
  onVoteSubmitted: () => void;
}

export default function BlindVotingInterface({ poll, userId, hasVoted, onVoteSubmitted }: BlindVotingInterfaceProps) {

  const [deepLink, setDeepLink] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const { toast } = useToast();

  const createBlindVotingDeepLink = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      // Create the QR code data that the eID wallet expects
      const apiBaseUrl = process.env.NEXT_PUBLIC_EVOTING_BASE_URL || 'http://localhost:7777';
      
      // Generate a session ID for this voting session
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create the poll data for blind voting in the format the eID wallet expects
      const pollData = {
        type: "blind-vote",
        sessionId: sessionId,
        pollId: poll.id,
        platformUrl: apiBaseUrl,
        timestamp: Date.now()
      };
      
      // Encode the poll data as base64
      const encodedData = btoa(JSON.stringify(pollData));
      
      // Create the redirect URI where the signed vote will be sent
      const redirectUri = `${apiBaseUrl}/api/votes/${poll.id}/blind`;
      
      // Create the w3ds://sign URI that the eID wallet expects
      const link = `w3ds://sign?session=${sessionId}&data=${encodeURIComponent(encodedData)}&redirect_uri=${encodeURIComponent(redirectUri)}&platform_url=${encodeURIComponent(apiBaseUrl)}`;
      
      console.log('🔍 Generated w3ds://sign URI:', link);
      console.log('🔍 Session ID:', sessionId);
      console.log('🔍 Base64 data:', encodedData);
      console.log('🔍 Redirect URI:', redirectUri);
      console.log('🔍 Platform URL:', apiBaseUrl);
      console.log('🔍 Environment variable NEXT_PUBLIC_EVOTING_BASE_URL:', process.env.NEXT_PUBLIC_EVOTING_BASE_URL);
      console.log('🔍 Full redirect URI being sent:', redirectUri);
      
      setDeepLink(link);
    } catch (error) {
      console.error('Error creating blind voting deep link:', error);
      setError('Failed to create blind voting deep link');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!deepLink) {
      createBlindVotingDeepLink();
    }
  }, []);

  // Note: SSE subscription removed as it's not needed for the new blind voting system
  // The eID wallet handles the voting process locally and submits directly to the API

  if (hasVoted) {
    return (
      <div className="text-center py-8">
        <Shield className="text-blue-500 h-16 w-16 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Blind Vote Submitted</h3>
        <p className="text-gray-600">Your private vote has been submitted successfully</p>
        <p className="text-sm text-gray-500 mt-2">The vote will remain hidden until revealed</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Blind Voting Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-2">
          <UserX className="text-blue-600 w-5 h-5" />
          <h3 className="font-semibold text-blue-900">Private Blind Voting</h3>
        </div>
        <p className="text-blue-800 text-sm">
          This is a private poll. Your vote will be hidden using cryptographic commitments 
          until you choose to reveal it. Use your eID wallet to submit your vote securely.
        </p>
      </div>

      {/* Responsive QR Code Section */}
      <div className="text-center space-y-4">
        {/* Mobile: Show button, Desktop: Show QR */}
        <div className="block md:hidden">
          <Button
            onClick={() => window.open(deepLink, '_blank')}
            className="w-full btn-primary bg-blue-600 hover:bg-blue-700"
          >
            <Vote className="w-4 h-4 mr-2" />
            Open eID Wallet
          </Button>
        </div>
        
        {/* Desktop: Show QR code */}
        <div className="hidden md:block">
          <div className="inline-block">
            <QRCodeSVG
              value={deepLink}
              size={200}
              level="M"
              includeMargin={true}
            />
          </div>
          
          <div className="space-y-2 mt-4">
            <p className="text-sm text-gray-600">
              Scan this QR code with your eID wallet to submit your private vote
            </p>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">How Blind Voting Works:</h4>
        <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
          <li>Scan the QR code with your eID wallet</li>
          <li>Select your vote (Yes/No) in the wallet</li>
          <li>The wallet creates a cryptographic commitment</li>
          <li>Your vote is submitted without revealing your choice</li>
          <li>You can reveal your vote later if needed</li>
        </ol>
      </div>
    </div>
  );
} 