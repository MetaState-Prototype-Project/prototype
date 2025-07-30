"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Eye, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import Link from "next/link";

const createPollSchema = z.object({
    title: z.string().min(1, "Poll title is required"),
    mode: z.enum(["public", "private"]),
    options: z
        .array(z.string().min(1, "Option cannot be empty"))
        .min(2, "At least 2 options required"),
    deadline: z
        .string()
        .optional()
        .refine((val) => {
            if (!val) return true; // Allow empty deadline
            const date = new Date(val);
            return !isNaN(date.getTime()) && date > new Date();
        }, "Deadline must be a valid future date"),
});

type CreatePollForm = z.infer<typeof createPollSchema>;

export default function CreatePoll() {
    const { toast } = useToast();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const [options, setOptions] = useState<string[]>(["", ""]);

    // TODO: Redirect to login if not authenticated
    // useEffect(() => {
    //     if (!authLoading && !isAuthenticated) {
    //         toast({
    //             title: "Unauthorized",
    //             description: "You are logged out. Logging in again...",
    //             variant: "destructive",
    //         });
    //         setTimeout(() => {
    //             window.location.href = "/api/login";
    //         }, 500);
    //         return;
    //     }
    // }, [isAuthenticated, authLoading, toast]);

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
            mode: "public",
            options: ["", ""],
            deadline: "",
        },
    });

    const watchedMode = watch("mode");

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
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
        setValue("options", newOptions);
    };

    const onSubmit = (data: CreatePollForm) => {
        // TODO: replace with actual API call to create poll
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
                <div>
                    <Label
                        htmlFor="title"
                        className="text-sm font-semibold text-gray-700"
                    >
                        Vote Question
                    </Label>
                    <Input
                        id="title"
                        {...register("title")}
                        placeholder="Enter your vote question"
                        className="mt-2 focus:ring-(--crimson) focus:border-(--crimson)"
                    />
                    {errors.title && (
                        <p className="mt-1 text-sm text-red-600">
                            {errors.title.message}
                        </p>
                    )}
                </div>

                <div>
                    <Label className="text-sm font-semibold text-gray-700">
                        Vote Type
                    </Label>
                    <RadioGroup
                        value={watchedMode}
                        onValueChange={(value) =>
                            setValue("mode", value as "public" | "private")
                        }
                        className="mt-2"
                    >
                        <div className="flex items-center space-x-4">
                            <Label className="flex items-center cursor-pointer">
                                <RadioGroupItem
                                    value="public"
                                    className="sr-only"
                                />
                                <div
                                    className={`border-2 rounded-lg p-4 flex-1 transition-all ${
                                        watchedMode === "public"
                                            ? "border-(--crimson) bg-(--crimson-50)"
                                            : "border-gray-300 hover:border-(--crimson)"
                                    }`}
                                >
                                    <div className="flex items-center">
                                        <Eye className="text-(--crimson) w-6 h-6 mr-3" />
                                        <div>
                                            <div className="font-semibold text-gray-900">
                                                Public
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                Voters are public
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Label>

                            <Label className="flex items-center cursor-pointer">
                                <RadioGroupItem
                                    value="private"
                                    className="sr-only"
                                />
                                <div
                                    className={`border-2 rounded-lg p-4 flex-1 transition-all ${
                                        watchedMode === "private"
                                            ? "border-(--crimson) bg-(--crimson-50)"
                                            : "border-gray-300 hover:border-(--crimson)"
                                    }`}
                                >
                                    <div className="flex items-center">
                                        <UserX className="text-(--crimson) w-6 h-6 mr-3" />
                                        <div>
                                            <div className="font-semibold text-gray-900">
                                                Private
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                Voters are hidden
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Label>
                        </div>
                    </RadioGroup>
                </div>

                <div>
                    <Label
                        htmlFor="deadline"
                        className="text-sm font-semibold text-gray-700"
                    >
                        Vote Deadline (Optional)
                    </Label>
                    <Input
                        id="deadline"
                        type="datetime-local"
                        {...register("deadline")}
                        className="mt-2 focus:ring-(--crimson) focus:border-(--crimson)"
                        min={new Date().toISOString().slice(0, 16)}
                    />
                    {errors.deadline && (
                        <p className="mt-1 text-sm text-red-600">
                            {errors.deadline.message}
                        </p>
                    )}
                    <p className="mt-1 text-sm text-gray-500">
                        Leave empty for no deadline. Voting will be open
                        indefinitely.
                    </p>
                </div>

                <div>
                    <Label className="text-sm font-semibold text-gray-700">
                        Vote Options
                    </Label>
                    <div className="mt-2 space-y-3">
                        {options.map((option, index) => (
                            <div
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
                        // disabled={createPollMutation.isPending}
                        disabled={false} // TODO: replace with actual loading state
                        className="flex-1 bg-(--crimson) hover:bg-(--crimson-50) hover:text-(--crimson) hover:border-(--crimson) border text-white"
                    >
                        {/* {createPollMutation.isPending ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <Plus className="w-4 h-4 mr-2" />
                                Create Vote
                            </>
                        )} */}
                        Create Vote
                    </Button>
                </div>
            </form>
        </div>
    );
}
