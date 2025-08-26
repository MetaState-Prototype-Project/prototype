"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    Plus,
    X,
    Eye,
    UserX,
    ChartLine,
    ListOrdered,
    CircleUser,
    Vote,
    Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { pollApi, type Group } from "@/lib/pollApi";
import { useRouter } from "next/navigation";
import Link from "next/link";

const createPollSchema = z.object({
    title: z.string().min(1, "Poll title is required"),
    mode: z.enum(["normal", "point", "rank"]),
    visibility: z.enum(["public", "private"]),
    groupId: z.string().min(1, "Please select a group").refine((val) => {
        // This will be validated in the onSubmit function with the actual groups data
        return true;
    }, "Please select a valid group"),
    options: z
        .array(z.string()
            .min(1, "Option cannot be empty")
            .refine((val) => !val.includes(','), "Commas are not allowed in option text")
        )
        .min(2, "At least 2 options required"),
    deadline: z
        .string()
        .min(1, "Deadline is required")
        .refine((val) => {
            const date = new Date(val);
            return !Number.isNaN(date.getTime()) && date > new Date();
        }, "Deadline must be a valid future date"),
});

type CreatePollForm = z.infer<typeof createPollSchema>;

export default function CreatePoll() {
    const { toast } = useToast();
    const router = useRouter();
    const [options, setOptions] = useState<string[]>(["", ""]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [groups, setGroups] = useState<Group[]>([]);
    const [isLoadingGroups, setIsLoadingGroups] = useState(true);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<CreatePollForm>({
        resolver: zodResolver(createPollSchema),
        defaultValues: {
            title: "",
            mode: "normal",
            visibility: "public",
            groupId: "",
            options: ["", ""],
            deadline: "",
        },
    });

    // Helper function to sort groups: chartered first, then by name
    const sortGroupsByCharterStatus = (groups: Group[]) => {
        return [...groups].sort((a, b) => {
            const aChartered = a.charter && a.charter.trim() !== "";
            const bChartered = b.charter && b.charter.trim() !== "";
            
            if (aChartered && !bChartered) return -1;
            if (!aChartered && bChartered) return 1;
            
            // If both have same charter status, sort by name (with null safety)
            const aName = a.name || "";
            const bName = b.name || "";
            return aName.localeCompare(bName);
        });
    };

    // Fetch user's groups on component mount
    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const userGroups = await pollApi.getUserGroups();
                // Ensure groups is always an array and sort by charter status
                const sortedGroups = Array.isArray(userGroups) ? sortGroupsByCharterStatus(userGroups) : [];
                setGroups(sortedGroups);
            } catch (error) {
                console.error("Failed to fetch groups:", error);
                setGroups([]); // Set empty array on error
                toast({
                    title: "Error",
                    description: "Failed to load your groups. Please try again.",
                    variant: "destructive",
                });
            } finally {
                setIsLoadingGroups(false);
            }
        };

        fetchGroups();
    }, [toast]);


    const watchedMode = watch("mode");
    const watchedVisibility = watch("visibility");

    // Force simple voting when private visibility is selected
    React.useEffect(() => {
        if (watchedVisibility === "private" && watchedMode !== "normal") {
            setValue("mode", "normal");
        }
    }, [watchedVisibility, watchedMode, setValue]);

    const addOption = () => {
        const newOptions = [...options, ""];
        setOptions(newOptions);
        setValue("options", newOptions);
    };

    const removeOption = (index: number) => {
        if (options.length > 2) {
            const newOptions = options.filter((_, i) => i !== index);
            setOptions(newOptions);
            setValue("options", newOptions);
        }
    };

    const updateOption = (index: number, value: string) => {
        // Prevent commas in option text
        if (value.includes(',')) {
            toast({
                title: "Invalid Option",
                description: "Commas are not allowed in option text as they can break the voting system.",
                variant: "destructive",
            });
            return;
        }
        
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
        setValue("options", newOptions);
    };

    const onSubmit = async (data: CreatePollForm) => {
        setIsSubmitting(true);
        try {
            // Validate that the selected group is chartered
            const selectedGroup = groups.find(group => group.id === data.groupId);
            if (!selectedGroup) {
                toast({
                    title: "Error",
                    description: "Please select a valid group",
                    variant: "destructive",
                });
                return;
            }

            if (!selectedGroup.charter || selectedGroup.charter.trim() === "") {
                toast({
                    title: "Error",
                    description: "Only chartered groups can create polls. Please select a group with a charter.",
                    variant: "destructive",
                });
                return;
            }

            // Convert local deadline to UTC before sending to backend
            let utcDeadline: string | undefined;
            if (data.deadline) {
                // Create a Date object from the local datetime-local input
                const localDate = new Date(data.deadline);
                // Convert to UTC ISO string
                utcDeadline = localDate.toISOString();
            }

            await pollApi.createPoll({
                title: data.title,
                mode: data.mode,
                visibility: data.visibility,
                groupId: data.groupId,
                options: data.options.filter(option => option.trim() !== ""),
                deadline: utcDeadline
            });
            
            toast({
                title: "Success!",
                description: "Poll created successfully",
            });
            
            router.push("/");
        } catch (error: any) {
            console.error("Failed to create poll:", error);
            
            // Show specific error message from backend if available
            let errorMessage = "Failed to create poll. Please try again.";
            if (error?.response?.data?.error) {
                errorMessage = error.response.data.error;
            }
            
            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                Create New Vote
            </h1>

            <form
                onSubmit={handleSubmit(onSubmit)}
                className="card p-8 space-y-6"
            >
                {/* Vote Question */}
                <div>
                    <Label className="text-sm font-semibold text-gray-700">
                        Vote Question
                    </Label>
                    <Input
                        {...register("title")}
                        placeholder="Enter your vote question"
                        className="mt-2 focus:ring-(--crimson) focus:border-(--crimson)"
                        required
                    />
                    {errors.title && (
                        <p className="mt-1 text-sm text-red-600">
                            {errors.title.message}
                        </p>
                    )}
                </div>

                {/* Group Selection */}
                <div>
                    <Label className="text-sm font-semibold text-gray-700">
                        Group
                    </Label>
                    {!isLoadingGroups && groups.length > 0 && (
                        <div className="mt-1 mb-2 text-xs text-gray-600">
                            {(() => {
                                const charteredCount = groups.filter(group => group.charter && group.charter.trim() !== "").length;
                                const totalCount = groups.length;
                                return `${charteredCount} of ${totalCount} groups are chartered`;
                            })()}
                        </div>
                    )}
                    <Select onValueChange={(value) => setValue("groupId", value)}>
                        <SelectTrigger className="w-full mt-2">
                            <SelectValue placeholder="Select a group" />
                        </SelectTrigger>
                        <SelectContent>
                            {isLoadingGroups ? (
                                <SelectItem value="loading" disabled>Loading groups...</SelectItem>
                            ) : !Array.isArray(groups) || groups.length === 0 ? (
                                <SelectItem value="no-groups" disabled>No groups found. Create one!</SelectItem>
                            ) : (
                                (() => {
                                    const charteredGroups = groups.filter(group => group.charter && group.charter.trim() !== "");
                                    const nonCharteredGroups = groups.filter(group => !group.charter || group.charter.trim() === "");
                                    
                                    return (
                                        <>
                                            {/* Chartered Groups */}
                                            {charteredGroups.length > 0 && (
                                                <>
                                                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">
                                                        Chartered Groups
                                                    </div>
                                                    {charteredGroups.map((group) => (
                                                        <SelectItem 
                                                            key={group.id} 
                                                            value={group.id}
                                                        >
                                                            <div className="flex items-center justify-between w-full">
                                                                <span>{group.name}</span>
                                                                <span className="text-xs text-green-600 ml-2">
                                                                    ✓ Chartered
                                                                </span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </>
                                            )}
                                            
                                            {/* Non-Chartered Groups */}
                                            {nonCharteredGroups.length > 0 && (
                                                <>
                                                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">
                                                        Non-Chartered Groups
                                                    </div>
                                                    {nonCharteredGroups.map((group) => (
                                                        <SelectItem 
                                                            key={group.id} 
                                                            value={group.id}
                                                            disabled
                                                            className="opacity-60 cursor-not-allowed"
                                                        >
                                                            <div className="flex items-center justify-between w-full">
                                                                <span>{group.name}</span>
                                                                <span className="text-xs text-gray-500 ml-2">
                                                                    (Not chartered)
                                                                </span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </>
                                            )}
                                        </>
                                    );
                                })()
                            )}
                        </SelectContent>
                    </Select>
                    <p className="mt-1 text-sm text-gray-500">
                        Only chartered groups can create polls. Groups without a charter will be disabled.
                    </p>
                    {errors.groupId && (
                        <p className="mt-1 text-sm text-red-600">
                            {errors.groupId.message}
                        </p>
                    )}
                </div>

                {/* Vote Deadline */}
                <div>
                    <Label className="text-sm font-semibold text-gray-700">
                        Vote Deadline
                    </Label>
                    <Input
                        {...register("deadline")}
                        type="datetime-local"
                        className="mt-2 focus:ring-(--crimson) focus:border-(--crimson)"
                        required
                    />
                    <p className="mt-1 text-sm text-gray-500">
                        Set a deadline for when voting will end. 
                    </p>
                    {errors.deadline && (
                        <p className="mt-1 text-sm text-red-600">
                            {errors.deadline.message}
                        </p>
                    )}
                </div>

                {/* Vote Visibility */}
                <div>
                    <Label className="text-sm font-semibold text-gray-700">
                        Vote Visibility
                    </Label>
                    <div className="mt-2 space-y-3">
                        <Label className={`flex items-center cursor-pointer p-4 border-2 rounded-lg transition-all duration-200 ${
                            watchedVisibility === "public" 
                                ? "border-(--crimson) bg-(--crimson) text-white" 
                                : "border-gray-300 hover:border-gray-400"
                        }`}>
                            <input
                                type="radio"
                                value="public"
                                {...register("visibility")}
                                className="sr-only"
                            />
                            <div className="flex items-center">
                                <Eye className="w-6 h-6 mr-3" />
                                <div>
                                    <div className="font-semibold">Public</div>
                                    <div className="text-sm opacity-90">Voters are public</div>
                                </div>
                            </div>
                        </Label>

                        <Label className={`flex items-center cursor-pointer p-4 border-2 rounded-lg transition-all duration-200 ${
                            watchedVisibility === "private" 
                                ? "border-(--crimson) bg-(--crimson) text-white" 
                                : "border-gray-300 hover:border-gray-400"
                        }`}>
                            <input
                                type="radio"
                                value="private"
                                {...register("visibility")}
                                className="sr-only"
                            />
                            <div className="flex items-center">
                                <UserX className="w-6 h-6 mr-3" />
                                <div>
                                    <div className="font-semibold">Private</div>
                                    <div className="text-sm opacity-90">Voters are hidden</div>
                                </div>
                            </div>
                        </Label>
                    </div>
                    {errors.visibility && (
                        <p className="mt-1 text-sm text-red-600">
                            {errors.visibility.message}
                        </p>
                    )}
                </div>

                {/* Vote Type */}
                <div>
                    <Label className="text-sm font-semibold text-gray-700">
                        Vote Type
                    </Label>
                    <div className="mt-2 space-y-3">
                        <Label className={`flex items-center cursor-pointer p-4 border-2 rounded-lg transition-all duration-200 ${
                            watchedMode === "normal" 
                                ? "border-(--crimson) bg-(--crimson) text-white" 
                                : "border-gray-300 hover:border-gray-400"
                        }`}>
                            <input
                                type="radio"
                                value="normal"
                                {...register("mode")}
                                className="sr-only"
                            />
                            <div className="flex items-center">
                                <CircleUser className="w-6 h-6 mr-3" />
                                <div>
                                    <div className="font-semibold">Simple</div>
                                    <div className="text-sm opacity-90">Select one option to vote for</div>
                                </div>
                            </div>
                        </Label>

                        <Label className={`flex items-center cursor-pointer p-4 border-2 rounded-lg transition-all duration-200 ${
                            watchedMode === "point" 
                                ? "border-(--crimson) bg-(--crimson) text-white" 
                                : watchedVisibility === "private"
                                ? "border-gray-300 bg-gray-100 opacity-50 cursor-not-allowed"
                                : "border-gray-300 hover:border-gray-400"
                        }`}>
                            <input
                                type="radio"
                                value="point"
                                {...register("mode")}
                                className="sr-only"
                                disabled={watchedVisibility === "private"}
                            />
                            <div className="flex items-center">
                                <ChartLine className="w-6 h-6 mr-3" />
                                <div>
                                    <div className="font-semibold">PBV</div>
                                    <div className="text-sm opacity-90">Each voter gets 100 points</div>
                                </div>
                            </div>
                        </Label>

                        <Label className={`flex items-center cursor-pointer p-4 border-2 rounded-lg transition-all duration-200 ${
                            watchedMode === "rank" 
                                ? "border-(--crimson) bg-(--crimson) text-white" 
                                : watchedVisibility === "private"
                                ? "border-gray-300 bg-gray-100 opacity-50 cursor-not-allowed"
                                : "border-gray-300 hover:border-gray-400"
                        }`}>
                            <input
                                type="radio"
                                value="rank"
                                {...register("mode")}
                                className="sr-only"
                                disabled={watchedVisibility === "private"}
                            />
                            <div className="flex items-center">
                                <ListOrdered className="w-6 h-6 mr-3" />
                                <div>
                                    <div className="font-semibold">RBV</div>
                                    <div className="text-sm opacity-90">Voters can rank order the choices</div>
                                </div>
                            </div>
                        </Label>
                    </div>
                    {errors.mode && (
                        <p className="mt-1 text-sm text-red-600">
                            {errors.mode.message}
                        </p>
                    )}
                </div>

                {/* Voting Weight */}
                <div>
                    <Label className="text-sm font-semibold text-gray-700">
                        Voting Weight
                    </Label>
                    <RadioGroup
                        value=""
                        disabled
                        className="mt-2"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Label className="flex items-center cursor-not-allowed opacity-50">
                                <RadioGroupItem
                                    value="1p1v"
                                    className="sr-only"
                                    disabled
                                />
                                <div className="border-2 border-gray-300 rounded-lg p-4 w-full h-24 bg-gray-50">
                                    <div className="flex items-center">
                                        <CircleUser className="text-gray-400 w-6 h-6 mr-3" />
                                        <div>
                                            <div className="font-semibold text-gray-500">
                                                1P 1V
                                            </div>
                                            <div className="text-sm text-gray-400">
                                                One person, one vote
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Label>
                            <Label className="flex items-center cursor-not-allowed opacity-50">
                                <RadioGroupItem
                                    value="ereputation"
                                    className="sr-only"
                                    disabled
                                />
                                <div className="border-2 border-gray-300 rounded-lg p-4 w-full h-24 bg-gray-50">
                                    <div className="flex items-center">
                                        <ChartLine className="text-gray-400 w-6 h-6 mr-3" />
                                        <div>
                                            <div className="font-semibold text-gray-500">
                                                eReputation Weighted
                                            </div>
                                            <div className="text-sm text-gray-400">
                                                Votes weighted by eReputation
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Label>
                        </div>
                    </RadioGroup>
                    <p className="mt-2 text-sm text-gray-500">Coming soon - currently disabled</p>
                </div>

                {/* Vote Options */}
                <div>
                    <Label className="text-sm font-semibold text-gray-700">
                        Vote Options
                    </Label>
                    <div className="mt-2 space-y-3">
                        {options.map((option, index) => (
                            <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: jatt dont care OOOOOOOOOO
                                key={index}
                                className="flex items-center space-x-2"
                            >
                                <Input
                                    value={option}
                                    onChange={(e) =>
                                        updateOption(index, e.target.value)
                                    }
                                    placeholder={`Option ${index + 1}`}
                                    className="flex-1 focus:ring-(--crimson) focus:border-(--crimson)"
                                    required
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeOption(index)}
                                    disabled={options.length <= 2}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end mt-3">
                        <Button
                            type="button"
                            onClick={addOption}
                            className="bg-red-50 text-(--crimson) border-(--crimson) border hover:bg-red-100 transition-all duration-200"
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Option
                        </Button>
                    </div>
                    {errors.options && (
                        <p className="mt-1 text-sm text-red-600">
                            {errors.options.message}
                        </p>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <Link href="/">
                        <Button
                            type="button"
                            className="flex-1 bg-red-50 text-(--crimson) border-(--crimson) border hover:bg-red-100 transition-all duration-200"
                        >
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                        </Button>
                    </Link>
                    <Button
                        type="submit"
                        className="flex-1 bg-(--crimson) hover:bg-(--crimson-50) hover:text-(--crimson) hover:border-(--crimson) border text-white"
                    >
                        Create Vote
                    </Button>
                </div>
            </form>
        </div>
    );
}
