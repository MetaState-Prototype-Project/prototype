import axios from "axios";
import type { Request, RequestHandler, Response } from "express";
import FormData from "form-data";
import jwt from "jsonwebtoken";
import multer from "multer";
import { env } from "../env";

const upload = multer({
    limits: { fileSize: 100 * 1024 * 1024 },
    storage: multer.memoryStorage(),
});

/** File-manager auth token, signed with the shared FILE_MANAGER_JWT_SECRET. */
function mintFmToken(userId: string): string {
    if (!env.fileManagerJwtSecret) {
        throw new Error("FILE_MANAGER_JWT_SECRET not configured");
    }
    return jwt.sign({ userId }, env.fileManagerJwtSecret, { expiresIn: "1h" });
}

/**
 * Uploads the file to file-manager (the proven path), marks it public, and
 * returns its public URL — that URL is what gets stored in the profile (images
 * as URIs). Keeps eVault for profile data, file-manager for the actual blobs.
 */
async function handleUpload(req: Request, res: Response): Promise<void> {
    try {
        if (!req.file) {
            res.status(400).json({ error: "No file provided" });
            return;
        }
        const ename = req.user?.ename;
        if (!ename) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }

        const token = mintFmToken(ename);
        const base = env.fileManagerBaseUrl.replace(/\/$/, "");

        const form = new FormData();
        form.append("file", req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
        });

        const { data } = await axios.post(`${base}/api/files`, form, {
            headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });

        const fileId = data?.id;
        if (!fileId) {
            res.status(502).json({ error: "Upload failed: no file id returned" });
            return;
        }

        // Mark public so the returned URL renders without auth.
        await axios.patch(
            `${base}/api/files/${fileId}`,
            { isPublic: true },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            },
        );

        res.json({
            publicUrl: `${base}/api/public/files/${fileId}`,
            name: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
        });
    } catch (error) {
        const message = axios.isAxiosError(error)
            ? (error.response?.data?.error ?? error.message)
            : (error as Error).message;
        console.error("File upload error:", message);
        res.status(500).json({ error: "Failed to upload file" });
    }
}

export const fileUpload: RequestHandler[] = [
    upload.single("file") as RequestHandler,
    handleUpload as RequestHandler,
];
