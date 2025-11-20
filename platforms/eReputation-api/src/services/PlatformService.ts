import axios from "axios";

export interface Platform {
    id: string;
    name: string;
    description: string;
    category: string;
    logoUrl?: string;
    url?: string;
    appStoreUrl?: string;
    playStoreUrl?: string;
}

export class PlatformService {
    private marketplaceData: Platform[] = [
        {
            id: "eid-wallet",
            name: "eID for W3DS",
            description: "Secure digital identity wallet for W3DS. Maintain sovereign control over your digital identity.",
            category: "Identity",
            logoUrl: "/eid-w3ds.png",
            appStoreUrl: "https://apps.apple.com/in/app/eid-for-w3ds/id6747748667",
            playStoreUrl: "https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet"
        },
        {
            id: "blabsy",
            name: "Blabsy",
            description: "Micro blogging first style application for sharing thoughts across the W3DS ecosystem.",
            category: "Social",
            logoUrl: "/blabsy.svg",
            url: "http://localhost:4444"
        },
        {
            id: "pictique",
            name: "Pictique",
            description: "Photo sharing first style application for sharing moments across the W3DS ecosystem.",
            category: "Social",
            logoUrl: "/pictique.svg",
            url: "http://localhost:1111"
        },
        {
            id: "evoting",
            name: "eVoting",
            description: "Secure, transparent, and verifiable electronic voting platform with cryptographic guarantees.",
            category: "Governance",
            logoUrl: "/evoting.png",
            url: "http://localhost:7777"
        },
        {
            id: "group-charter",
            name: "Charter Manager",
            description: "Define rules, manage memberships, and ensure transparent governance for your communities.",
            category: "Governance",
            logoUrl: "/charter.png",
            url: "http://localhost:5555"
        },
        {
            id: "dreamsync",
            name: "DreamSync",
            description: "Individual discovery platform, find people of interest across the W3DS ecosystem.",
            category: "Wellness",
            logoUrl: undefined,
            url: "https://dreamsync.w3ds.metastate.foundation"
        }
    ];

    async getActivePlatforms(): Promise<Platform[]> {
        try {
            const registryUrl = process.env.PUBLIC_REGISTRY_URL || "http://localhost:3000";
            const response = await axios.get(`${registryUrl}/platforms`);
            
            if (response.data && Array.isArray(response.data)) {
                // Map registry URLs to marketplace data
                return response.data.map((url: string) => {
                    const platformId = this.extractPlatformIdFromUrl(url);
                    const marketplacePlatform = this.marketplaceData.find(p => p.id === platformId);
                    
                    if (marketplacePlatform) {
                        return {
                            ...marketplacePlatform,
                            url: url // Use the actual registry URL
                        };
                    }
                    
                    // Fallback for unknown platforms
                    return {
                        id: platformId,
                        name: platformId.charAt(0).toUpperCase() + platformId.slice(1),
                        description: `Platform at ${url}`,
                        category: "Unknown",
                        url: url
                    };
                });
            }
            
            // Fallback to marketplace data if registry is not available
            console.warn("Registry not available, using marketplace data");
            return this.marketplaceData;
            
        } catch (error) {
            console.error("Error fetching platforms from registry:", error);
            // Fallback to marketplace data
            return this.marketplaceData;
        }
    }

    async searchPlatforms(query: string): Promise<Platform[]> {
        const platforms = await this.getActivePlatforms();
        const lowercaseQuery = query.toLowerCase();
        
        return platforms.filter(platform => 
            platform.name.toLowerCase().includes(lowercaseQuery) ||
            platform.description.toLowerCase().includes(lowercaseQuery) ||
            platform.category.toLowerCase().includes(lowercaseQuery)
        );
    }

    private extractPlatformIdFromUrl(url: string): string {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            
            // Handle localhost URLs for testing (including local network IPs)
            if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
                const port = urlObj.port;
                // Map localhost ports to platform IDs
                switch (port) {
                    case '4444': return 'blabsy';
                    case '1111': return 'pictique';
                    case '5555': return 'group-charter';
                    case '7777': return 'evoting';
                    case '8765': return 'ereputation';
                    default: return `platform-${port}`;
                }
            }
            
            // Extract from production URLs
            if (hostname.includes('blabsy')) return 'blabsy';
            if (hostname.includes('pictique')) return 'pictique';
            if (hostname.includes('evoting')) return 'evoting';
            if (hostname.includes('charter')) return 'group-charter';
            if (hostname.includes('dreamsync')) return 'dreamsync';
            if (hostname.includes('ereputation')) return 'ereputation';
            
            // Fallback: use subdomain or path
            const parts = hostname.split('.');
            if (parts.length > 0) {
                return parts[0];
            }
            
            return 'unknown-platform';
        } catch (error) {
            console.error("Error extracting platform ID from URL:", url, error);
            return 'unknown-platform';
        }
    }
}
