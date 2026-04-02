import axios from "axios";
import jwt from "jsonwebtoken";
import type { Response } from "express";

const FILE_MANAGER_BASE_URL = () =>
	process.env.PUBLIC_FILE_MANAGER_BASE_URL || "http://localhost:3005";

function mintFmToken(userId: string): string {
	const secret = process.env.FILE_MANAGER_JWT_SECRET;
	if (!secret) throw new Error("FILE_MANAGER_JWT_SECRET not configured");
	return jwt.sign({ userId }, secret, { expiresIn: "1h" });
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
