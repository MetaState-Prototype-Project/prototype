"use client";

import { useState, useEffect, use } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, Plus, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import WysiwygEditor from "@/components/wysiwyg-editor";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { PlatformBadge } from "@/components/platform-badge";
import Link from "next/link";

const insertCharterSchema = z.object({
    id: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

const editCharterSchema = insertCharterSchema.extend({
    guidelines: z
        .array(z.string())
        .min(1, "At least one guideline is required"),
});

type EditCharterForm = z.infer<typeof editCharterSchema>;

export default function EditCharter({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const { toast } = useToast();
    const [guidelines, setGuidelines] = useState<string[]>([]);
    const { user } = useAuth();

    const { data: charter, isLoading: charterLoading } = {
        data: null,
        isLoading: false,
    }; // Replace with actual data fetching logic

    const { data: groups, isLoading: groupsLoading } = {
        data: [],
        isLoading: false,
    }; // Replace with actual groups fetching logic

    const form = useForm<EditCharterForm>({
        resolver: zodResolver(editCharterSchema),
        defaultValues: {
            name: "",
            description: "",
            guidelines: [],
            groupId: undefined,
            isActive: true,
            autoApprove: false,
            allowPosts: true,
        },
    });

    // Populate form when charter data is loaded
    useEffect(() => {
        if (charter && charter.name) {
            const guidelines = charter.guidelines || [];

            console.log("Charter data loaded:", charter);
            console.log("Charter name:", charter.name);
            console.log("Charter description:", charter.description);
            console.log("Charter guidelines:", guidelines);
            console.log("Charter groupId:", charter.groupId);

            // Set guidelines state first
            setGuidelines(guidelines.length > 0 ? guidelines : [""]);

            // Reset form with current charter data
            const formValues = {
                name: charter.name || "",
                description: charter.description || "",
                guidelines: guidelines,
                groupId: charter.groupId || undefined,
                isActive:
                    charter.isActive !== undefined ? charter.isActive : true,
                autoApprove:
                    charter.autoApprove !== undefined
                        ? charter.autoApprove
                        : false,
                allowPosts:
                    charter.allowPosts !== undefined
                        ? charter.allowPosts
                        : true,
            };

            console.log("Form values to set:", formValues);

            // Use reset to populate all form fields at once
            form.reset(formValues);

            // Also manually set values to ensure they stick
            setTimeout(() => {
                form.setValue("name", charter.name || "");
                form.setValue("description", charter.description || "");
                form.setValue("guidelines", guidelines);
                form.setValue("groupId", charter.groupId || undefined);
                form.setValue(
                    "isActive",
                    charter.isActive !== undefined ? charter.isActive : true
                );
                form.setValue(
                    "autoApprove",
                    charter.autoApprove !== undefined
                        ? charter.autoApprove
                        : false
                );
                form.setValue(
                    "allowPosts",
                    charter.allowPosts !== undefined ? charter.allowPosts : true
                );
            }, 100);
        }
    }, [charter, form]);

    const onSubmit = async (data: EditCharterForm) => {
        const filteredGuidelines = guidelines.filter((g) => g.trim() !== "");
        const finalData = {
            ...data,
            guidelines: filteredGuidelines,
        };

        try {
            console.log("Updating charter with data:", finalData);
            // TODO: Replace with actual API call to update the charter
        } catch (error) {
            console.error("Error in charter update:", error);
        }
    };

    const addGuideline = () => {
        setGuidelines([...guidelines, ""]);
    };

    const updateGuideline = (index: number, value: string) => {
        const newGuidelines = [...guidelines];
        newGuidelines[index] = value;
        setGuidelines(newGuidelines);

        // Update the form with the current guidelines
        const filteredGuidelines = newGuidelines.filter((g) => g.trim() !== "");
        form.setValue("guidelines", filteredGuidelines);
    };

    const removeGuideline = (index: number) => {
        const newGuidelines = guidelines.filter((_, i) => i !== index);
        setGuidelines(newGuidelines);

        // Update the form with the current guidelines
        const filteredGuidelines = newGuidelines.filter((g) => g.trim() !== "");
        form.setValue("guidelines", filteredGuidelines);
    };

    if (charterLoading || groupsLoading) {
        return (
            <div className="min-h-screen gradient-bg flex items-center justify-center">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-black bg-opacity-10 rounded w-32 mx-auto" />
                    <div className="h-4 bg-black bg-opacity-10 rounded w-48 mx-auto">
                        Loading charter...
                    </div>
                </div>
            </div>
        );
    }

    if (!charter) {
        return (
            <div className="min-h-screen gradient-bg flex items-center justify-center">
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold text-gray-800">
                        Charter Not Found
                    </h1>
                    <p className="text-gray-600">
                        The charter you're looking for doesn't exist.
                    </p>
                    <Link href="/">
                        <Button className="gradient-primary text-white">
                            Go to Dashboard
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen gradient-bg p-4 sm:p-6 lg:p-8">
            <Card className="max-w-4xl mx-auto glass-morphism backdrop-blur-xl shadow-2xl border-0">
                <CardContent className="p-4 sm:p-6 lg:p-8">
                    <div className="mb-6 sm:mb-8">
                        <div className="flex items-center mb-4">
                            <Link href={`/charter/${id}`}>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="mr-3 text-gray-600 hover:text-gray-800 hover:bg-white/40 rounded-xl"
                                >
                                    <ArrowLeft className="mr-2" size={16} />
                                    Back to Charter
                                </Button>
                            </Link>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
                            Edit Charter
                        </h2>
                        <p className="text-gray-600 text-sm sm:text-base">
                            Update your community guidelines and settings
                        </p>
                    </div>

                    <Form {...form}>
                        <form
                            onSubmit={form.handleSubmit(onSubmit)}
                            className="space-y-6 sm:space-y-8"
                        >
                            {/* Charter Name */}
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-medium text-gray-700">
                                            Charter Name
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Enter charter name"
                                                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all duration-200 bg-white/80 backdrop-blur-xs"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Connected Groups */}
                            <FormField
                                control={form.control}
                                name="groupId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-medium text-gray-700">
                                            Select Connected Group
                                        </FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        className={cn(
                                                            "w-full justify-between rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-xs px-4 py-3 h-auto",
                                                            !field.value &&
                                                                "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value
                                                            ? groups?.find(
                                                                  (group) =>
                                                                      group.id ===
                                                                      field.value
                                                              )?.name
                                                            : "Select a group..."}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-full p-0 rounded-2xl">
                                                <Command>
                                                    <CommandInput placeholder="Search groups..." />
                                                    <CommandList>
                                                        <CommandEmpty>
                                                            No groups found.
                                                        </CommandEmpty>
                                                        <CommandGroup>
                                                            {groups?.map(
                                                                (group) => (
                                                                    <CommandItem
                                                                        key={
                                                                            group.id
                                                                        }
                                                                        value={
                                                                            group.name
                                                                        }
                                                                        onSelect={() => {
                                                                            form.setValue(
                                                                                "groupId",
                                                                                group.id
                                                                            );
                                                                        }}
                                                                        className="cursor-pointer"
                                                                    >
                                                                        <div className="flex items-center space-x-3 w-full">
                                                                            <img
                                                                                src={
                                                                                    group.imageUrl ||
                                                                                    "https://via.placeholder.com/32"
                                                                                }
                                                                                alt={
                                                                                    group.name
                                                                                }
                                                                                className="w-8 h-8 rounded-full object-cover"
                                                                            />
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center space-x-2">
                                                                                    <span className="font-medium text-gray-800 truncate">
                                                                                        {
                                                                                            group.name
                                                                                        }
                                                                                    </span>
                                                                                    <PlatformBadge
                                                                                        platform={
                                                                                            group.platform
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                                <p className="text-sm text-gray-500 truncate">
                                                                                    {
                                                                                        group.memberCount
                                                                                    }{" "}
                                                                                    members
                                                                                </p>
                                                                            </div>
                                                                            <Check
                                                                                className={cn(
                                                                                    "mr-2 h-4 w-4",
                                                                                    field.value ===
                                                                                        group.id
                                                                                        ? "opacity-100"
                                                                                        : "opacity-0"
                                                                                )}
                                                                            />
                                                                        </div>
                                                                    </CommandItem>
                                                                )
                                                            )}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Charter Description */}
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-medium text-gray-700">
                                            Charter Description
                                        </FormLabel>
                                        <FormControl>
                                            <WysiwygEditor
                                                content={field.value || ""}
                                                onChange={field.onChange}
                                                placeholder="Describe your charter's purpose and goals..."
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Charter Guidelines */}
                            <div className="space-y-3">
                                <Label className="text-sm font-medium text-gray-700">
                                    Charter Guidelines
                                </Label>
                                <div className="space-y-3">
                                    {guidelines.map((guideline, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center space-x-3"
                                        >
                                            <Input
                                                placeholder={`Guideline ${
                                                    index + 1
                                                }`}
                                                className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all duration-200 bg-white/80 backdrop-blur-xs"
                                                value={guideline}
                                                onChange={(e) =>
                                                    updateGuideline(
                                                        index,
                                                        e.target.value
                                                    )
                                                }
                                            />
                                            {guidelines.length > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        removeGuideline(index)
                                                    }
                                                    className="text-red-600 hover:text-red-700 mt-1"
                                                >
                                                    ×
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={addGuideline}
                                    className="mt-3 text-amber-600 hover:text-amber-700 font-medium text-sm"
                                >
                                    <Plus className="mr-2" size={16} />
                                    Add Another Guideline
                                </Button>
                            </div>

                            {/* Charter Settings */}
                            <div className="space-y-4 sm:space-y-6">
                                <div className="border-t pt-6">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                                        Charter Settings
                                    </h3>

                                    <div className="space-y-4">
                                        {/* Auto-approve new members */}
                                        <FormField
                                            control={form.control}
                                            name="autoApprove"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/70 backdrop-blur-xs border border-gray-200">
                                                        <div className="flex-1">
                                                            <FormLabel className="text-sm font-medium text-gray-700">
                                                                Auto-approve new
                                                                members
                                                            </FormLabel>
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {field.value
                                                                    ? "Enabled"
                                                                    : "Disabled"}
                                                            </p>
                                                        </div>
                                                        <FormControl>
                                                            <Switch
                                                                checked={
                                                                    field.value
                                                                }
                                                                onCheckedChange={
                                                                    field.onChange
                                                                }
                                                            />
                                                        </FormControl>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {/* Allow member posts */}
                                        <FormField
                                            control={form.control}
                                            name="allowPosts"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/70 backdrop-blur-xs border border-gray-200">
                                                        <div className="flex-1">
                                                            <FormLabel className="text-sm font-medium text-gray-700">
                                                                Allow member
                                                                posts
                                                            </FormLabel>
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {field.value
                                                                    ? "Enabled"
                                                                    : "Disabled"}
                                                            </p>
                                                        </div>
                                                        <FormControl>
                                                            <Switch
                                                                checked={
                                                                    field.value
                                                                }
                                                                onCheckedChange={
                                                                    field.onChange
                                                                }
                                                            />
                                                        </FormControl>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {/* Charter status */}
                                        <FormField
                                            control={form.control}
                                            name="isActive"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/70 backdrop-blur-xs border border-gray-200">
                                                        <div className="flex-1">
                                                            <FormLabel className="text-sm font-medium text-gray-700">
                                                                Charter status
                                                            </FormLabel>
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {field.value
                                                                    ? "Active"
                                                                    : "Inactive"}
                                                            </p>
                                                        </div>
                                                        <FormControl>
                                                            <Switch
                                                                checked={
                                                                    field.value
                                                                }
                                                                onCheckedChange={
                                                                    field.onChange
                                                                }
                                                            />
                                                        </FormControl>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Form Actions */}
                            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 pt-4 sm:pt-6">
                                <Link href={`/charter/${id}`}>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full sm:flex-1 bg-white/70 backdrop-blur-xs text-gray-700 px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-semibold hover:bg-white/90 transition-all duration-300 shadow-lg"
                                    >
                                        Cancel
                                    </Button>
                                </Link>
                                <Button
                                    type="submit"
                                    // disabled={updateCharterMutation.isPending}
                                    disabled={false} // Replace with actual mutation state
                                    onClick={(e) => {
                                        // Update form with current guidelines before validation
                                        const filteredGuidelines =
                                            guidelines.filter(
                                                (g) => g.trim() !== ""
                                            );
                                        form.setValue(
                                            "guidelines",
                                            filteredGuidelines
                                        );
                                    }}
                                    className="w-full sm:flex-1 gradient-primary text-white px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-semibold hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                                >
                                    <Save className="mr-2" size={16} />
                                    {/* TODO: Replace with actual mutation
                                    {updateCharterMutation.isPending
                                        ? "Updating Charter..."
                                        : "Update Charter"} */}
                                    Update Charter
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
