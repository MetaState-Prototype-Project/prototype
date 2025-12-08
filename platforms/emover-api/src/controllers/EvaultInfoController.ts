import axios from "axios";
/// <reference path="../types/express.d.ts" />
import type { Request, Response } from "express";

export class EvaultInfoController {
    private registryUrl: string;

    constructor() {
        this.registryUrl =
            process.env.PUBLIC_REGISTRY_URL || "http://localhost:4321";
    }

    getCurrent = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res
                    .status(401)
                    .json({ error: "Authentication required" });
            }

            const eName = req.user.ename;
            if (!eName) {
                return res.status(400).json({ error: "User eName not found" });
            }

            // Query registry for current evault info
            const response = await axios.get(
                new URL(`/resolve?w3id=${eName}`, this.registryUrl).toString(),
            );

            const evaultInfo = response.data;

            return res.json({
                eName: evaultInfo.ename,
                uri: evaultInfo.uri,
                evault: evaultInfo.evault,
                provider: this.extractProviderFromUri(evaultInfo.uri),
            });
        } catch (error) {
            console.error("Error getting current evault info:", error);
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                return res
                    .status(404)
                    .json({ error: "Evault not found in registry" });
            }
            return res.status(500).json({ error: "Internal server error" });
        }
    };

    getProvisioners = async (req: Request, res: Response) => {
        try {
            // Read provisioner URLs from environment
            const provisionerUrl = process.env.PROVISIONER_URL;
            const provisionerUrls = process.env.PROVISIONER_URLS;

            const urls: string[] = [];

            if (provisionerUrl) {
                urls.push(provisionerUrl);
            }

            if (provisionerUrls) {
                urls.push(
                    ...provisionerUrls.split(",").map((url) => url.trim()),
                );
            }

            // Remove duplicates
            const uniqueUrls = [...new Set(urls)];

            const provisioners = uniqueUrls.map((url) => ({
                url,
                name: this.extractProviderFromUri(url),
                description: `Provisioner at ${url}`,
            }));

            return res.json(provisioners);
        } catch (error) {
            console.error("Error getting provisioners:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    };

    private extractProviderFromUri(uri: string): string {
        try {
            const url = new URL(uri);
            return url.hostname || uri;
        } catch {
            return uri;
        }
    }
}
