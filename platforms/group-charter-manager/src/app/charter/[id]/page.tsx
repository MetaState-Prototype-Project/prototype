"use client";

import { use, useState, useEffect } from "react";
import {
    ArrowLeft,
    Edit,
    Share,
    Calendar,
    Users,
    Save,
    X,
    Plus,
    Trash2,
    AlertTriangle,
    CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
// Assuming these components exist in your project
import MemberAvatar from "@/components/member-avatar";
import WysiwygEditor from "@/components/wysiwyg-editor";
import { useToast } from "@/hooks/use-toast";
import { PlatformBadge } from "@/components/platform-badge";
import { useAuth } from "@/hooks/useAuth";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import type { User } from "@/types";
import Link from "next/link";

// Helper function to get user's display name
const getUserDisplayName = (user: User): string => {
    if (user.firstName && user.lastName) {
        return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) {
        return user.firstName;
    }
    if (user.lastName) {
        return user.lastName;
    }
    return user.email || "Unknown User";
};

// --- DUMMY DATA ---
// Replace with your actual user data structure from your backend
const DUMMY_USERS: User[] = [
    {
        id: "user1",
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@example.com",
    },
    {
        id: "user2",
        firstName: "Bob",
        lastName: "Johnson",
        email: "bob@example.com",
    },
    {
        id: "user3",
        firstName: "Charlie",
        lastName: "Brown",
        email: "charlie@example.com",
    },
    {
        id: "user4",
        firstName: "Diana",
        lastName: "Prince",
        email: "diana@example.com",
    },
    {
        id: "user5",
        firstName: "Eve",
        lastName: "Adams",
        email: "eve@example.com",
    },
    {
        id: "user6",
        firstName: "Frank",
        lastName: "White",
        email: "frank@example.com",
    },
    {
        id: "user7",
        firstName: "Grace",
        lastName: "Hopper",
        email: "grace@example.com",
    },
    {
        id: "user8",
        firstName: "Heidi",
        lastName: "Klum",
        email: "heidi@example.com",
    },
    {
        id: "user9",
        firstName: "Ivan",
        lastName: "Drago",
        email: "ivan@example.com",
    },
    {
        id: "user10",
        firstName: "Julia",
        lastName: "Roberts",
        email: "julia@example.com",
    },
];

// Replace with your actual charter data structure from your backend
const DUMMY_CHARTER = {
    id: "charter123",
    name: "Community Moderation Guidelines",
    description:
        "<p>This charter outlines the principles and guidelines for moderating our online community. Our goal is to foster a safe, inclusive, and respectful environment for all members.</p><p>We believe in open dialogue and diverse perspectives, but we also maintain zero tolerance for harassment, hate speech, and discrimination.</p>",
    group: {
        id: "groupABC",
        name: "Official Community Moderators",
        imageUrl: "https://picsum.photos/id/237/120/120",
        platform: "Discord",
        memberCount: 520,
    },
    owner: DUMMY_USERS[0], // Alice Smith is the owner for this dummy data
    admins: [DUMMY_USERS[1], DUMMY_USERS[2]],
    members: DUMMY_USERS.slice(0, 10), // All 10 dummy users as members
    guidelines: [
        "Be respectful and civil in all interactions.",
        "No hate speech, discrimination, or personal attacks.",
        "Keep discussions constructive and on-topic.",
        "Do not share private information without consent.",
        "Report any violations to the moderation team.",
        "No spamming or self-promotion without permission.",
    ],
    autoApprove: true,
    allowPosts: false,
    isActive: true,
    createdAt: new Date(2023, 0, 15).toISOString(),
    updatedAt: new Date(2024, 6, 20, 10, 30).toISOString(),
    stats: {
        totalViews: 1543,
    },
    signedBy: ["user2", "user3"], // IDs of dummy users who have "signed" the charter
};

export default function CharterDetail({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    // State to hold charter data and loading status
    const [charter, setCharter] = useState<typeof DUMMY_CHARTER | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Get charter ID from Next.js params
    const { id } = use(params);
    const { toast } = useToast();
    // Use your authentication hook to get the current user
    const { user } = useAuth();

    // Determine the current user for logic (e.g., enabling edit/delete buttons)
    // In a real app, 'user' from useAuth would be the definitive source.
    // For this dummy setup, we default to DUMMY_USERS[0] if useAuth doesn't provide one.
    const currentUser = user || DUMMY_USERS[0];

    // State for UI interactions
    const [isEditing, setIsEditing] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showSignCharterModal, setShowSignCharterModal] = useState(false);
    const [editForm, setEditForm] = useState({
        name: "",
        description: "",
        guidelines: [] as string[],
    });

    // Simulate fetching charter data on component mount or ID change
    useEffect(() => {
        const fetchCharter = async () => {
            setIsLoading(true);
            // Simulate an API call delay for a realistic loading experience
            await new Promise((resolve) => setTimeout(resolve, 1000));
            // In a real application, you'd fetch data from your API here
            // Example: const response = await fetch(`/api/charters/${id}`);
            // const data = await response.json();
            // setCharter(data);
            setCharter(DUMMY_CHARTER); // Using dummy data for demonstration
            setIsLoading(false);
        };
        fetchCharter();
    }, [id]);

    // Mock mutation hooks to simulate API interactions
    // In a real app, you would integrate with a library like React Query or SWR
    // to manage mutations and data invalidation.

    const updateMutation = {
        isPending: false, // Simulates a loading state during API call
        mutate: (data: typeof editForm) => {
            console.log("Simulating charter update:", data);
            // Simulate API call success
            toast({
                title: "Charter Updated",
                description: "Your changes have been saved successfully.",
            });
            setIsEditing(false);
            // Optimistically update the UI with new data
            setCharter((prev) =>
                prev ? { ...prev, ...data, updatedAt: new Date().toISOString() } : null
            );
        },
    };

    const deleteMutation = {
        isPending: false, // Simulates a loading state during API call
        mutate: () => {
            console.log("Simulating delete charter with ID:", id);
            // Simulate API call success
            toast({
                title: "Charter Deleted",
                description: "The charter has been permanently removed.",
                variant: "destructive",
            });
            setShowDeleteDialog(false);
            // After deletion, clear the charter data to show "not found"
            setCharter(null);
            // In a real app, you might redirect the user to a dashboard
            // router.push('/dashboard');
        },
    };

    const signCharterMutation = {
        isPending: false, // Simulates a loading state during API call
        mutate: (userId: string) => {
            console.log("Simulating signing charter by user:", userId);
            // Simulate API call success
            toast({
                title: "Charter Signed!",
                description: "You have successfully signed the charter.",
            });
            setShowSignCharterModal(false);
            // Update the signedBy array to reflect the new signature
            setCharter((prev) => {
                if (prev) {
                    // Add user ID if not already present
                    const newSignedBy = prev.signedBy.includes(userId)
                        ? prev.signedBy
                        : [...prev.signedBy, userId];
                    return { ...prev, signedBy: newSignedBy };
                }
                return prev;
            });
        },
    };

    // Handlers for edit mode
    const handleEditStart = () => {
        if (charter) {
            setEditForm({
                name: charter.name,
                description: charter.description || "",
                guidelines: charter.guidelines || [],
            });
            setIsEditing(true);
        }
    };

    const handleEditSave = () => {
        updateMutation.mutate(editForm);
    };

    const handleEditCancel = () => {
        setIsEditing(false);
        // Reset edit form to original charter data
        if (charter) {
            setEditForm({
                name: charter.name,
                description: charter.description || "",
                guidelines: charter.guidelines || [],
            });
        }
    };

    // Handlers for guidelines in edit mode
    const updateGuideline = (index: number, value: string) => {
        const newGuidelines = [...editForm.guidelines];
        newGuidelines[index] = value;
        setEditForm({ ...editForm, guidelines: newGuidelines });
    };

    const addGuideline = () => {
        setEditForm({ ...editForm, guidelines: [...editForm.guidelines, ""] });
    };

    const removeGuideline = (index: number) => {
        const newGuidelines = editForm.guidelines.filter((_, i) => i !== index);
        setEditForm({ ...editForm, guidelines: newGuidelines });
    };

    // Handler for charter deletion
    const handleDelete = () => {
        deleteMutation.mutate();
    };

    // Handler for signing the charter
    const handleSignCharter = () => {
        if (currentUser) {
            signCharterMutation.mutate(currentUser.id);
        } else {
            toast({
                title: "Sign-in Required",
                description: "Please log in to sign the charter.",
                variant: "destructive", // Changed to destructive for more prominence
            });
        }
    };

    // Check if the current user has already signed the charter
    const hasUserSigned = charter?.signedBy.includes(currentUser.id) || false;

    // Loading state UI
    if (isLoading) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-gray-200 rounded w-1/4" />
                    <div className="h-48 bg-gray-200 rounded-3xl" />
                </div>
            </div>
        );
    }

    // Not found state UI
    if (!charter || !charter.group || !charter.owner) {
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
                            <img
                                src={
                                    charter.group.imageUrl ||
                                    "https://via.placeholder.com/120"
                                }
                                alt={charter.group.name}
                                className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl object-cover shrink-0"
                            />
                            <div className="flex-1">
                                {isEditing ? (
                                    <div className="space-y-3">
                                        <Input
                                            value={editForm.name}
                                            onChange={(e) =>
                                                setEditForm({
                                                    ...editForm,
                                                    name: e.target.value,
                                                })
                                            }
                                            className="text-3xl font-bold text-gray-800 border-0 bg-transparent p-0 focus:ring-0 focus:border-0"
                                            placeholder="Charter name"
                                        />
                                        <WysiwygEditor
                                            content={editForm.description}
                                            onChange={(content) =>
                                                setEditForm({
                                                    ...editForm,
                                                    description: content,
                                                })
                                            }
                                            placeholder="Charter description..."
                                            className="text-gray-600 border-0 bg-transparent p-0"
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <h2 className="text-3xl font-bold text-gray-800 mb-2">
                                            {charter.name}
                                        </h2>
                                        <div className="text-gray-600 mb-2 prose prose-sm">
                                            {charter.group.name}
                                        </div>
                                    </>
                                )}
                                <div className="flex items-center space-x-4 text-sm text-gray-500">
                                    <div className="flex items-center">
                                        <PlatformBadge
                                            platform={charter.group.platform}
                                            className="text-xs"
                                        />
                                    </div>
                                    <span>
                                        <Users
                                            className="mr-1 inline"
                                            size={14}
                                        />
                                        {charter.group.memberCount} members
                                    </span>
                                    <span>
                                        <Calendar
                                            className="mr-1 inline"
                                            size={14}
                                        />
                                        Last updated{" "}
                                        {charter.updatedAt
                                            ? new Date(
                                                  charter.updatedAt
                                              ).toLocaleDateString()
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
                                        disabled={updateMutation.isPending}
                                        className="gradient-primary text-white px-6 py-3 rounded-2xl font-medium hover:shadow-xl transition-all duration-300"
                                    >
                                        <Save className="mr-2" size={18} />
                                        {updateMutation.isPending
                                            ? "Saving..."
                                            : "Save Changes"}
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
                                    <Button className="bg-white/70 backdrop-blur-xs text-gray-700 px-6 py-3 rounded-2xl font-medium hover:bg-white/90 transition-all duration-300 shadow-lg">
                                        <Share className="mr-2" size={18} />
                                        Share
                                    </Button>
                                    {/* Sign Charter Button */}
                                    {/* Show "Sign Charter" if not signed, otherwise show "Charter Signed" with checkmark */}
                                    {hasUserSigned ? (
                                        <Button
                                            disabled
                                            className="bg-gray-200 text-gray-600 px-6 py-3 rounded-2xl font-medium cursor-not-allowed"
                                        >
                                            <CheckCircle className="mr-2" size={18} />
                                            Charter Signed
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={() => setShowSignCharterModal(true)}
                                            className="bg-green-600 text-white px-6 py-3 rounded-2xl font-medium hover:bg-green-700 transition-all duration-300"
                                        >
                                            <CheckCircle className="mr-2" size={18} />
                                            Sign Charter
                                        </Button>
                                    )}

                                    {/* Edit Charter Button (only for charter owner) */}
                                    {currentUser && currentUser.id === charter.owner.id && (
                                        <Button
                                            onClick={handleEditStart}
                                            className="gradient-primary text-white px-6 py-3 rounded-2xl font-medium hover:shadow-xl transition-all duration-300"
                                        >
                                            <Edit className="mr-2" size={18} />
                                            Edit Charter
                                        </Button>
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
                                Charter Details
                            </h3>
                            <div className="space-y-6">
                                {/* Charter Description */}
                                {charter.description && (
                                    <div>
                                        {isEditing ? (
                                            <WysiwygEditor
                                                content={editForm.description}
                                                onChange={(content) =>
                                                    setEditForm({
                                                        ...editForm,
                                                        description: content,
                                                    })
                                                }
                                                placeholder="Charter description..."
                                                className="text-gray-600 border rounded-xl p-4 min-h-[150px]"
                                            />
                                        ) : (
                                            <div
                                                className="text-gray-600 prose prose-sm max-w-none"
                                                dangerouslySetInnerHTML={{
                                                    __html: charter.description,
                                                }}
                                            />
                                        )}
                                    </div>
                                )}

                                <div>
                                    <h4 className="font-medium text-gray-700 mb-3">
                                        Community Guidelines
                                    </h4>
                                    {isEditing ? (
                                        <div className="space-y-3">
                                            {editForm.guidelines.map(
                                                (guideline, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex items-start space-x-3"
                                                    >
                                                        <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center mt-1">
                                                            <span className="text-purple-600 font-medium text-sm">
                                                                {index + 1}
                                                            </span>
                                                        </div>
                                                        <Input
                                                            placeholder={`Enter guideline ${
                                                                index + 1
                                                            }...`}
                                                            className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 bg-white/80 backdrop-blur-xs"
                                                            value={guideline}
                                                            onChange={(e) =>
                                                                updateGuideline(
                                                                    index,
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                        />
                                                        {editForm.guidelines
                                                            .length > 1 && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() =>
                                                                    removeGuideline(
                                                                        index
                                                                    )
                                                                }
                                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl"
                                                            >
                                                                <X size={16} />
                                                            </Button>
                                                        )}
                                                    </div>
                                                )
                                            )}
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={addGuideline}
                                                className="mt-3 text-purple-600 hover:text-purple-700 font-medium text-sm"
                                            >
                                                <Plus
                                                    className="mr-2"
                                                    size={16}
                                                />
                                                Add Another Guideline
                                            </Button>
                                        </div>
                                    ) : (
                                        <ul className="space-y-2 text-gray-600 list-disc pl-5">
                                            {charter.guidelines?.map(
                                                (
                                                    guideline: string,
                                                    index: number
                                                ) => (
                                                    <li key={index}>
                                                        {guideline}
                                                    </li>
                                                )
                                            )}
                                        </ul>
                                    )}
                                </div>

                                <div>
                                    <h4 className="font-medium text-gray-700 mb-3">
                                        Charter Settings
                                    </h4>
                                    <div className="space-y-2 text-gray-600">
                                        <p>
                                            • Auto-approve new members:{" "}
                                            <strong>
                                                {charter.autoApprove
                                                    ? "Enabled"
                                                    : "Disabled"}
                                            </strong>
                                        </p>
                                        <p>
                                            • Allow member posts:{" "}
                                            <strong>
                                                {charter.allowPosts
                                                    ? "Enabled"
                                                    : "Disabled"}
                                            </strong>
                                        </p>
                                        <p>
                                            • Charter status:{" "}
                                            <Badge
                                                variant={
                                                    charter.isActive
                                                        ? "success"
                                                        : "destructive"
                                                }
                                                className={`${
                                                    charter.isActive
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-red-100 text-red-700"
                                                }`}
                                            >
                                                {charter.isActive
                                                    ? "Active"
                                                    : "Inactive"}
                                            </Badge>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Charter Owner */}
                    <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow">
                        <CardContent className="p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">
                                Charter Owner
                            </h3>
                            <div className="space-y-4">
                                <MemberAvatar
                                    name={getUserDisplayName(charter.owner)}
                                    role="owner"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Group Admins */}
                    <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow">
                        <CardContent className="p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">
                                Group Admins
                            </h3>
                            <div className="space-y-4">
                                {charter.admins.map((admin: User) => (
                                    <MemberAvatar
                                        key={admin.id}
                                        name={getUserDisplayName(admin)}
                                        role="admin"
                                    />
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Group Members */}
                    <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-800">
                                    Group Members
                                </h3>
                                <span className="text-sm text-gray-600">
                                    {charter.members.length} members
                                </span>
                            </div>
                            <div className="space-y-3">
                                {charter.members
                                    .slice(0, 8)
                                    .map((member: User) => (
                                        <div
                                            key={member.id}
                                            className="flex items-center space-x-3"
                                        >
                                            <MemberAvatar
                                                name={getUserDisplayName(
                                                    member
                                                )}
                                                size="sm"
                                            />
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-800 text-sm">
                                                    {getUserDisplayName(member)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                            {charter.members.length > 8 && (
                                <Button
                                    variant="ghost"
                                    className="w-full mt-4 text-purple-600 hover:text-purple-700 font-medium text-sm"
                                >
                                    View All Members
                                </Button>
                            )}
                        </CardContent>
                    </Card>

                    {/* Charter Stats */}
                    <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow">
                        <CardContent className="p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">
                                Charter Stats
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600 text-sm">
                                        Created On
                                    </span>
                                    <span className="font-medium text-gray-800 text-sm">
                                        {charter.createdAt
                                            ? new Date(
                                                  charter.createdAt
                                              ).toLocaleDateString()
                                            : "N/A"}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600 text-sm">
                                        Last Updated
                                    </span>
                                    <span className="font-medium text-gray-800 text-sm">
                                        {charter.updatedAt
                                            ? new Date(
                                                  charter.updatedAt
                                              ).toLocaleDateString()
                                            : "N/A"}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600 text-sm">
                                        Total Views
                                    </span>
                                    <span className="font-medium text-gray-800 text-sm">
                                        {charter.stats?.totalViews || 0}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600 text-sm">
                                        Times Signed
                                    </span>
                                    <span className="font-medium text-gray-800 text-sm">
                                        {charter.signedBy.length}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Danger Zone - Only visible to charter owner */}
            {charter.owner && currentUser && currentUser.id === charter.owner.id && (
                <div className="mt-8 max-w-4xl mx-auto">
                    <Card className="border-red-200 bg-red-50/50 backdrop-blur-xs rounded-3xl">
                        <CardContent className="p-6">
                            <div className="flex items-start space-x-4">
                                <div className="shrink-0">
                                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                        <AlertTriangle className="w-5 h-5 text-red-600" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-red-800 mb-2">
                                        Danger Zone
                                    </h3>
                                    <p className="text-red-700 text-sm mb-4">
                                        Once you delete a charter, there is no
                                        going back. This action cannot be
                                        undone.
                                    </p>
                                    <Button
                                        variant="destructive"
                                        onClick={() =>
                                            setShowDeleteDialog(true)
                                        }
                                        className="bg-red-600 hover:bg-red-700 text-white"
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete Charter
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently
                            delete the charter "
                            <span className="font-semibold">
                                {charter ? charter.name : "this charter"}
                            </span>
                            " and remove all associated data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending
                                ? "Deleting..."
                                : "Delete Charter"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Sign Charter Modal */}
            <Dialog open={showSignCharterModal} onOpenChange={setShowSignCharterModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Sign the Charter</DialogTitle>
                        <DialogDescription>
                            By signing this charter, you agree to abide by all the
                            community guidelines and principles outlined in this document.
                            Your commitment helps maintain a positive and respectful
                            environment for everyone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-gray-700 mb-2">
                            Please confirm your understanding and agreement by clicking
                            "Confirm Signature".
                        </p>
                        <div className="flex items-center space-x-2 text-gray-600 text-sm mt-3">
                            <CheckCircle size={16} className="text-green-500" />
                            <span>I agree to all terms and conditions.</span>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowSignCharterModal(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSignCharter}
                            disabled={signCharterMutation.isPending}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            {signCharterMutation.isPending ? "Signing..." : "Confirm Signature"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}