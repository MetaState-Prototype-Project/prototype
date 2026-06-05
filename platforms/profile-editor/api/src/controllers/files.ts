import type { Request, RequestHandler, Response } from "express";
import multer from "multer";
import { adapter } from "../web3adapter/watchers/subscriber";

// Server-side allowlist — the returned public URL is rendered directly in
// <img>/<video>/<object> on profile pages, so active/scriptable content
// (HTML, SVG, JS) must never get a public blob. Don't trust the client
// `accept` filter.
const ALLOWED_MIME_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/webm",
    "application/pdf",
]);

const upload = multer({
    // memoryStorage keeps the whole file in RAM and toString("base64") copies
    // it again — keep the limit modest so concurrent uploads can't exhaust the
    // process heap.
    limits: { fileSize: 25 * 1024 * 1024 },
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

        if (!ALLOWED_MIME_TYPES.has(req.file.mimetype)) {
            res.status(415).json({ error: "Unsupported media type" });
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
