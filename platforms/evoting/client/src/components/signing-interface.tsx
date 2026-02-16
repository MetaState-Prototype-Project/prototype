"use client";

import { useState, useEffect, useRef } from "react";
import { useQRCode } from "next-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { pollApi } from "@/lib/pollApi";
import { useAuth } from "@/lib/auth-context";
import { isMobileDevice, getDeepLinkUrl } from "@/lib/utils/mobile-detection";

interface SigningInterfaceProps {
  pollId: string | number;
  voteData: any;
  onSigningComplete: (voteId: string) => void;
  onCancel: () => void;
}

export function SigningInterface({ pollId, voteData, onSigningComplete, onCancel }: SigningInterfaceProps) {
  const { SVG } = useQRCode();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [status, setStatus] = useState<"pending" | "connecting" | "signed" | "expired" | "error" | "security_violation">("pending");
  const [timeRemaining, setTimeRemaining] = useState<number>(900); // 15 minutes in seconds
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const hasCreatedSession = useRef(false);

  const createSession = async () => {
    if (!user?.id || hasCreatedSession.current || status === "error") {
      return;
    }

    try {
      setStatus("connecting");
      const session = await pollApi.createSigningSession(pollId.toString(), voteData, user.id);
      setSessionId(session.sessionId);
      setQrData(session.qrData);
      setStatus("pending");
      hasCreatedSession.current = true;
      startSSEConnection(session.sessionId);
    } catch (error) {
      console.error("Failed to create signing session:", error);
      setStatus("error");
    }
  };

  useEffect(() => {
    if (!user?.id || hasCreatedSession.current || status === "error") {
      return;
    }
    
    createSession();
  }, [pollId, voteData, user?.id]); // Removed status dependency to prevent infinite loops

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);

  const startSSEConnection = (sessionId: string) => {
    // Prevent multiple SSE connections
    if (eventSource) {
      eventSource.close();
    }
    
    // Connect to the backend SSE endpoint for signing status
    // Use the same base URL as apiClient to avoid going to frontend
    const baseURL = process.env.NEXT_PUBLIC_EVOTING_BASE_URL || "http://localhost:7777";
    const sseUrl = `${baseURL}/api/signing/sessions/${sessionId}/status`;
    
    const newEventSource = new EventSource(sseUrl);
    
    newEventSource.onopen = () => {
    };
    
    newEventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        
        if (data.type === "signed" && data.status === "completed") {
          setStatus("signed");
          
          toast({
            title: "Vote Signed!",
            description: "Your vote has been successfully signed and submitted",
          });
          onSigningComplete(data.voteId);
        } else if (data.type === "expired") {
          setStatus("expired");
          toast({
            title: "Session Expired",
            description: "The signing session has expired. Please try again.",
            variant: "destructive",
          });
        } else if (data.type === "security_violation") {
          setStatus("security_violation");
          toast({
            title: "Security Violation",
            description: data.error || "Public key verification failed",
            variant: "destructive",
          });
        } else {
        }
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };

    newEventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      setStatus("error");
    };

    setEventSource(newEventSource);
  };

  // Countdown timer
  useEffect(() => {
    if (status === "pending" && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setStatus("expired");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [status, timeRemaining]);

  // Cleanup SSE connection
  useEffect(() => {
    return () => {
      // Only close SSE connection if signing is not complete or if there's a security violation
      if (eventSource && status !== "signed" && status !== "security_violation") {
        eventSource.close();
      }
    };
  }, [eventSource, status]);

  // Additional cleanup when signing is complete or security violation occurs
  useEffect(() => {
    if ((status === "signed" || status === "security_violation") && eventSource) {
      eventSource.close();
    }
  }, [status, eventSource]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (status === "connecting") {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle>Connecting to eID Wallet</CardTitle>
          <CardDescription>
            Please open your eID Wallet and scan the QR code
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-600">
            Waiting for connection...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Error
          </CardTitle>
          <CardDescription>
            Failed to create signing session
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
          <Button onClick={onCancel} variant="secondary">
            Cancel
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === "expired") {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Session Expired
          </CardTitle>
          <CardDescription>
            The signing session has expired
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <Button onClick={() => window.location.reload()} variant="outline">
            Start New Session
          </Button>
          <Button onClick={onCancel} variant="secondary">
            Cancel
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === "security_violation") {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Security Violation
          </CardTitle>
                  <CardDescription>
          eName verification failed
        </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-red-800 text-sm">
              eName Mismatch: It appears that you are trying to sign with the wrong eName. 
              Please make sure you are signing with the right eID linked to this account.
            </p>
          </div>
          <Button onClick={onCancel} variant="secondary">
            Close
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === "signed") {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Vote Signed Successfully!
          </CardTitle>
          <CardDescription>
            Your vote has been submitted
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-green-800 text-sm">
              Your vote has been securely signed. 
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle>Sign Your Vote</CardTitle>
        <CardDescription>
          Scan this QR code with your eID Wallet to sign and submit your vote
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        {qrData && (
          <>
            {isMobileDevice() ? (
              <div className="flex flex-col gap-4 items-center">
                <a
                  href={getDeepLinkUrl(qrData)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center"
                >
                  Sign Vote with eID Wallet
                </a>
                <div className="text-xs text-gray-500 text-center max-w-xs">
                  Click the button to open your eID wallet app and sign your vote
                </div>
              </div>
            ) : (
              <div className="bg-white p-4 rounded-lg inline-block">
                <SVG
                  text={qrData}
                  options={{
                    margin: 2,
                    width: 200,
                    color: {
                      dark: "#000000",
                      light: "#FFFFFF",
                    },
                  }}
                />
              </div>
            )}
          </>
        )}
        
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Session expires in {formatTime(timeRemaining)}
            </span>
          </div>
          
          <Badge variant="secondary" className="text-xs">
            Poll ID: {pollId}
          </Badge>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          {isMobileDevice() ? (
            <>
              <p>1. Click the button above</p>
              <p>2. Your eID wallet app will open</p>
              <p>3. Review and sign the message</p>
              <p>4. Your vote will be submitted automatically</p>
            </>
          ) : (
            <>
              <p>1. Open your eID Wallet app</p>
              <p>2. Scan this QR code</p>
              <p>3. Review and sign the message</p>
              <p>4. Your vote will be submitted automatically</p>
            </>
          )}
        </div>

        <Button onClick={onCancel} variant="outline" className="w-full">
          Cancel
        </Button>
      </CardContent>
    </Card>
  );
} 