"use client";
import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function RegisterPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async () => {
        setError("");
        const res = await authClient.signUp.email({
            email,
            name: displayName,
            password,
        });
        if (res.error?.message) {
            setError(res.error.message);
            return;
        }
        router.push("/login");
    };

    return (
        <div className="flex flex-col h-screen items-center justify-center gap-4">
            <div className="flex flex-col items-center text-center gap-4">
                <div className="flex items-center gap-2 text-2xl font-bold">
                    <img src="/Logo.png" alt="eVoting Logo" className="w-12" />
                    eVoting
                </div>
                <p className="text-2xl">Join the W3DS</p>
            </div>

            <Card className="flex flex-col items-center gap-4 w-1/3 p-4">
                <CardHeader className="text-foreground text-3xl font-black">
                    Create your eVoting Account
                </CardHeader>
                <div className="flex flex-col gap-4 text-muted-foreground items-center w-full">
                    <Input
                        placeholder="Choose a email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                    />
                    <Input
                        placeholder="Choose a display name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        type="text"
                    />
                    <Input
                        placeholder="Create a password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type="password"
                    />
                    {error && (
                        <p className="text-red-500 text-sm font-medium">
                            {error}
                        </p>
                    )}
                    <Button className="w-full" onClick={handleSubmit}>
                        Sign Up
                    </Button>
                    <p className="font-bold text-xl text-center">
                        Start building your eVault identity today
                    </p>
                    <div className="bg-muted-foreground/20 p-4 rounded-md text-center text-sm">
                        eVoting is built on the Web 3.0 Data Space (WDS)
                        architecture. All your data is stored in your own
                        personal eVault – not on centralized servers.
                    </div>
                </div>
            </Card>

            <img src="/W3DS.svg" alt="W3DS Logo" className="max-h-8" />
        </div>
    );
}
