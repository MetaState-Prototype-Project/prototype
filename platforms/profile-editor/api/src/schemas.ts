import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

/**
 * Validates `req.body` against a schema, replacing it with the parsed value.
 * Strings are kept permissive (empty string is allowed and meaningful — it
 * clears a field, e.g. `cvFileId: ""`).
 */
export function validate(schema: z.ZodTypeAny) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({
                error: "Invalid request body",
                details: result.error.issues.map((i) => ({
                    path: i.path.join("."),
                    message: i.message,
                })),
            });
            return;
        }
        req.body = result.data;
        next();
    };
}

export const loginSchema = z.object({
    ename: z.string().min(1),
    session: z.string().min(1),
    signature: z.string().min(1),
});

export const profilePatchSchema = z.object({
    displayName: z.string().optional(),
    headline: z.string().optional(),
    bio: z.string().optional(),
    avatar: z.string().optional(),
    banner: z.string().optional(),
    cvFileId: z.string().optional(),
    videoIntroFileId: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    website: z.string().optional(),
    location: z.string().optional(),
    isPublic: z.boolean().optional(),
});

export const workExperienceSchema = z.array(
    z.object({
        id: z.string().optional(),
        company: z.string(),
        role: z.string(),
        description: z.string().optional(),
        startDate: z.string(),
        endDate: z.string().optional(),
        location: z.string().optional(),
        sortOrder: z.number(),
    }),
);

export const educationSchema = z.array(
    z.object({
        id: z.string().optional(),
        institution: z.string(),
        degree: z.string(),
        fieldOfStudy: z.string().optional(),
        startDate: z.string(),
        endDate: z.string().optional(),
        description: z.string().optional(),
        sortOrder: z.number(),
    }),
);

export const skillsSchema = z.array(z.string());

export const socialLinksSchema = z.array(
    z.object({
        id: z.string().optional(),
        platform: z.string(),
        url: z.string(),
        label: z.string().optional(),
    }),
);
