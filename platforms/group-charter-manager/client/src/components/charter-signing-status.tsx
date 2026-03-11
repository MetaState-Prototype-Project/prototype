"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Circle, AlertTriangle, MoreVertical, Shield, ShieldOff, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";

interface CharterSigningStatusProps {
    groupId: string;
    charterContent: string;
    currentUserId?: string;
    currentUserIsAdmin?: boolean;
    currentUserIsOwner?: boolean;
}

interface Participant {
    id: string;
    name?: string;
    ename?: string;
    hasSigned: boolean;
    isAdmin?: boolean;
    isOwner?: boolean;
}

interface SigningStatus {
    participants: Participant[];
    signatures: any[];
    charterHash: string;
    isSigned: boolean;
}

export function CharterSigningStatus({ groupId, charterContent, currentUserId, currentUserIsAdmin, currentUserIsOwner }: CharterSigningStatusProps) {
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

    const handleRoleChange = async (targetUserId: string, newRole: "admin" | "member" | "owner") => {
        if (newRole === "owner" && !window.confirm("Are you sure you want to transfer ownership? This cannot be undone.")) {
            return;
        }
        try {
            await apiClient.patch(`/api/groups/${groupId}/members/${targetUserId}/role`, { role: newRole });
            toast({
                title: "Success",
                description: newRole === "admin" ? "Admin privileges granted" : newRole === "member" ? "Admin privileges removed" : "Ownership transferred",
            });
            fetchSigningStatus();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.response?.data?.error || "Failed to update role",
                variant: "destructive",
            });
        }
    };

    const canManageRoles = currentUserIsAdmin || currentUserIsOwner;



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
                                    {canManageRoles && participant.id !== currentUserId && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {!participant.isAdmin && !participant.isOwner && (
                                                    <DropdownMenuItem onClick={() => handleRoleChange(participant.id, "admin")}>
                                                        <Shield className="mr-2 h-4 w-4" />
                                                        Make Admin
                                                    </DropdownMenuItem>
                                                )}
                                                {participant.isAdmin && !participant.isOwner && currentUserIsOwner && (
                                                    <DropdownMenuItem onClick={() => handleRoleChange(participant.id, "member")}>
                                                        <ShieldOff className="mr-2 h-4 w-4" />
                                                        Remove Admin
                                                    </DropdownMenuItem>
                                                )}
                                                {!participant.isOwner && currentUserIsOwner && (
                                                    <DropdownMenuItem className="text-amber-600" onClick={() => handleRoleChange(participant.id, "owner")}>
                                                        <Crown className="mr-2 h-4 w-4" />
                                                        Transfer Ownership
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
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