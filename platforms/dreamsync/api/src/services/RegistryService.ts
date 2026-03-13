import axios from "axios";

interface PlatformTokenResponse {
    token: string;
    expiresAt?: number;
}

interface ResolveResponse {
    uri: string;
    evault: string;
}

export class RegistryService {
    private platformToken: string | null = null;
    private tokenExpiresAt: number = 0;

    private get registryUrl(): string {
        const url = process.env.PUBLIC_REGISTRY_URL;
        if (!url) throw new Error("PUBLIC_REGISTRY_URL not configured");
        return url;
    }

    private get platformBaseUrl(): string {
        const url = process.env.VITE_DREAMSYNC_BASE_URL;
        if (!url)
            throw new Error("VITE_DREAMSYNC_BASE_URL not configured");
        return url;
    }

    async ensurePlatformToken(): Promise<string> {
        const now = Date.now();
        if (this.platformToken && this.tokenExpiresAt > now + 5 * 60 * 1000) {
            return this.platformToken;
        }

        const response = await axios.post<PlatformTokenResponse>(
            new URL("/platforms/certification", this.registryUrl).toString(),
            { platform: this.platformBaseUrl },
            { headers: { "Content-Type": "application/json" } },
        );

        this.platformToken = response.data.token;
        this.tokenExpiresAt = response.data.expiresAt || now + 3600000;
        return this.platformToken;
    }

    /**
     * Ensure eName is in W3ID format (@uuid) for Registry/eVault.
     * DreamSync stores ename without @; Registry expects @-prefixed w3id.
     */
    normalizeW3id(eName: string): string {
        if (!eName) return eName;
        return eName.startsWith("@") ? eName : `@${eName}`;
    }

    async resolveEName(eName: string): Promise<{ uri: string; evault: string }> {
        const w3id = this.normalizeW3id(eName);
        const response = await axios.get<ResolveResponse>(
            `${this.registryUrl}/resolve`,
            { params: { w3id } },
        );
        return { uri: response.data.uri, evault: response.data.evault };
    }

    async getEvaultGraphqlUrl(eName: string): Promise<string> {
        const { uri } = await this.resolveEName(eName);
        const base = uri.replace(/\/$/, "");
        return `${base}/graphql`;
    }
}
