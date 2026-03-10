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
			responseType: "arraybuffer",
			timeout: 30000,
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		const contentType =
			response.headers["content-type"] || "application/octet-stream";
		const contentDisposition = response.headers["content-disposition"];
		res.set("Content-Type", contentType);
		if (contentDisposition) {
			res.set("Content-Disposition", contentDisposition);
		}
		res.set("Cache-Control", "public, max-age=3600");
		res.send(response.data);
	} catch (error: any) {
		if (error?.response?.status === 404) {
			res.status(404).json({ error: "File not found" });
		} else {
			console.error("File proxy error:", error?.response?.data?.toString?.() ?? error.message);
			res.status(502).json({ error: "Failed to fetch file" });
		}
	}
}
