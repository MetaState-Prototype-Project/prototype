import type { Request, RequestHandler, Response } from "express";
import multer from "multer";
import { adapter } from "../web3adapter/watchers/subscriber";

const upload = multer({
    limits: { fileSize: 100 * 1024 * 1024 },
    storage: multer.memoryStorage(),
});

/**
 * Uploads the file to the authenticated user's eVault blob storage (the same
 * path the adapter's `__file` directive uses) and returns its public CDN URL.
 * No file-manager, no local bytea — the URL is what gets stored in the profile.
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

        const result = await adapter.evaultClient.uploadFile(ename, {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
            content: req.file.buffer.toString("base64"),
            acl: ["*"],
        });

        res.json({
            publicUrl: result.publicUrl,
            name: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
        });
    } catch (error) {
        console.error("File upload error:", (error as Error).message);
        res.status(500).json({ error: "Failed to upload file" });
    }
}

export const fileUpload: RequestHandler[] = [
    upload.single("file") as RequestHandler,
    handleUpload as RequestHandler,
];
