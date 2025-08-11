"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

export default function DisclaimerModal() {
    const { logout } = useAuth();
    const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
    return (
        <>
            {!disclaimerAccepted ? (
                <Dialog open>
                    <DialogContent
                        className="max-w-lg mx-auto backdrop-blur-md p-6 rounded-lg"
                        onInteractOutside={() => logout()}
                    >
                        <DialogHeader>
                            <DialogTitle className="text-xl text-center font-bold">
                                Disclaimer from MetaState Foundation
                            </DialogTitle>
                            <DialogDescription asChild>
                                <div className="flex flex-col gap-2">
                                    <p className="font-bold">⚠️ Please note:</p>
                                    <p>
                                        Group Charter is a{" "}
                                        <b>functional prototype</b>, intended to
                                        showcase <b>interoperability</b> and
                                        core concepts of the W3DS ecosystem.
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
                        <DialogFooter>
                            <Button
                                type="button"
                                onClick={() => {
                                    setDisclaimerAccepted(true);
                                }}
                            >
                                I Understand
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            ) : (
                <></>
            )}
        </>
    );
}
