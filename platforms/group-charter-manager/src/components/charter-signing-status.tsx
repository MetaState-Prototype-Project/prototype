"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Circle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";

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



    if (loading) {
        return (
            <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow">
                <CardHeader>
                    <CardTitle>Members</CardTitle>
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
                    <CardTitle>Members</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-500">Unable to load user information</p>
                </CardContent>
            </Card>
        );
    }



    return (
        <>
            <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow">
                <CardHeader>
                    <CardTitle>Members</CardTitle>
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


                </CardContent>
            </Card>
        </>
    );
} 