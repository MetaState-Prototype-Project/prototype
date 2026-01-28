"use client";
import Navigation from "@/components/navigation";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { cn } from "@/lib/utils";

const DISCLAIMER_KEY = "evoting-disclaimer-accepted";

// Deeplink handling for reveal functionality
declare global {
    interface WindowEventMap {
        deepLinkReveal: CustomEvent<{ pollId: string }>;
    }
}

export default function AppLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const { logout } = useAuth();
    const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
    const [isPulsing, setIsPulsing] = useState(false);
    const [showHint, setShowHint] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const accepted = localStorage.getItem(DISCLAIMER_KEY) === "true";
        if (accepted) {
            setDisclaimerAccepted(true);
        }
    }, []);

    const handleInteractOutside = (e: Event) => {
        e.preventDefault();
        setIsPulsing(true);
        setShowHint(true);
        setTimeout(() => setIsPulsing(false), 400);
    };

    // Handle deeplink reveal requests
    useEffect(() => {
        const handleDeepLinkReveal = (event: CustomEvent<{ pollId: string }>) => {
            console.log("🔍 Deep link reveal request received:", event.detail);
            const { pollId } = event.detail;

            // Navigate to the poll page to show reveal interface
            router.push(`/${pollId}`);

            // Store the reveal request in sessionStorage for the poll page to pick up
            sessionStorage.setItem("revealRequest", JSON.stringify({ pollId, timestamp: Date.now() }));
        };

        // Listen for deeplink reveal events
        window.addEventListener("deepLinkReveal", handleDeepLinkReveal as EventListener);

        // Cleanup
        return () => {
            window.removeEventListener("deepLinkReveal", handleDeepLinkReveal as EventListener);
        };
    }, [router]);

    if (disclaimerAccepted) {
        return (
            <ProtectedRoute>
                <>
                    <Navigation />
                    {children}
                </>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <>
                <Navigation />
                {children}
                <Dialog open>
                    <DialogContent
                        className={cn(
                            "max-w-lg mx-auto backdrop-blur-md p-6 rounded-lg",
                            isPulsing && "animate-pulse-scale"
                        )}
                        style={{
                            animationName: isPulsing ? 'pulse-scale' : 'none'
                        }}
                        hideCloseButton={true}
                        onInteractOutside={handleInteractOutside}
                    >
                        <style jsx>{`
                            @keyframes pulse-scale {
                                0% { transform: scale(1); }
                                25% { transform: scale(1.01); }
                                50% { transform: scale(0.99); }
                                75% { transform: scale(1.005); }
                                100% { transform: scale(1); }
                            }
                        `}</style>
                        <DialogHeader>
                            <DialogTitle className="text-xl text-center font-bold">
                                Disclaimer from MetaState Foundation
                            </DialogTitle>
                            <DialogDescription asChild>
                                <div className="flex flex-col gap-2">
                                    <p className="font-bold">⚠️ Please note:</p>
                                    <p>
                                        eVoting is a <b>functional prototype</b>
                                        , intended to showcase{" "}
                                        <b>interoperability</b> and core
                                        concepts of the W3DS ecosystem.
                                    </p>
                                    <p>
                                        <b>
                                            It is not a production-grade
                                            platform
                                        </b>{" "}
                                        and may lack full reliability,
                                        performance, and security guarantees.
                                    </p>
                                    <p>
                                        We <b>strongly recommend</b> that you
                                        avoid sharing{" "}
                                        <b>sensitive or private content</b>, and
                                        kindly ask for your understanding
                                        regarding any bugs, incomplete features,
                                        or unexpected behaviours.
                                    </p>
                                    <p>
                                        The app is still in development, so we
                                        kindly ask for your understanding
                                        regarding any potential issues. If you
                                        experience issues or have feedback, feel
                                        free to contact us at:
                                    </p>
                                    <a
                                        href="mailto:info@metastate.foundation"
                                        className="outline-none"
                                    >
                                        info@metastate.foundation
                                    </a>
                                </div>
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex-col sm:flex-col gap-3">
                            <TooltipProvider>
                                <Tooltip open={showHint}>
                                    <TooltipTrigger asChild>
                                        <Button
                                            type="button"
                                            className="w-full"
                                            onClick={() => {
                                                localStorage.setItem(DISCLAIMER_KEY, "true");
                                                setDisclaimerAccepted(true);
                                            }}
                                        >
                                            I Understand
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="max-w-xs bg-red-100 text-red-800 border border-red-300">
                                        <p className="text-xs">
                                            You must accept the disclaimer to continue. This will only appear once.
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </>
        </ProtectedRoute>
    );
}
