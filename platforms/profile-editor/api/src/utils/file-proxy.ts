import axios from "axios";
import jwt from "jsonwebtoken";
import FormData from "form-data";
import type { Response } from "express";

const FILE_MANAGER_BASE_URL = () =>
	process.env.PUBLIC_FILE_MANAGER_BASE_URL || "http://localhost:3005";

function mintFmToken(userId: string): string {
	const secret = process.env.FILE_MANAGER_JWT_SECRET;
	if (!secret) throw new Error("FILE_MANAGER_JWT_SECRET not configured");
	return jwt.sign({ userId }, secret, { expiresIn: "1h" });
}

/**
 * Downloads an image from a URL (HTTP or data: URI) and uploads it to the
 * file-manager service, returning the resulting file ID.
 * Returns null on any failure so webhook processing can continue.
 */
export async function downloadUrlAndUploadToFileManager(
	url: string,
	ename: string,
): Promise<string | null> {
	try {
		let buffer: Buffer;
		let mimeType = "image/png";
		let filename = "avatar.png";

		if (url.startsWith("data:")) {
			const match = url.match(/^data:([^;]+);base64,(.+)$/);
			if (!match) return null;
			mimeType = match[1];
			buffer = Buffer.from(match[2], "base64");
			const ext = mimeType.split("/")[1] || "bin";
			filename = `upload.${ext}`;
		} else {
			const response = await axios.get(url, {
				responseType: "arraybuffer",
				timeout: 15_000,
			});
			buffer = Buffer.from(response.data);
			const ct = response.headers["content-type"];
			if (ct) mimeType = ct.split(";")[0].trim();
			const ext = mimeType.split("/")[1] || "bin";
			filename = `upload.${ext}`;
		}

		const token = mintFmToken(ename);
		const form = new FormData();
		form.append("file", buffer, { filename, contentType: mimeType });

		const res = await axios.post(
			`${FILE_MANAGER_BASE_URL()}/api/files`,
			form,
			{
				headers: {
					...form.getHeaders(),
					Authorization: `Bearer ${token}`,
				},
				timeout: 30_000,
				maxContentLength: Infinity,
				maxBodyLength: Infinity,
			},
		);

		return res.data?.id ?? null;
	} catch (error: any) {
		console.error(
			"Failed to download/upload avatar or banner:",
			error.message,
		);
		return null;
	}
}

export async function proxyFileFromFileManager(
	fileId: string,
	ename: string,
	res: Response,
	disposition: "inline" | "attachment" = "inline",
): Promise<void> {
	try {
		const token = mintFmToken(ename);
		// Try preview first (works for images/PDFs); fall back to download for
		// videos and other types that file-manager doesn't support previewing.
		let response: import("axios").AxiosResponse;
		try {
			response = await axios.get(
				`${FILE_MANAGER_BASE_URL()}/api/files/${fileId}/preview`,
				{
					responseType: "stream",
					timeout: 60000,
					headers: { Authorization: `Bearer ${token}` },
				},
			);
		} catch (previewErr: any) {
			if (previewErr?.response?.status === 400) {
				// Preview not supported for this type — use download endpoint
				response = await axios.get(
					`${FILE_MANAGER_BASE_URL()}/api/files/${fileId}/download`,
					{
						responseType: "stream",
						timeout: 60000,
						headers: { Authorization: `Bearer ${token}` },
					},
				);
			} else {
				throw previewErr;
			}
		}

		const contentType =
			response.headers["content-type"] || "application/octet-stream";
		const contentLength = response.headers["content-length"];

		res.set("Content-Type", contentType);
		res.set("Cache-Control", "no-cache");
		// Always set our own disposition so videos/PDFs render inline
		const filename =
			response.headers["content-disposition"]?.match(
				/filename="?([^"]+)"?/,
			)?.[1] ?? fileId;
		res.set(
			"Content-Disposition",
			disposition === "attachment"
				? `attachment; filename="${filename}"`
				: `inline; filename="${filename}"`,
		);
		if (contentLength) {
			res.set("Content-Length", contentLength);
		}
		response.data.pipe(res);
	} catch (error: any) {
		if (error?.response?.status === 404) {
			console.warn(`[file-proxy] 404 from file-manager for fileId=${fileId} (user=${ename})`);
			res.status(404).json({ error: "File not found" });
		} else if (error?.response) {
			const chunks: Buffer[] = [];
			error.response.data.on("data", (chunk: Buffer) => chunks.push(chunk));
			error.response.data.on("end", () => {
				const body = Buffer.concat(chunks).toString();
				console.error("File proxy error:", body);
			});
			res.status(502).json({ error: "Failed to fetch file" });
		} else {
			console.error("File proxy error:", error.message);
			res.status(502).json({ error: "Failed to fetch file" });
		}
	}
}
