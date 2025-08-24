"use client";

import { use, useState, useEffect } from "react";
import {
    ArrowLeft,
    Edit,
    Calendar,
    Users,
    Save,
    X,
    CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import WysiwygEditor from "@/components/wysiwyg-editor";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/apiClient";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CharterSigningStatus } from "@/components/charter-signing-status";
import { CharterSigningInterface } from "@/components/charter-signing-interface";

interface Group {
    id: string;
    name: string;
    description?: string;
    owner: string;
    admins: string[];
    participants: any[];
    charter?: string;
    ename?: string; // eVault identifier (w3id)
    createdAt: string;
    updatedAt: string;
}

export default function CharterDetail({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const [group, setGroup] = useState<Group | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editCharter, setEditCharter] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [showSigningInterface, setShowSigningInterface] = useState(false);
    const [signingStatus, setSigningStatus] = useState<any>(null);
    const [signingStatusLoading, setSigningStatusLoading] = useState(true);

    const { id } = use(params);
    const { toast } = useToast();
    const { user } = useAuth();

        const fetchGroup = async () => {
            try {
                setIsLoading(true);
                const response = await apiClient.get(`/api/groups/${id}`);
                setGroup(response.data);
                setEditCharter(response.data.charter || "");
            } catch (error) {
                console.error('Failed to fetch group:', error);
                toast({
                    title: "Error",
                    description: "Failed to load charter",
                    variant: "destructive",
                });
            } finally {
                setIsLoading(false);
            }
        };

    const fetchSigningStatus = async () => {
        if (!group?.charter) return;
        
        try {
            setSigningStatusLoading(true);
            const response = await apiClient.get(`/api/groups/${id}/charter/signing-status`);
            setSigningStatus(response.data);
        } catch (error) {
            console.error('Failed to fetch signing status:', error);
        } finally {
            setSigningStatusLoading(false);
        }
    };

    // Fetch group data on component mount
    useEffect(() => {
        if (id) {
            fetchGroup();
        }
    }, [id, toast]);

    // Fetch signing status when group changes
    useEffect(() => {
        if (group?.charter) {
            fetchSigningStatus();
        }
    }, [group?.charter]);

    const handleEditStart = () => {
        setIsEditing(true);
    };

    const handleEditSave = async () => {
        try {
            setIsSaving(true);
            await apiClient.put(`/api/groups/${id}/charter`, {
                charter: editCharter
            });

            setGroup(prev => prev ? { ...prev, charter: editCharter } : null);
            setIsEditing(false);

            toast({
                title: "Success",
                description: "Charter updated successfully",
            });
        } catch (error) {
            console.error('Failed to update charter:', error);
            toast({
                title: "Error",
                description: "Failed to update charter",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditCancel = () => {
        setEditCharter(group?.charter || "");
        setIsEditing(false);
    };

    // Check if user can edit (owner or admin)
    const canEdit = user && group && (
        group.owner === user.id || 
        (group.admins && group.admins.includes(user.id))
    );

    // Debug logging
    console.log('Charter Detail Debug:', {
        user: user?.id,
        groupOwner: group?.owner,
        groupAdmins: group?.admins,
        userIsOwner: group?.owner === user?.id,
        userIsAdmin: group?.admins?.includes(user?.id || ''),
        canEdit,
        isEditing
    });

    // Only show edit button for admins
    const showEditButton = canEdit;

    if (isLoading) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-black bg-opacity-10 rounded w-1/4" />
                    <div className="h-96 bg-black bg-opacity-10 rounded-3xl" />
                </div>
            </div>
        );
    }

    if (!group) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-800">
                        Charter not found
                    </h2>
                    <Link href="/">
                        <Button className="mt-4">Back to Dashboard</Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
            {/* Back Button */}
            <div className="mb-4 sm:mb-6">
                <Link href="/">
                    <Button
                        variant="ghost"
                        className="inline-flex items-center text-gray-600 hover:text-gray-800 transition-colors duration-200 p-2 sm:p-3 hover:bg-amber-500 hover:bg-opacity-10"
                    >
                        <ArrowLeft className="mr-2" size={16} />
                        <span className="text-sm sm:text-base">
                            Back to Dashboard
                        </span>
                    </Button>
                </Link>
            </div>

            {/* Charter Header */}
            <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow mb-6 sm:mb-8">
                <CardContent className="p-4 sm:p-6 lg:p-8">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center space-x-3 sm:space-x-6 mb-4 sm:mb-6 lg:mb-0">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-amber-100 flex items-center justify-center shrink-0">
                                <span className="text-amber-600 font-bold text-2xl">
                                    {group.name?.charAt(0).toUpperCase() || 'G'}
                                </span>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-3xl font-bold text-gray-800 mb-2">
                                    {group.name || 'Unnamed Group'}
                                </h2>
                                {group.ename && (
                                    <div className="text-xs text-gray-500 font-mono mb-2">
                                        {group.ename}
                                    </div>
                                )}
                                <div className="text-gray-600 mb-2">
                                    Group Charter
                                </div>
                                <div className="flex items-center space-x-4 text-sm text-gray-500">
                                    <span>
                                        <Users
                                            className="mr-1 inline"
                                            size={14}
                                        />
                                        {group.participants?.length || 0} members
                                    </span>
                                    <span>
                                        <Calendar
                                            className="mr-1 inline"
                                            size={14}
                                        />
                                        Last updated{" "}
                                        {group.updatedAt
                                            ? new Date(group.updatedAt).toLocaleDateString()
                                            : "recently"}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex space-x-3">
                            {isEditing ? (
                                <>
                                    <Button
                                        onClick={handleEditSave}
                                        disabled={isSaving}
                                        className="gradient-primary text-white px-6 py-3 rounded-2xl font-medium hover:shadow-xl transition-all duration-300"
                                    >
                                        <Save className="mr-2" size={18} />
                                        {isSaving ? "Saving..." : "Save Changes"}
                                    </Button>
                                    <Button
                                        onClick={handleEditCancel}
                                        variant="outline"
                                        className="bg-white/70 backdrop-blur-xs text-gray-700 px-6 py-3 rounded-2xl font-medium hover:bg-white/90 transition-all duration-300 shadow-lg"
                                    >
                                        <X className="mr-2" size={18} />
                                        Cancel
                                    </Button>
                                </>
                            ) : (
                                <>
                                    {/* Edit Charter Button (only for admins) */}
                                    {showEditButton && (
                                        <Button
                                            onClick={handleEditStart}
                                            className="gradient-primary text-white px-6 py-3 rounded-2xl font-medium hover:shadow-xl transition-all duration-300"
                                        >
                                            <Edit className="mr-2" size={18} />
                                            Edit Charter
                                        </Button>
                                    )}
                                    
                                    {/* Sign Charter Button (only if current user hasn't signed) */}
                                    {group.charter && signingStatus && !signingStatusLoading && (
                                        (() => {
                                            const currentUser = signingStatus.participants.find((p: any) => p.id === user?.id);
                                            return currentUser && !currentUser.hasSigned;
                                        })() && (
                                            <Button
                                                onClick={() => setShowSigningInterface(true)}
                                                variant="outline"
                                                className="bg-green-600 text-white px-6 py-3 rounded-2xl font-medium hover:bg-green-700 transition-all duration-300 shadow-lg"
                                            >
                                                <CheckCircle className="mr-2" size={18} />
                                                Sign Charter
                                            </Button>
                                        )
                                    )}
                                    
                                    {/* Disabled button for users who have already signed */}
                                    {group.charter && signingStatus && !signingStatusLoading && (
                                        (() => {
                                            const currentUser = signingStatus.participants.find((p: any) => p.id === user?.id);
                                            return currentUser && currentUser.hasSigned;
                                        })() && (
                                            <Button
                                                disabled
                                                variant="outline"
                                                className="bg-green-50 text-green-600 border-green-600 cursor-not-allowed px-6 py-3 rounded-2xl font-medium"
                                            >
                                                <CheckCircle className="mr-2" size={18} />
                                                Charter Signed
                                            </Button>
                                        )
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Charter Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Charter Details */}
                <div className="lg:col-span-2">
                    <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow mb-6">
                        <CardContent className="p-8">
                            <h3 className="text-xl font-semibold text-gray-800 mb-6">
                                Charter Content
                            </h3>
                            <div className="space-y-6">
                                {isEditing ? (
                                    <WysiwygEditor
                                        content={editCharter}
                                        onChange={setEditCharter}
                                        placeholder="Write your group charter here..."
                                        className="min-h-[400px]"
                                    />
                                                                       ) : (
                                           <div className="prose prose-sm max-w-none">
                                               {group.charter ? (
                                                   <div className="text-gray-600 prose prose-sm max-w-none prose-headings:text-gray-800 prose-strong:text-gray-800 prose-em:text-gray-700 prose-ul:text-gray-600 prose-ol:text-gray-600 prose-li:text-gray-600 prose-blockquote:text-gray-600 prose-code:text-gray-800 prose-pre:bg-gray-50">
                                                       <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                           {group.charter}
                                                       </ReactMarkdown>
                                                   </div>
                                               ) : (
                                                   <div>
                                                   <p className="text-gray-500 italic">
                                                       No charter content has been set for this group.
                                                   </p>
                                                       {!canEdit && (
                                                           <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                               <p className="text-sm text-blue-700">
                                                                   💡 Only admins can create the charter. Contact a group admin to get started.
                                                               </p>
                                                           </div>
                                                       )}
                                                   </div>
                                               )}
                                           </div>
                                       )}
                                        
                                        {/* Info message for non-admin users */}
                                        {!canEdit && group.charter && (
                                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                <p className="text-sm text-blue-700">
                                                    💡 Only admins can edit the charter. Contact a group admin if you need changes.
                                                </p>
                                           </div>
                                       )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Group Info */}
                    <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow">
                        <CardContent className="p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">
                                Group Information
                            </h3>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <span className="text-gray-600">Admins:</span>
                                    <span className="ml-2 font-medium">
                                        {group.participants && group.admins ? (
                                            group.participants
                                                .filter(participant => group.admins.includes(participant.id))
                                                .map(participant => participant.name || participant.ename || 'Unknown')
                                                .join(', ')
                                        ) : 'None'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-600">Members:</span>
                                    <span className="ml-2 font-medium">{group.participants?.length || 0}</span>
                                </div>
                                <div>
                                    <span className="text-gray-600">Created:</span>
                                    <span className="ml-2 font-medium">
                                        {group.createdAt ? new Date(group.createdAt).toLocaleDateString() : 'Unknown'}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Group Description */}
                    {group.description && (
                        <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow">
                            <CardContent className="p-6">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                                    Group Description
                                </h3>
                                <p className="text-sm text-gray-600">
                                    {group.description}
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Charter Signing Status */}
                    {group.charter && (
                        <CharterSigningStatus 
                            groupId={group.id} 
                            charterContent={group.charter} 
                        />
                    )}
                </div>
            </div>

            {/* Signing Interface Modal */}
            {showSigningInterface && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <CharterSigningInterface
                            groupId={group.id}
                            charterData={{ charter: group.charter }}
                            onSigningComplete={(groupId) => {
                                setShowSigningInterface(false);
                                // Immediately update signing status without full refresh
                                fetchSigningStatus();
                            }}
                            onCancel={() => setShowSigningInterface(false)}
                            onSigningStatusUpdate={(participantId, hasSigned) => {
                                // Immediately update the local signing status
                                if (signingStatus) {
                                    setSigningStatus(prev => {
                                        if (!prev) return prev;
                                        
                                        const updatedParticipants = prev.participants.map(participant => 
                                            participant.id === participantId 
                                                ? { ...participant, hasSigned }
                                                : participant
                                        );
                                        
                                        return {
                                            ...prev,
                                            participants: updatedParticipants
                                        };
                                    });
                                }
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}