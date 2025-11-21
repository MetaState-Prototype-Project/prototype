import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiClient } from "@/lib/apiClient";
import { QRCodeSVG } from "qrcode.react";
import { isMobileDevice, getDeepLinkUrl } from "@/lib/utils/mobile-detection";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileUpload from "@/components/ui/file-upload";
import { useDebouncedCallback } from "use-debounce";

interface ReferenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TARGET_TYPES = [
  { 
    value: "user", 
    label: "User", 
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
      </svg>
    )
  },
  { 
    value: "group", 
    label: "Group", 
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
      </svg>
    )
  },
  { 
    value: "platform", 
    label: "Platform", 
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
      </svg>
    )
  }
];

const REFERENCE_TYPES = [
  { value: "professional", label: "Professional Work" },
  { value: "academic", label: "Academic Achievement" },
  { value: "character", label: "Character Reference" },
  { value: "skill", label: "Skill Endorsement" },
  { value: "leadership", label: "Leadership Qualities" }
];

export default function ReferenceModal({ open, onOpenChange }: ReferenceModalProps) {
  const [targetType, setTargetType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<any>(null);
  const [referenceText, setReferenceText] = useState("");
  const [referenceType, setReferenceType] = useState("");
  const [signingSession, setSigningSession] = useState<{ sessionId: string; qrData: string; expiresAt: string } | null>(null);
  const [signingStatus, setSigningStatus] = useState<"pending" | "connecting" | "signed" | "expired" | "error" | "security_violation">("pending");
  const [timeRemaining, setTimeRemaining] = useState<number>(900); // 15 minutes in seconds
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();


  const { data: searchResults = [], refetch, isLoading: isSearching } = useQuery({
    queryKey: ['search', targetType, searchQuery],
    queryFn: async () => {
      if (!targetType || searchQuery.length < 2) return [];
      
      if (targetType === 'platform') {
        // Search platforms using the new platform endpoint
        const response = await apiClient.get(`/api/platforms/search?q=${encodeURIComponent(searchQuery)}`);
        return response.data.platforms || response.data || [];
      } else if (targetType === 'user') {
        // Search users using existing endpoint
        const response = await apiClient.get(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
        // Ensure we return an array, handle different response structures
        return Array.isArray(response.data) ? response.data : [];
      } else if (targetType === 'group') {
        // Search groups using new endpoint
        const response = await apiClient.get(`/api/groups/search?q=${encodeURIComponent(searchQuery)}`);
        return response.data;
      }
      return [];
    },
    enabled: targetType !== "" && searchQuery.length >= 2,
  });

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/api/references', data);
      return response.data;
    },
    onSuccess: (data) => {
      // Reference created, now we need to sign it
      if (data.signingSession) {
        setSigningSession(data.signingSession);
        setSigningStatus("pending");
        const expiresAt = new Date(data.signingSession.expiresAt);
        const now = new Date();
        const secondsRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
        setTimeRemaining(Math.max(0, secondsRemaining));
        startSSEConnection(data.signingSession.sessionId);
      } else {
        // Fallback if no signing session (shouldn't happen)
        toast({
          title: "Reference Created",
          description: "Your reference has been created. Please sign it to complete.",
        });
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Failed to submit reference",
        variant: "destructive",
      });
    },
  });

  const startSSEConnection = (sessionId: string) => {
    // Prevent multiple SSE connections
    if (eventSource) {
      eventSource.close();
    }
    
    // Connect to the backend SSE endpoint for signing status
    const baseURL = import.meta.env.VITE_EREPUTATION_BASE_URL || "http://localhost:8765";
    const sseUrl = `${baseURL}/api/references/signing/session/${sessionId}/status`;
    
    const newEventSource = new EventSource(sseUrl);
    
    newEventSource.onopen = () => {
      console.log("SSE connection established for reference signing");
    };
    
    newEventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        
        if (data.type === "signed" && data.status === "completed") {
          setSigningStatus("signed");
          newEventSource.close();
          
          toast({
            title: "Reference Signed!",
            description: "Your eReference has been successfully signed and submitted.",
          });
          
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
          
          // Close modal and reset after a short delay
          setTimeout(() => {
            onOpenChange(false);
            resetForm();
          }, 1500);
        } else if (data.type === "expired") {
          setSigningStatus("expired");
          newEventSource.close();
          toast({
            title: "Session Expired",
            description: "The signing session has expired. Please try again.",
            variant: "destructive",
          });
        } else if (data.type === "security_violation") {
          setSigningStatus("security_violation");
          newEventSource.close();
          toast({
            title: "eName Verification Failed",
            description: "eName verification failed. Please check your eID.",
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
      setSigningStatus("error");
    };

    setEventSource(newEventSource);
  };

  // Countdown timer
  useEffect(() => {
    if (signingStatus === "pending" && timeRemaining > 0 && signingSession) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setSigningStatus("expired");
            if (eventSource) {
              eventSource.close();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [signingStatus, timeRemaining, signingSession, eventSource]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);

  // Reset signing state when modal closes
  useEffect(() => {
    if (!open) {
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }
      setSigningSession(null);
      setSigningStatus("pending");
      setTimeRemaining(900);
    }
  }, [open, eventSource]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetForm = () => {
    setTargetType("");
    setSearchQuery("");
    setSelectedTarget(null);
    setReferenceText("");
    setReferenceType("");
    setSigningSession(null);
    setSigningStatus("pending");
    setTimeRemaining(900);
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Don't automatically set selected target, let user pick from results
    if (!value.trim()) {
      setSelectedTarget(null);
    }
  };

  const handleSelectTarget = (target: any) => {
    setSelectedTarget(target);
    // Use name, ename, or handle as fallback
    setSearchQuery(target.name || target.ename || target.handle || 'Unknown');
  };

  const handleSubmit = () => {
    if (!targetType) {
      toast({
        title: "Invalid Selection",
        description: "Please select a target type",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTarget) {
      toast({
        title: "Invalid Selection",
        description: "Please select who you want to reference",
        variant: "destructive",
      });
      return;
    }

    if (!referenceText.trim()) {
      toast({
        title: "Missing Information",
        description: "Please write a reference text",
        variant: "destructive",
      });
      return;
    }



    if (referenceText.length > 500) {
      toast({
        title: "Text Too Long",
        description: "Please keep your reference under 500 characters",
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate({
      targetType,
      targetId: selectedTarget.id,
      targetName: selectedTarget.name || selectedTarget.ename || selectedTarget.handle || 'Unknown',
      content: referenceText,
      referenceType: 'general'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-full sm:max-w-2xl h-screen sm:h-[90vh] mx-0 sm:mx-4 overflow-hidden bg-fig-10 border-0 sm:border-2 border-fig/20 shadow-2xl rounded-none sm:rounded-xl flex flex-col">
        <DialogHeader className="bg-transparent text-fig p-3 sm:p-6 -m-6 mb-0 rounded-t-xl flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex w-12 h-12 bg-fig rounded-2xl items-center justify-center flex-shrink-0 transform rotate-12">
              <svg className="w-6 h-6 text-swiss-cheese transform -rotate-12" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base sm:text-2xl font-black text-fig leading-tight">Send an eReference</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-fig/70 font-medium mt-1 leading-tight">Provide professional eReferences throughout the W3DS</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="p-3 sm:p-6 flex-1 overflow-y-auto">
          {signingSession ? (
            // Signing Interface
            <div className="flex flex-col items-center justify-center space-y-6 py-8">
              <div className="text-center">
                <h3 className="text-xl font-black text-fig mb-2">Sign Your eReference</h3>
                <p className="text-sm text-fig/70">
                  Scan this QR code with your eID Wallet to sign your eReference
                </p>
              </div>

              {signingSession.qrData && (
                <>
                  {isMobileDevice() ? (
                    <div className="flex flex-col gap-4 items-center">
                      <a
                        href={getDeepLinkUrl(signingSession.qrData)}
                        className="px-6 py-3 bg-fig text-white rounded-xl hover:bg-fig/90 transition-colors text-center font-bold"
                      >
                        Sign eReference with eID Wallet
                      </a>
                      <div className="text-xs text-fig/70 text-center max-w-xs">
                        Click the button to open your eID wallet app and sign your eReference
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white p-4 rounded-xl border-2 border-fig/20">
                      <QRCodeSVG
                        value={signingSession.qrData}
                        size={200}
                        level="M"
                        includeMargin={true}
                      />
                    </div>
                  )}
                </>
              )}

              <div className="space-y-2 text-center">
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 text-fig/70" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-fig/70">
                    Session expires in {formatTime(timeRemaining)}
                  </span>
                </div>
                
                {signingStatus === "signed" && (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-bold">Reference Signed Successfully!</span>
                  </div>
                )}

                {signingStatus === "expired" && (
                  <div className="flex items-center justify-center gap-2 text-red-600">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="font-bold">Session Expired</span>
                  </div>
                )}

                {signingStatus === "security_violation" && (
                  <div className="flex items-center justify-center gap-2 text-red-600">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="font-bold">eName Verification Failed</span>
                  </div>
                )}
              </div>

              {(signingStatus === "expired" || signingStatus === "security_violation" || signingStatus === "error") && (
                <Button
                  onClick={() => {
                    setSigningSession(null);
                    setSigningStatus("pending");
                    setTimeRemaining(900);
                    if (eventSource) {
                      eventSource.close();
                      setEventSource(null);
                    }
                  }}
                  className="bg-fig hover:bg-fig/90 text-white"
                >
                  Try Again
                </Button>
              )}
            </div>
          ) : (
            // Reference Form
            <div className="space-y-4 sm:space-y-6">
            {/* Target Selection */}
            <div>
              <h4 className="text-base sm:text-lg font-black text-fig mb-3 sm:mb-4">Select eReference Target</h4>
              <RadioGroup value={targetType} onValueChange={setTargetType}>
                <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-3">
                  {TARGET_TYPES.map((type) => (
                    <Label
                      key={type.value}
                      className={`flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-4 border-2 rounded-2xl cursor-pointer transition-all duration-200 ${
                        targetType === type.value
                          ? 'border-fig/40 bg-fig-30'
                          : 'border-fig/20 hover:border-fig/30 hover:bg-fig-10'
                      }`}
                    >
                      <RadioGroupItem value={type.value} className="sr-only" />
                      <div className="w-8 h-8 sm:w-12 sm:h-12 bg-fig rounded-2xl flex items-center justify-center text-swiss-cheese">
                        {type.icon}
                      </div>
                      <span className="font-black text-fig text-xs sm:text-sm">{type.label}</span>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            
            {/* Search Target */}
            <div>
              <Label className="block text-sm font-black text-fig mb-2">
                Find eReference Target
              </Label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search for who you want to reference..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 border-2 border-fig/20 focus:border-fig/40 focus:ring-fig/20 rounded-2xl"
                  disabled={!targetType}
                />
                <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-swiss-cheese" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
                
                {/* Search Results Dropdown - Absolute positioned overlay */}
                {searchQuery.length >= 2 && !selectedTarget && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border-2 border-fig/20 rounded-2xl shadow-xl max-h-48 overflow-y-auto">
                    {isSearching ? (
                      <div className="px-4 py-3 text-center text-fig/70">
                        <div className="w-4 h-4 border-2 border-fig border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        Searching...
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((result: any, index: number) => (
                        <button
                          key={result.id}
                          onClick={() => handleSelectTarget(result)}
                          className="w-full text-left px-4 py-3 hover:bg-fig-10 transition-colors border-b border-fig/10 last:border-b-0 first:rounded-t-2xl last:rounded-b-2xl"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-fig/10 rounded-lg flex items-center justify-center">
                              {targetType === 'platform' ? (
                                <svg className="w-4 h-4 text-fig" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4 text-fig" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-fig truncate">
                                {result.name || result.ename || result.handle || 'Unknown'}
                              </div>
                              <div className="text-xs text-fig/70">
                                {(targetType === 'user' || targetType === 'group') ? (
                                  result.ename ? (result.ename.startsWith('@') ? result.ename : `@${result.ename}`) : 'no ename'
                                ) : (
                                  <span className="capitalize">{result.type || result.category || targetType}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-center text-fig/70">
                        No {targetType}s found for "{searchQuery}"
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Selected Target Display */}
              {selectedTarget && (
                <div className="mt-2 p-3 border-2 border-fig/20 rounded-2xl bg-fig-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <svg className="w-4 h-4 text-swiss-cheese flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="font-black text-fig truncate">
                        {selectedTarget.name || selectedTarget.ename || selectedTarget.handle || 'Unknown'}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedTarget(null);
                        setSearchQuery("");
                      }}
                      className="text-fig/50 hover:text-fig"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Reference Text */}
            <div>
              <Label className="block text-sm font-black text-fig mb-2">
                eReference Text
              </Label>
              <Textarea
                placeholder="Write your professional eReference here. Include specific examples of work quality, collaboration, achievements, and professional character..."
                value={referenceText}
                onChange={(e) => setReferenceText(e.target.value)}
                className="h-32 resize-none border-2 border-fig/20 focus:border-fig/40 focus:ring-fig/20 rounded-2xl"
                maxLength={500}
              />
              <div className={`text-right text-sm mt-1 font-medium ${referenceText.length > 500 ? 'text-apple-red' : 'text-fig/70'}`}>
                {referenceText.length} / 500 characters
              </div>
            </div>
            </div>
          )}
        </div>
        
        {!signingSession && (
          <div className="border-t-2 border-fig/20 p-4 sm:p-6 bg-fig-10 -m-6 mt-0 rounded-b-xl flex-shrink-0">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={submitMutation.isPending}
                className="order-2 sm:order-1 flex-1 border-2 border-fig/30 text-fig/70 hover:bg-fig-10 hover:border-fig/40 font-bold h-11 sm:h-12 opacity-80"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={submitMutation.isPending || !targetType || !selectedTarget || !referenceText.trim()}
                className="order-1 sm:order-2 flex-1 bg-fig hover:bg-fig/90 text-white font-bold h-11 sm:h-12 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {submitMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    Sign & Submit eReference
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
        
        {signingSession && signingStatus !== "signed" && (
          <div className="border-t-2 border-fig/20 p-4 sm:p-6 bg-fig-10 -m-6 mt-0 rounded-b-xl flex-shrink-0">
            <Button 
              variant="outline" 
              onClick={() => {
                setSigningSession(null);
                setSigningStatus("pending");
                if (eventSource) {
                  eventSource.close();
                  setEventSource(null);
                }
              }}
              className="w-full border-2 border-fig/30 text-fig/70 hover:bg-fig-10 hover:border-fig/40 font-bold h-11 sm:h-12"
            >
              Cancel
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
