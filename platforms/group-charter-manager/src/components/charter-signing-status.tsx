"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Circle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { CharterSigningInterface } from "./charter-signing-interface";

interface CharterSigningStatusProps {
    groupId: string;
    charterContent: string;
}

interface Participant {
    id: string;
    name?: string;
    ename?: string;
    hasSigned: boolean;
}

interface SigningStatus {
    participants: Participant[];
    signatures: any[];
    charterHash: string;
    isSigned: boolean;
}

export function CharterSigningStatus({ groupId, charterContent }: CharterSigningStatusProps) {
    const [signingStatus, setSigningStatus] = useState<SigningStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSigningInterface, setShowSigningInterface] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        fetchSigningStatus();
    }, [groupId, charterContent]);

    const fetchSigningStatus = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get(`/api/groups/${groupId}/charter/signing-status`);
            setSigningStatus(response.data);
        } catch (error) {
            console.error('Failed to fetch signing status:', error);
            toast({
                title: "Error",
                description: "Failed to load signing status",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSigningComplete = async (groupId: string) => {
        toast({
            title: "Success",
            description: "Charter signed successfully!",
        });
        setShowSigningInterface(false);
        // Refresh the signing status
        await fetchSigningStatus();
    };

    if (loading) {
        return (
            <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow">
                <CardHeader>
                    <CardTitle>Users</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="animate-pulse space-y-3">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!signingStatus) {
        return (
            <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow">
                <CardHeader>
                    <CardTitle>Users</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-500">Unable to load user information</p>
                </CardContent>
            </Card>
        );
    }

    const signedCount = signingStatus.participants.filter(p => p.hasSigned).length;
    const totalCount = signingStatus.participants.length;
    const allSigned = signedCount === totalCount;

    return (
        <>
            <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow">
                <CardHeader>
                    <CardTitle>Users</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {signingStatus.participants.map((participant) => (
                            <div 
                                key={participant.id} 
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    {participant.hasSigned ? (
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                    ) : (
                                        <Circle className="h-5 w-5 text-gray-400" />
                                    )}
                                    <div>
                                        <p className="font-medium text-sm">
                                            {participant.name || participant.ename || 'Unknown User'}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {participant.hasSigned ? 'Signed' : 'Not signed yet'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Show admin role if applicable */}
                                    {participant.isAdmin && (
                                        <Badge variant="secondary" className="text-xs">
                                            Admin
                                        </Badge>
                                    )}
                                    {participant.isOwner && (
                                        <Badge variant="default" className="text-xs">
                                            Owner
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {signingStatus.signatures.length > 0 && (
                        <div className="mt-6 pt-6 border-t">
                            <h4 className="font-medium text-sm text-gray-700 mb-3">Recent Signatures</h4>
                            <div className="space-y-2">
                                {signingStatus.signatures.slice(-5).map((signature) => (
                                    <div key={signature.id} className="flex items-center gap-2 text-sm text-gray-600">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <span>
                                            {signature.user?.name || signature.user?.ename || 'Unknown User'} 
                                            signed on {new Date(signature.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {showSigningInterface && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <CharterSigningInterface
                            groupId={groupId}
                            charterData={{ charter: charterContent }}
                            onSigningComplete={handleSigningComplete}
                            onCancel={() => setShowSigningInterface(false)}
                        />
                    </div>
                </div>
            )}
        </>
    );
} 