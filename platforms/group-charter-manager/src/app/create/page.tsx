"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import WysiwygEditor from "@/components/wysiwyg-editor";
import { Label } from "@/components/ui/label";
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
import { apiClient } from "@/lib/apiClient";
import Link from "next/link";

const createCharterSchema = z.object({
    groupId: z.string().min(1, "Please select a group"),
    charter: z.string().min(1, "Charter content is required"),
});

type CreateCharterForm = z.infer<typeof createCharterSchema>;

interface Group {
    id: string;
    name: string;
    description?: string;
    owner: string;
    admins: string[];
    participants: any[];
    charter?: string;
    createdAt: string;
    updatedAt: string;
}

const sampleCharterTemplate = `# Group Charter

## Purpose of This Charter
This charter defines the rules, expectations, and structure of the group. It outlines what the group stands for, how members should interact, and how systems tied to the group should operate — both technically and socially.
## Group Objective
The purpose of is to:
- [Describe the mission or function of the group]
- [e.g., Coordinate actions across distributed agents]
- [e.g., Manage identity validation and reputation enforcement]
## Guidelines
All group members are expected to:
- Act in accordance with the shared values: **[Integrity]**, **[Transparency]**, **[Efficiency]**
- Engage constructively in all decisions or votes
- Avoid malicious behavior or tampering with consensus processes
- Respect the quorum rules and decision thresholds

Optional:
- Disputes will be resolved by [mechanism or majority vote]
## Automated Watchdog Policy

### Watchdog Name:
**Cerberus**

### Purpose:
Cerberus is responsible for continuously monitoring group health, behavior compliance, and triggering pre-defined automated or human actions in case of anomalies.

### Runtime Policy:
Cerberus will operate on the following schedule:
- **Interval:** \`Every 2 hours\` (or \`Every 30 minutes\`, \`Every 1 day\`, etc.)

**Note:** Only intervals specified in this Runtime Policy section will be used for Cerberus scheduling. Other timing requirements (like voting intervals) in other sections will not affect Cerberus.
`;

export default function CreateCharter() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [groups, setGroups] = useState<Group[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const form = useForm<CreateCharterForm>({
        resolver: zodResolver(createCharterSchema),
        defaultValues: {
            groupId: "",
            charter: sampleCharterTemplate,
        },
    });

    // Fetch user's groups
    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const response = await apiClient.get("/api/groups/my");
                setGroups(response.data);
            } catch (error) {
                console.error("Failed to fetch groups:", error);
                toast({
                    title: "Error",
                    description: "Failed to load your groups",
                    variant: "destructive",
                });
            } finally {
                setIsLoading(false);
            }
        };

        if (user) {
            fetchGroups();
        }
    }, [user, toast]);

    const onSubmit = async (data: CreateCharterForm) => {
        try {
            setIsSaving(true);
            
            // Update the group's charter
            await apiClient.put(`/api/groups/${data.groupId}/charter`, {
                charter: data.charter
            });

            toast({
                title: "Success",
                description: "Charter created successfully",
            });

            // Redirect to dashboard
            window.location.href = "/";
        } catch (error) {
            console.error("Failed to create charter:", error);
            toast({
                title: "Error",
                description: "Failed to create charter",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Filter groups to only show those without charters
    const groupsWithoutCharters = groups.filter(group => !group.charter || group.charter.trim() === '');
    
    // Filter groups based on search query (only for groups without charters)
    const filteredGroups = groupsWithoutCharters.filter(group =>
        group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (group.description && group.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

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

    // Check if all groups already have charters
    if (groups.length > 0 && groupsWithoutCharters.length === 0) {
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

                {/* All Groups Have Charters Message */}
                <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow">
                    <CardContent className="p-8 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Check className="h-8 w-8 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-3">
                            All Groups Have Charters!
                        </h2>
                        <p className="text-gray-600 mb-6 max-w-md mx-auto">
                            Great news! All of your groups already have charters attached. 
                            You can view and edit existing charters from the dashboard.
                        </p>
                        <Link href="/">
                            <Button className="gradient-primary text-white px-6 py-3 rounded-2xl font-medium hover:shadow-xl transition-all duration-300">
                                Back to Dashboard
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
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
                            Create a charter for one of your groups
                        </p>
                    </div>

                    <Form {...form}>
                        <form
                            onSubmit={form.handleSubmit(onSubmit)}
                            className="space-y-6 sm:space-y-8"
                        >
                            {/* Group Selection */}
                            <FormField
                                control={form.control}
                                name="groupId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-medium text-gray-700">
                                            Select Group
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
                                                    <CommandInput 
                                                        placeholder="Search groups..." 
                                                        value={searchQuery}
                                                        onValueChange={setSearchQuery}
                                                    />
                                                    <CommandList>
                                                        <CommandEmpty>
                                                            No groups found.
                                                        </CommandEmpty>
                                                        <CommandGroup>
                                                            {filteredGroups?.map(
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
                                                                            // Update charter template with group name
                                                                            const updatedCharter = sampleCharterTemplate.replace(
                                                                                /\[Group Name\]/g,
                                                                                group.name
                                                                            );
                                                                            form.setValue("charter", updatedCharter);
                                                                        }}
                                                                        className="cursor-pointer"
                                                                    >
                                                                        <div className="flex items-center space-x-3 w-full">
                                                                            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                                                                <span className="text-amber-600 font-medium text-sm">
                                                                                    {group.name.charAt(0).toUpperCase()}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex-1">
                                                                                <p className="font-medium">
                                                                                    {
                                                                                        group.name
                                                                                    }
                                                                                </p>
                                                                                {group.description && (
                                                                                    <p className="text-sm text-gray-500">
                                                                                        {group.description}
                                                                                    </p>
                                                                                )}
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

                            {/* Charter Content */}
                            <FormField
                                control={form.control}
                                name="charter"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-medium text-gray-700">
                                            Charter Content
                                        </FormLabel>
                                        <FormControl>
                                            <WysiwygEditor
                                                content={field.value || ""}
                                                onChange={field.onChange}
                                                placeholder="Write your group charter here..."
                                                className="focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-200 transition-all duration-200"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

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
                                <Button
                                    type="submit"
                                    disabled={isSaving}
                                    className="w-full sm:flex-1 gradient-primary text-white px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-semibold hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                                >
                                    <Save className="mr-2" size={16} />
                                    {isSaving ? "Creating Charter..." : "Create Charter"}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
