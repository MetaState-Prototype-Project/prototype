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
	mode: "preview" | "download" = "preview",
): Promise<void> {
	try {
		const token = mintFmToken(ename);
		const endpoint = mode === "download" ? "download" : "preview";
		const url = `${FILE_MANAGER_BASE_URL()}/api/files/${fileId}/${endpoint}`;
		const response = await axios.get(url, {
			responseType: "stream",
			timeout: 60000,
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		const contentType =
			response.headers["content-type"] || "application/octet-stream";
		const contentDisposition = response.headers["content-disposition"];
		const contentLength = response.headers["content-length"];

		res.set("Content-Type", contentType);
		if (contentDisposition) {
			res.set("Content-Disposition", contentDisposition);
		}
		if (contentLength) {
			res.set("Content-Length", contentLength);
		}
		res.set("Cache-Control", "public, max-age=300");

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
