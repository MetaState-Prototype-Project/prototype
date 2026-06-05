import type { Request, RequestHandler, Response } from "express";
import multer from "multer";
import type { EvaultWriter } from "../evault";

// Server-side allowlist — the returned public URL is rendered directly in
// <img>/<video>/<object> on profile pages, so active/scriptable content
// (HTML, SVG, JS) must never get a public blob. Don't trust the client filter.
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
 * Uploads the file to the authenticated user's eVault blob storage and returns
 * its public CDN URL. No local storage — the URL is what gets stored in the
 * profile (images as URIs).
 */
function makeHandler(evault: EvaultWriter) {
    return async (req: Request, res: Response): Promise<void> => {
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

            const publicUrl = await evault.uploadBlob(ename, {
                filename: req.file.originalname,
                contentType: req.file.mimetype,
                base64: req.file.buffer.toString("base64"),
            });

            res.json({
                publicUrl,
                name: req.file.originalname,
                mimeType: req.file.mimetype,
                size: req.file.size,
            });
        } catch (error) {
            console.error("File upload error:", (error as Error).message);
            res.status(500).json({ error: "Failed to upload file" });
        }
    };
}

export function fileUpload(evault: EvaultWriter): RequestHandler[] {
    return [
        upload.single("file") as RequestHandler,
        makeHandler(evault) as RequestHandler,
    ];
}
