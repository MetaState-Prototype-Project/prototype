"use client";

import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { pollApi } from "@/lib/pollApi";
import { useRouter } from "next/navigation";
import Link from "next/link";

const createPollSchema = z.object({
    title: z.string().min(1, "Poll title is required"),
    mode: z.enum(["normal", "point", "rank"]),
    visibility: z.enum(["public", "private"]),
    options: z
        .array(z.string().min(1, "Option cannot be empty"))
        .min(2, "At least 2 options required"),
    deadline: z
        .string()
        .optional()
        .refine((val) => {
            if (!val) return true; // Allow empty deadline
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
            options: ["", ""],
            deadline: "",
        },
    });



    const watchedMode = watch("mode");
    const watchedVisibility = watch("visibility");

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

    const onSubmit = async (data: CreatePollForm) => {
        setIsSubmitting(true);
        try {
            await pollApi.createPoll({
                title: data.title,
                mode: data.mode,
                visibility: data.visibility,
                options: data.options.filter(option => option.trim() !== ""),
                deadline: data.deadline || undefined
            });
            
            toast({
                title: "Success!",
                description: "Poll created successfully",
            });
            
            router.push("/");
        } catch (error) {
            console.error("Failed to create poll:", error);
            toast({
                title: "Error",
                description: "Failed to create poll. Please try again.",
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
                            setValue(
                                "mode",
                                value as "normal" | "point" | "rank"
                            )
                        }
                        className="mt-2"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Label className="flex items-center cursor-pointer">
                                <RadioGroupItem
                                    value="normal"
                                    className="sr-only"
                                />
                                <div
                                    className={`border-2 rounded-lg p-4 w-full h-24 transition-all ${
                                        watchedMode === "normal"
                                            ? "border-(--crimson) bg-(--crimson-50)"
                                            : "border-gray-300 hover:border-(--crimson)"
                                    }`}
                                >
                                    <div className="flex items-center">
                                        <CircleUser className="text-(--crimson) w-6 h-6 mr-3" />
                                        <div>
                                            <div className="font-semibold text-gray-900">
                                                Simple
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                Select one option to vote for
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Label>

                            <Label className="flex items-center cursor-pointer">
                                <RadioGroupItem
                                    value="point"
                                    className="sr-only"
                                />
                                <div
                                    className={`border-2 rounded-lg p-4 w-full h-24 transition-all ${
                                        watchedMode === "point"
                                            ? "border-(--crimson) bg-(--crimson-50)"
                                            : "border-gray-300 hover:border-(--crimson)"
                                    }`}
                                >
                                    <div className="flex items-center">
                                        <ChartLine className="text-(--crimson) w-6 h-6 mr-3" />
                                        <div>
                                            <div className="font-semibold text-gray-900">
                                                PBV
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                Each voter gets 100 points
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Label>

                            <Label className="flex items-center cursor-pointer">
                                <RadioGroupItem
                                    value="rank"
                                    className="sr-only"
                                />
                                <div
                                    className={`border-2 rounded-lg p-4 w-full h-24 transition-all ${
                                        watchedMode === "rank"
                                            ? "border-(--crimson) bg-(--crimson-50)"
                                            : "border-gray-300 hover:border-(--crimson)"
                                    }`}
                                >
                                    <div className="flex items-center">
                                        <ListOrdered className="text-(--crimson) w-6 h-6 mr-3" />
                                        <div>
                                            <div className="font-semibold text-gray-900">
                                                RBV
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                Voters can rank order the
                                                choices
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Label>
                        </div>
                    </RadioGroup>
                </div>

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
                                    value="reputation"
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
                    <p className="mt-2 text-sm text-gray-500 italic">
                        Coming soon - currently disabled
                    </p>
                </div>

                <div>
                    <Label className="text-sm font-semibold text-gray-700">
                        Vote Visibility
                    </Label>
                    <RadioGroup
                        value={watchedVisibility}
                        onValueChange={(value) =>
                            setValue(
                                "visibility",
                                value as "public" | "private"
                            )
                        }
                        className="mt-2"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Label className="flex items-center cursor-pointer">
                                <RadioGroupItem
                                    value="public"
                                    className="sr-only"
                                />
                                <div
                                    className={`border-2 rounded-lg p-4 w-full h-24 transition-all ${
                                        watchedVisibility === "public"
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
                                    className={`border-2 rounded-lg p-4 w-full h-24 transition-all ${
                                        watchedVisibility === "private"
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
