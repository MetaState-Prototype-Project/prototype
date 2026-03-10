import { Request, Response, RequestHandler } from "express";
import multer from "multer";
import FormData from "form-data";
import axios from "axios";
import jwt from "jsonwebtoken";

const upload = multer({
	limits: { fileSize: 100 * 1024 * 1024 },
	storage: multer.memoryStorage(),
});

function mintFmToken(userId: string): string {
	const secret = process.env.FILE_MANAGER_JWT_SECRET;
	if (!secret) throw new Error("FILE_MANAGER_JWT_SECRET not configured");
	return jwt.sign({ userId }, secret, { expiresIn: "1h" });
}

function getFmBaseUrl(): string {
	const url = process.env.PUBLIC_FILE_MANAGER_BASE_URL;
	if (!url) throw new Error("PUBLIC_FILE_MANAGER_BASE_URL not configured");
	return url;
}

async function handleUpload(req: Request, res: Response): Promise<void> {
	try {
		if (!req.file) {
			res.status(400).json({ error: "No file provided" });
			return;
		}

		const userId = req.user?.ename;
		if (!userId) {
			res.status(401).json({ error: "Authentication required" });
			return;
		}

		const token = mintFmToken(userId);
		const form = new FormData();
		form.append("file", req.file.buffer, {
			filename: req.file.originalname,
			contentType: req.file.mimetype,
		});

		const response = await axios.post(
			`${getFmBaseUrl()}/api/files`,
			form,
			{
				headers: {
					...form.getHeaders(),
					Authorization: `Bearer ${token}`,
				},
				maxContentLength: Infinity,
				maxBodyLength: Infinity,
			},
		);

		res.json(response.data);
	} catch (error: any) {
		console.error("File proxy error:", error?.response?.data ?? error.message);
		const status = error?.response?.status ?? 500;
		const message = error?.response?.data?.error ?? "Failed to upload file";
		res.status(status).json({ error: message });
	}
}

export const fileProxyUpload: RequestHandler[] = [
	upload.single("file") as RequestHandler,
	handleUpload as RequestHandler,
];
