"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/apiClient";
import WysiwygEditor from "./wysiwyg-editor";
import { Save, Edit3 } from "lucide-react";

interface CharterEditorProps {
    groupId: string;
    initialCharter?: string;
    isOwner: boolean;
    isAdmin: boolean;
    onCharterUpdated?: (charter: string) => void;
}

export default function CharterEditor({ 
    groupId, 
    initialCharter = "", 
    isOwner, 
    isAdmin,
    onCharterUpdated 
}: CharterEditorProps) {
    const [charter, setCharter] = useState(initialCharter);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const canEdit = isOwner || isAdmin;

    const handleSave = async () => {
        if (!canEdit) return;

        try {
            setIsSaving(true);
            await apiClient.put(`/api/groups/${groupId}/charter`, {
                charter
            });

            toast({
                title: "Success",
                description: "Charter updated successfully",
            });

            setIsEditing(false);
            onCharterUpdated?.(charter);
        } catch (error) {
            console.error("Failed to update charter:", error);
            toast({
                title: "Error",
                description: "Failed to update charter",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setCharter(initialCharter);
        setIsEditing(false);
    };

    if (!canEdit) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Group Charter</CardTitle>
                </CardHeader>
                <CardContent>
                    {charter ? (
                        <div className="prose prose-sm max-w-none">
                            <div dangerouslySetInnerHTML={{ 
                                __html: charter
                                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                    .replace(/\*(.+?)\*/g, '<em>$1</em>')
                                    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                                    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                                    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                                    .replace(/^- (.+)$/gm, '<li>$1</li>')
                                    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
                                    .replace(/\n/g, '<br>')
                            }} />
                        </div>
                    ) : (
                        <p className="text-gray-500">No charter has been set for this group.</p>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Group Charter</CardTitle>
                    {!isEditing && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditing(true)}
                        >
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit Charter
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {isEditing ? (
                    <div className="space-y-4">
                        <WysiwygEditor
                            content={charter}
                            onChange={setCharter}
                            placeholder="Write your group charter here..."
                        />
                        <div className="flex gap-2">
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                <Save className="h-4 w-4 mr-2" />
                                {isSaving ? "Saving..." : "Save Charter"}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleCancel}
                                disabled={isSaving}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div>
                        {charter ? (
                            <div className="prose prose-sm max-w-none">
                                <div dangerouslySetInnerHTML={{ 
                                    __html: charter
                                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                        .replace(/\*(.+?)\*/g, '<em>$1</em>')
                                        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                                        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                                        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                                        .replace(/^- (.+)$/gm, '<li>$1</li>')
                                        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
                                        .replace(/\n/g, '<br>')
                                }} />
                            </div>
                        ) : (
                            <p className="text-gray-500">No charter has been set for this group.</p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
} 