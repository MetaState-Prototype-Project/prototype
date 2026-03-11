import React, { useState, useEffect, useCallback } from "react";
import { Briefcase, Plus, X, Loader2 } from "lucide-react";
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
    fetchProfessionalProfile,
    updateProfessionalProfile,
} from "@/lib/profileApi";
import type {
    ProfessionalProfile,
    WorkExperience,
    Education,
} from "@/types/profile";

interface ProfessionalProfileEditorProps {
    onSaveStatus?: (saving: boolean) => void;
}

export default function ProfessionalProfileEditor({
    onSaveStatus,
}: ProfessionalProfileEditorProps) {
    const [profile, setProfile] = useState<ProfessionalProfile>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [skillInput, setSkillInput] = useState("");
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        fetchProfessionalProfile()
            .then((data) => {
                setProfile(data);
            })
            .catch((err) => {
                console.error("Failed to load professional profile:", err);
            })
            .finally(() => setIsLoading(false));
    }, []);

    const updateField = useCallback(
        <K extends keyof ProfessionalProfile>(
            field: K,
            value: ProfessionalProfile[K],
        ) => {
            setProfile((prev) => ({ ...prev, [field]: value }));
            setHasChanges(true);
        },
        [],
    );

    const handleSave = async () => {
        setIsSaving(true);
        onSaveStatus?.(true);
        try {
            const updated = await updateProfessionalProfile({
                headline: profile.headline,
                bio: profile.bio,
                location: profile.location,
                skills: profile.skills,
                workExperience: profile.workExperience,
                education: profile.education,
                isDreamsyncVisible: profile.isDreamsyncVisible,
            });
            setProfile(updated);
            setHasChanges(false);
        } catch (err) {
            console.error("Failed to save professional profile:", err);
        } finally {
            setIsSaving(false);
            onSaveStatus?.(false);
        }
    };

    const addSkill = () => {
        const trimmed = skillInput.trim();
        if (!trimmed) return;
        if (profile.skills?.includes(trimmed)) return;
        updateField("skills", [...(profile.skills ?? []), trimmed]);
        setSkillInput("");
    };

    const removeSkill = (skill: string) => {
        updateField(
            "skills",
            (profile.skills ?? []).filter((s) => s !== skill),
        );
    };

    const addWorkExperience = () => {
        const entry: WorkExperience = {
            company: "",
            role: "",
            startDate: "",
            sortOrder: (profile.workExperience?.length ?? 0) + 1,
        };
        updateField("workExperience", [
            ...(profile.workExperience ?? []),
            entry,
        ]);
    };

    const updateWorkExperience = (
        idx: number,
        field: keyof WorkExperience,
        value: string,
    ) => {
        const list = [...(profile.workExperience ?? [])];
        (list[idx] as any)[field] = value;
        updateField("workExperience", list);
    };

    const removeWorkExperience = (idx: number) => {
        updateField(
            "workExperience",
            (profile.workExperience ?? []).filter((_, i) => i !== idx),
        );
    };

    const addEducation = () => {
        const entry: Education = {
            institution: "",
            degree: "",
            startDate: "",
            sortOrder: (profile.education?.length ?? 0) + 1,
        };
        updateField("education", [...(profile.education ?? []), entry]);
    };

    const updateEducation = (
        idx: number,
        field: keyof Education,
        value: string,
    ) => {
        const list = [...(profile.education ?? [])];
        (list[idx] as any)[field] = value;
        updateField("education", list);
    };

    const removeEducation = (idx: number) => {
        updateField(
            "education",
            (profile.education ?? []).filter((_, i) => i !== idx),
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-purple-600 mr-2" />
                <span className="text-gray-500 text-sm">
                    Loading professional profile…
                </span>
            </div>
        );
    }

    return (
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="professional-profile" className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-2 text-gray-800 font-semibold">
                        <Briefcase className="w-5 h-5 text-purple-600" />
                        Professional Profile
                    </div>
                </AccordionTrigger>
                <AccordionContent className="px-4">
                    <div className="space-y-6">
                        {/* DreamSync Visibility Toggle */}
                        <div className="flex items-center justify-between rounded-lg border p-4 bg-purple-50/50">
                            <div>
                                <Label className="text-sm font-medium">
                                    Show in DreamSync Matching
                                </Label>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    When enabled, your professional background
                                    will be considered during AI matching
                                </p>
                            </div>
                            <Switch
                                checked={profile.isDreamsyncVisible ?? true}
                                onCheckedChange={(checked) =>
                                    updateField("isDreamsyncVisible", checked)
                                }
                            />
                        </div>

                        {/* Headline */}
                        <div className="space-y-1.5">
                            <Label htmlFor="prof-headline">Headline</Label>
                            <Input
                                id="prof-headline"
                                placeholder="e.g. Senior Software Engineer"
                                value={profile.headline ?? ""}
                                onChange={(e) =>
                                    updateField("headline", e.target.value)
                                }
                            />
                        </div>

                        {/* Bio */}
                        <div className="space-y-1.5">
                            <Label htmlFor="prof-bio">Bio</Label>
                            <Textarea
                                id="prof-bio"
                                placeholder="A brief summary about your professional background…"
                                value={profile.bio ?? ""}
                                onChange={(e) =>
                                    updateField("bio", e.target.value)
                                }
                                rows={3}
                            />
                        </div>

                        {/* Location */}
                        <div className="space-y-1.5">
                            <Label htmlFor="prof-location">Location</Label>
                            <Input
                                id="prof-location"
                                placeholder="e.g. Berlin, Germany"
                                value={profile.location ?? ""}
                                onChange={(e) =>
                                    updateField("location", e.target.value)
                                }
                            />
                        </div>

                        {/* Skills */}
                        <div className="space-y-1.5">
                            <Label>Skills</Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Add a skill…"
                                    value={skillInput}
                                    onChange={(e) =>
                                        setSkillInput(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            addSkill();
                                        }
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addSkill}
                                >
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                            {(profile.skills?.length ?? 0) > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {profile.skills!.map((skill) => (
                                        <Badge
                                            key={skill}
                                            variant="secondary"
                                            className="gap-1 pr-1"
                                        >
                                            {skill}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeSkill(skill)
                                                }
                                                className="ml-0.5 rounded-full hover:bg-gray-300/50 p-0.5"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Work Experience */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Work Experience</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addWorkExperience}
                                >
                                    <Plus className="w-4 h-4 mr-1" />
                                    Add
                                </Button>
                            </div>
                            {(profile.workExperience ?? []).map((we, idx) => (
                                <Card key={idx} className="relative">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            removeWorkExperience(idx)
                                        }
                                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <CardContent className="pt-4 grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">
                                                Company
                                            </Label>
                                            <Input
                                                placeholder="Company"
                                                value={we.company}
                                                onChange={(e) =>
                                                    updateWorkExperience(
                                                        idx,
                                                        "company",
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">
                                                Role
                                            </Label>
                                            <Input
                                                placeholder="Role"
                                                value={we.role}
                                                onChange={(e) =>
                                                    updateWorkExperience(
                                                        idx,
                                                        "role",
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">
                                                Start Date
                                            </Label>
                                            <Input
                                                type="date"
                                                value={we.startDate}
                                                onChange={(e) =>
                                                    updateWorkExperience(
                                                        idx,
                                                        "startDate",
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">
                                                End Date
                                            </Label>
                                            <Input
                                                type="date"
                                                value={we.endDate ?? ""}
                                                onChange={(e) =>
                                                    updateWorkExperience(
                                                        idx,
                                                        "endDate",
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="col-span-2 space-y-1">
                                            <Label className="text-xs">
                                                Description
                                            </Label>
                                            <Textarea
                                                placeholder="Brief description…"
                                                value={we.description ?? ""}
                                                onChange={(e) =>
                                                    updateWorkExperience(
                                                        idx,
                                                        "description",
                                                        e.target.value,
                                                    )
                                                }
                                                rows={2}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Education */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Education</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addEducation}
                                >
                                    <Plus className="w-4 h-4 mr-1" />
                                    Add
                                </Button>
                            </div>
                            {(profile.education ?? []).map((edu, idx) => (
                                <Card key={idx} className="relative">
                                    <button
                                        type="button"
                                        onClick={() => removeEducation(idx)}
                                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <CardContent className="pt-4 grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">
                                                Institution
                                            </Label>
                                            <Input
                                                placeholder="Institution"
                                                value={edu.institution}
                                                onChange={(e) =>
                                                    updateEducation(
                                                        idx,
                                                        "institution",
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">
                                                Degree
                                            </Label>
                                            <Input
                                                placeholder="Degree"
                                                value={edu.degree}
                                                onChange={(e) =>
                                                    updateEducation(
                                                        idx,
                                                        "degree",
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">
                                                Field of Study
                                            </Label>
                                            <Input
                                                placeholder="Field of study"
                                                value={edu.fieldOfStudy ?? ""}
                                                onChange={(e) =>
                                                    updateEducation(
                                                        idx,
                                                        "fieldOfStudy",
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">
                                                Start Date
                                            </Label>
                                            <Input
                                                type="date"
                                                value={edu.startDate}
                                                onChange={(e) =>
                                                    updateEducation(
                                                        idx,
                                                        "startDate",
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">
                                                End Date
                                            </Label>
                                            <Input
                                                type="date"
                                                value={edu.endDate ?? ""}
                                                onChange={(e) =>
                                                    updateEducation(
                                                        idx,
                                                        "endDate",
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="col-span-2 space-y-1">
                                            <Label className="text-xs">
                                                Description
                                            </Label>
                                            <Textarea
                                                placeholder="Brief description…"
                                                value={edu.description ?? ""}
                                                onChange={(e) =>
                                                    updateEducation(
                                                        idx,
                                                        "description",
                                                        e.target.value,
                                                    )
                                                }
                                                rows={2}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end pt-2">
                            <Button
                                onClick={handleSave}
                                disabled={isSaving || !hasChanges}
                                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Saving…
                                    </>
                                ) : (
                                    "Save Professional Profile"
                                )}
                            </Button>
                        </div>
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}
