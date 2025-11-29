import { env } from "$env/dynamic/public";

export interface Platform {
    name: string;
    url: string;
    status: "Active" | "Inactive";
    uptime: string;
}

export interface RegistryVault {
    ename: string;
    uri: string;
    evault: string;
    originalUri?: string;
    resolved?: boolean;
}

export class RegistryService {
    private baseUrl: string;

    constructor() {
        this.baseUrl =
            env.PUBLIC_REGISTRY_URL ||
            "https://registry.staging.metastate.foundation";
    }

    async getEVaults(): Promise<RegistryVault[]> {
        try {
            const response = await fetch(`${this.baseUrl}/list`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const vaults: RegistryVault[] = await response.json();
            return vaults;
        } catch (error) {
            console.error("Error fetching evaults from registry:", error);
            return [];
        }
    }

    async getPlatforms(): Promise<Platform[]> {
        try {
            const response = await fetch(`${this.baseUrl}/platforms`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const platformUrls: (string | null | undefined)[] =
                await response.json();

            // Filter out null/undefined values and convert URLs to platform objects
            const platforms = platformUrls
                .filter(
                    (url): url is string => url != null && url.trim() !== "",
                )
                .map((url) => {
                    // Use the original URL from the registry (it already has the correct format)
                    let displayUrl = url.trim();

                    // Ensure URL has protocol if it doesn't
                    if (
                        !displayUrl.startsWith("http://") &&
                        !displayUrl.startsWith("https://")
                    ) {
                        displayUrl = `http://${displayUrl}`;
                    }

                    // Parse URL to extract platform name
                    let name = "Unknown";
                    try {
                        const urlObj = new URL(displayUrl);
                        const hostname = urlObj.hostname;
                        // Extract platform name from hostname (remove port if present)
                        const hostnameWithoutPort = hostname.split(":")[0];
                        const namePart = hostnameWithoutPort.split(".")[0];

                        // Capitalize and format the name
                        if (namePart === "pictique") name = "Pictique";
                        else if (namePart === "blabsy") name = "Blabsy";
                        else if (namePart === "charter") name = "Group Charter";
                        else if (namePart === "cerberus") name = "Cerberus";
                        else if (namePart === "evoting") name = "eVoting";
                        else if (namePart === "dreamsync") name = "DreamSync";
                        else if (namePart === "ereputation")
                            name = "eReputation";
                        else
                            name =
                                namePart.charAt(0).toUpperCase() +
                                namePart.slice(1);
                    } catch {
                        // If URL parsing fails, try to extract name from the URL string
                        const match = displayUrl.match(
                            /(?:https?:\/\/)?([^:./]+)/,
                        );
                        if (match) {
                            const namePart = match[1].toLowerCase();
                            if (namePart === "pictique") name = "Pictique";
                            else if (namePart === "blabsy") name = "Blabsy";
                            else if (namePart === "charter")
                                name = "Group Charter";
                            else if (namePart === "cerberus") name = "Cerberus";
                            else if (namePart === "evoting") name = "eVoting";
                            else if (namePart === "dreamsync")
                                name = "DreamSync";
                            else if (namePart === "ereputation")
                                name = "eReputation";
                            else
                                name =
                                    namePart.charAt(0).toUpperCase() +
                                    namePart.slice(1);
                        }
                    }

                    return {
                        name,
                        url: displayUrl,
                        status: "Active" as const,
                        uptime: "24h",
                    };
                });

            return platforms;
        } catch (error) {
            console.error("Error fetching platforms from registry:", error);

            // Return fallback platforms if registry is unavailable
            return [
                {
                    name: "Blabsy",
                    url: "http://192.168.0.235:4444",
                    status: "Active",
                    uptime: "24h",
                },
                {
                    name: "Pictique",
                    url: "http://192.168.0.235:1111",
                    status: "Active",
                    uptime: "24h",
                },
                {
                    name: "Group Charter",
                    url: "http://192.168.0.235:5555",
                    status: "Active",
                    uptime: "24h",
                },
                {
                    name: "Cerberus",
                    url: "http://192.168.0.235:6666",
                    status: "Active",
                    uptime: "24h",
                },
            ];
        }
    }
}

export const registryService = new RegistryService();
