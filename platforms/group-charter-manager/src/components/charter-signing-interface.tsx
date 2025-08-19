"use client";

import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/hooks/useAuth";
import { isMobileDevice, getDeepLinkUrl } from "@/lib/utils/mobile-detection";

interface CharterSigningInterfaceProps {
  groupId: string;
  charterData: any;
  onSigningComplete: (groupId: string) => void;
  onCancel: () => void;
  onSigningStatusUpdate?: (participantId: string, hasSigned: boolean) => void;
}

export function CharterSigningInterface({ groupId, charterData, onSigningComplete, onCancel, onSigningStatusUpdate }: CharterSigningInterfaceProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [status, setStatus] = useState<"pending" | "connecting" | "signed" | "expired" | "error">("pending");
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
      const session = await apiClient.post("/api/signing/sessions", {
        groupId,
        charterData
      });
      setSessionId(session.data.sessionId);
      setQrData(session.data.qrData);
      setStatus("pending");
      hasCreatedSession.current = true;
      startSSEConnection(session.data.sessionId);
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
  }, [groupId, charterData, user?.id]);

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
    const baseURL = process.env.NEXT_PUBLIC_GROUP_CHARTER_BASE_URL || 'http://localhost:3003';
    const sseUrl = `${baseURL}/api/signing/sessions/${sessionId}/status`;
    
    const newEventSource = new EventSource(sseUrl);
    
    newEventSource.onopen = () => {
      console.log("SSE connection established");
    };
    
    newEventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        
        if (data.type === "signed" && data.status === "completed") {
          setStatus("signed");
          
          // Immediately update the parent component's signing status
          if (onSigningStatusUpdate && user?.id) {
            onSigningStatusUpdate(user.id, true);
          }
          
          toast({
            title: "Charter Signed!",
            description: "Your charter has been successfully signed",
          });
          onSigningComplete(data.groupId);
        } else if (data.type === "expired") {
          setStatus("expired");
          toast({
            title: "Session Expired",
            description: "The signing session has expired. Please try again.",
            variant: "destructive",
          });
        } else {
          console.log("SSE message:", data);
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
      // Only close SSE connection if signing is not complete
      if (eventSource && status !== "signed") {
        eventSource.close();
      }
    };
  }, [eventSource, status]);

  // Additional cleanup when signing is complete
  useEffect(() => {
    if (status === "signed" && eventSource) {
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

  if (status === "signed") {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Charter Signed Successfully!
          </CardTitle>
          <CardDescription>
            Your charter has been signed
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-green-800 text-sm">
              Your charter has been securely signed. 
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle>Sign Your Charter</CardTitle>
        <CardDescription>
          Scan this QR code with your eID Wallet to sign your charter
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
                  Sign Charter with eID Wallet
                </a>
                <div className="text-xs text-gray-500 text-center max-w-xs">
                  Click the button to open your eID wallet app and sign your charter
                </div>
              </div>
            ) : (
              <div className="bg-white p-4 rounded-lg inline-block">
                <QRCodeSVG
                  value={qrData}
                  size={200}
                  level="M"
                  includeMargin={true}
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
            Session: {sessionId?.substring(0, 8)}...
          </Badge>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          {isMobileDevice() ? (
            <>
              <p>1. Click the button above</p>
              <p>2. Your eID wallet app will open</p>
              <p>3. Review and sign the message</p>
              <p>4. Your charter will be signed automatically</p>
            </>
          ) : (
            <>
              <p>1. Open your eID Wallet app</p>
              <p>2. Scan this QR code</p>
              <p>3. Review and sign the message</p>
              <p>4. Your charter will be signed automatically</p>
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