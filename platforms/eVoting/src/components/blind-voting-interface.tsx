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
  const [isQrVisible, setIsQrVisible] = useState(false);
  const [deepLink, setDeepLink] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const { toast } = useToast();

  const createBlindVotingDeepLink = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      // First, create a blind vote session
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7777';
      const sessionResponse = await fetch(`${apiBaseUrl}/api/blind-vote/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pollId: poll.id,
          userId: userId
        })
      });

      if (!sessionResponse.ok) {
        throw new Error('Failed to create blind vote session');
      }

      const sessionData = await sessionResponse.json();
      const { sessionId, platformUrl } = sessionData;

      // Create the poll data for blind voting with session ID
      const pollData = {
        pollId: poll.id,
        sessionId: sessionId,
        type: "blind-vote",
        timestamp: Date.now()
      };
      
      // Encode the poll data
      const encodedData = btoa(JSON.stringify(pollData));
      
      // Create the redirect URI where the signed vote will be sent
      // Use the platformUrl from the session response
      const redirectUri = `${platformUrl}/api/votes/blind`;
      
      // Format: w3ds://sign?session=<sessionId>&data=<base64Data>&redirect_uri=<redirectUri>&platform_url=<platformUrl>
      const link = `w3ds://sign?session=${sessionId}&data=${encodedData}&redirect_uri=${encodeURIComponent(redirectUri)}&platform_url=${encodeURIComponent(platformUrl)}`;
      
      setDeepLink(link);
    } catch (error) {
      console.error('Error creating blind vote session:', error);
      setError('Failed to create blind vote session');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isQrVisible && !deepLink) {
      createBlindVotingDeepLink();
    }
  }, [isQrVisible]);

  // Subscribe to SSE for real-time blind vote updates
  useEffect(() => {
    if (!poll?.id) return;

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7777';
    const eventSource = new EventSource(`${apiBaseUrl}/api/polls/${poll.id}/blind-vote-sse`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('SSE message received:', data);
        
        if (data.type === 'blind_vote_submitted') {
          // A blind vote was submitted, refresh the poll data
          console.log('Blind vote submitted, refreshing poll data...');
          // You can call a callback here to refresh the parent component
          if (onVoteSubmitted) {
            onVoteSubmitted();
          }
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
    };

    return () => {
      eventSource.close();
    };
  }, [poll?.id, onVoteSubmitted]);

  const handleShowQR = () => {
    setIsQrVisible(true);
  };

  const handleHideQR = () => {
    setIsQrVisible(false);
  };

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

      {/* QR Code Section */}
      {!isQrVisible ? (
        <div className="text-center">
          <Button
            onClick={handleShowQR}
            className="w-full btn-primary bg-blue-600 hover:bg-blue-700"
          >
            <Vote className="w-4 h-4 mr-2" />
            Show QR Code for Blind Voting
          </Button>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <div className="bg-white p-6 rounded-lg border-2 border-blue-200 inline-block">
            <QRCodeSVG
              value={deepLink}
              size={200}
              level="M"
              includeMargin={true}
            />
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Scan this QR code with your eID wallet to submit your private vote
            </p>
            <p className="text-xs text-gray-500">
              Or copy the link: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{deepLink}</code>
            </p>
          </div>

          <div className="flex space-x-2">
            <Button
              onClick={handleHideQR}
              variant="outline"
              className="flex-1"
            >
              Hide QR Code
            </Button>
            <Button
              onClick={() => window.open(deepLink, '_blank')}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              Open eID Wallet
            </Button>
          </div>
        </div>
      )}

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