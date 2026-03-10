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
		const url = process.env.PUBLIC_PROFILE_EDITOR_BASE_URL;
		if (!url)
			throw new Error("PUBLIC_PROFILE_EDITOR_BASE_URL not configured");
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

	async resolveEName(eName: string): Promise<{ uri: string; evault: string }> {
		const response = await axios.get<ResolveResponse>(
			`${this.registryUrl}/resolve`,
			{ params: { w3id: eName } },
		);
		return { uri: response.data.uri, evault: response.data.evault };
	}

	async getEvaultGraphqlUrl(eName: string): Promise<string> {
		const { uri } = await this.resolveEName(eName);
		const base = uri.replace(/\/$/, "");
		return `${base}/graphql`;
	}
}
