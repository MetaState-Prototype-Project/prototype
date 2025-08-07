"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    ArrowLeft,
    Save,
    Plus,
    Instagram,
    Facebook,
    MessageCircle,
    Check,
    ChevronsUpDown,
} from "lucide-react";
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

const createCharterSchema = insertCharterSchema.extend({
    guidelines: z
        .array(z.string())
        .min(1, "At least one guideline is required"),
});

type CreateCharterForm = z.infer<typeof createCharterSchema>;

export default function CreateCharter() {
    const { toast } = useToast();
    const [guidelines, setGuidelines] = useState<string[]>(["", "", ""]);
    const { user } = useAuth();

    const { data: groups, isLoading } = { data: [], isLoading: false }; // TODO: Replace with API call to fetch connected groups

    const form = useForm<CreateCharterForm>({
        resolver: zodResolver(createCharterSchema),
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

    const onSubmit = async (data: CreateCharterForm) => {
        console.log("Form submission started");
        console.log("Form data:", data);
        console.log("Form errors:", form.formState.errors);
        console.log("Guidelines state:", guidelines);
        console.log("Form valid:", form.formState.isValid);

        // Ensure guidelines are properly included in form data
        const filteredGuidelines = guidelines.filter((g) => g.trim() !== "");
        const finalData = {
            ...data,
            guidelines: filteredGuidelines,
        };

        console.log("Submitting charter data:", finalData);

        try {
            // TODO: Submit the charter data to the API
            console.log("Charter created successfully");
        } catch (error) {
            console.error("Error in charter creation:", error);
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

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-black bg-opacity-10 rounded w-1/4" />
                    <div className="h-96 bg-black bg-opacity-10 rounded-3xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
            {/* Back Button */}
            <div className="mb-4 sm:mb-6">
                <Link href="/">
                    <Button
                        variant="ghost"
                        className="inline-flex items-center text-gray-600 hover:text-gray-800 transition-colors duration-200 p-2 sm:p-3"
                    >
                        <ArrowLeft className="mr-2" size={16} />
                        <span className="text-sm sm:text-base">
                            Back to Dashboard
                        </span>
                    </Button>
                </Link>
            </div>

            {/* Create Charter Form */}
            <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow">
                <CardContent className="p-4 sm:p-6 lg:p-8">
                    <div className="mb-6 sm:mb-8">
                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
                            Create New Charter
                        </h2>
                        <p className="text-gray-600 text-sm sm:text-base">
                            Set up community guidelines and structure for your
                            social media group
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
                                                                                className="w-8 h-8 rounded-lg object-cover"
                                                                            />
                                                                            <div className="flex-1">
                                                                                <p className="font-medium">
                                                                                    {
                                                                                        group.name
                                                                                    }
                                                                                </p>
                                                                                <div className="flex items-center space-x-2 text-sm text-gray-500">
                                                                                    <PlatformBadge
                                                                                        platform={
                                                                                            group.platform
                                                                                        }
                                                                                        className="text-xs"
                                                                                    />
                                                                                    <span>
                                                                                        •{" "}
                                                                                        {
                                                                                            group.memberCount
                                                                                        }{" "}
                                                                                        members
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            <Check
                                                                                className={cn(
                                                                                    "ml-auto h-4 w-4",
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
                                                placeholder="Describe the purpose and goals of this charter..."
                                                className="focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-200 transition-all duration-200"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Community Guidelines */}
                            <div>
                                <Label className="text-sm font-medium text-gray-700 mb-3 block">
                                    Community Guidelines
                                </Label>
                                <div className="space-y-3">
                                    {guidelines.map((guideline, index) => (
                                        <div
                                            key={index}
                                            className="flex items-start space-x-3"
                                        >
                                            <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center mt-1">
                                                <span className="text-amber-600 font-medium text-sm">
                                                    {index + 1}
                                                </span>
                                            </div>
                                            <Input
                                                placeholder={`Enter ${
                                                    index === 0
                                                        ? "first"
                                                        : index === 1
                                                        ? "second"
                                                        : "third"
                                                } guideline...`}
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
                                <Link href="/">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full sm:flex-1 bg-white/70 backdrop-blur-xs text-gray-700 px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-semibold hover:bg-white/90 transition-all duration-300 shadow-lg"
                                    >
                                        Cancel
                                    </Button>
                                </Link>
                                {/* TODO: Set charter's isPending property to this disabled button */}
                                <Button
                                    type="submit"
                                    disabled={false}
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
                                    {/* TODO: Change to this
                                    {createCharterMutation.isPending
                                        ? "Creating Charter..."
                                        : "Create Charter"} */}
                                    Create Charter
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
