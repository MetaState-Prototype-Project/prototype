import OpenAI from "openai";
import { Repository, IsNull } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Wishlist } from "../database/entities/Wishlist";

type WishlistSummary = {
    summaryWants: string[];
    summaryOffers: string[];
};

const DELIMITER = "<|>";
const MAX_FALLBACK_LENGTH = 140;

export class WishlistSummaryService {
    private static instance: WishlistSummaryService | null = null;
    private wishlistRepository: Repository<Wishlist>;
    private openai: OpenAI;

    private constructor() {
        this.wishlistRepository = AppDataSource.getRepository(Wishlist);
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    static getInstance(): WishlistSummaryService {
        if (!this.instance) {
            this.instance = new WishlistSummaryService();
        }
        return this.instance;
    }

    async summarizeWishlistContent(content: string): Promise<WishlistSummary> {
        const prompt = `
Extract and summarize the wishlist into two arrays of short items.

Return EXACTLY in this JSON format, nothing else:
{
  "wants": ["item 1", "item 2", "item 3"],
  "offers": ["item 1", "item 2", "item 3"]
}

Rules:
- Extract each distinct want/offer as a separate array item
- Each item should be a short phrase (5-30 characters)
- Be terse, remove filler, prefer keywords over sentences
- Avoid the delimiter "${DELIMITER}" in items
- If explicit wants/offers are missing, infer concise intent/skills from context
- Return empty arrays [] if no meaningful content found
- Maximum 10 items per array
`.trim();

        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are a summarizer that extracts wants and offers as JSON arrays of short phrases.",
                    },
                    {
                        role: "user",
                        content: `${prompt}\n\nWishlist content:\n${content}`,
                    },
                ],
                temperature: 0.2,
                max_tokens: 500,
                response_format: { type: "json_object" },
            }).catch((error: any) => {
                console.error("WishlistSummaryService OpenAI API Error:");
                console.error("  Error type:", error?.constructor?.name);
                console.error("  Error message:", error?.message);
                console.error("  Error code:", error?.code);
                console.error("  Error status:", error?.status);
                
                if (error?.status === 429 || error?.code === 'rate_limit_exceeded' || error?.message?.includes('rate limit')) {
                    console.error("RATE LIMIT DETECTED in WishlistSummaryService!");
                    console.error("  Rate limit error details:", JSON.stringify(error, null, 2));
                }
                
                throw error;
            });

            const raw = response.choices[0]?.message?.content || "";
            const parsed = this.parseSummary(raw);
            if (parsed) {
                return parsed;
            }
        } catch (error) {
            console.error("WishlistSummaryService: OpenAI summarization failed, using fallback", error);
        }

        // Fallback: extract basic items from content
        const fallback = this.buildFallback(content);
        return {
            summaryWants: fallback.wants,
            summaryOffers: fallback.offers,
        };
    }

    async summarizeAndPersist(wishlist: Wishlist): Promise<Wishlist> {
        const { summaryWants, summaryOffers } = await this.summarizeWishlistContent(wishlist.content);
        wishlist.summaryWants = summaryWants;
        wishlist.summaryOffers = summaryOffers;
        return this.wishlistRepository.save(wishlist);
    }

    async ensureSummaries(wishlist: Wishlist): Promise<Wishlist> {
        if (wishlist.summaryWants && wishlist.summaryWants.length > 0 && 
            wishlist.summaryOffers && wishlist.summaryOffers.length > 0) {
            return wishlist;
        }
        return this.summarizeAndPersist(wishlist);
    }

    async backfillMissingSummaries(batchSize: number = 25): Promise<void> {
        const missing = await this.wishlistRepository.find({
            where: [
                { summaryWants: IsNull() },
                { summaryOffers: IsNull() },
            ],
            order: { updatedAt: "DESC" },
            take: batchSize,
        });

        if (missing.length === 0) {
            console.log("WishlistSummaryService: No wishlists missing summaries");
            return;
        }

        console.log(`WishlistSummaryService: Backfilling summaries for ${missing.length} wishlists...`);

        for (const wishlist of missing) {
            try {
                await this.summarizeAndPersist(wishlist);
            } catch (error) {
                console.error(`WishlistSummaryService: Failed to summarize wishlist ${wishlist.id}`, error);
            }
        }

        console.log("WishlistSummaryService: Backfill completed");
    }

    /**
     * Summarize all wishlists and log the results
     * Used for comprehensive summarization on platform start
     */
    async summarizeAllWishlists(): Promise<void> {
        const allWishlists = await this.wishlistRepository.find({
            where: { isActive: true },
            order: { updatedAt: "DESC" },
        });

        if (allWishlists.length === 0) {
            console.log("WishlistSummaryService: No active wishlists to summarize");
            return;
        }

        console.log(`\n${"=".repeat(80)}`);
        console.log(`WishlistSummaryService: Starting comprehensive summarization of ${allWishlists.length} wishlists`);
        console.log(`${"=".repeat(80)}\n`);

        let successCount = 0;
        let errorCount = 0;

        for (const wishlist of allWishlists) {
            try {
                const summary = await this.summarizeWishlistContent(wishlist.content);
                
                // Log the raw content and summary
                console.log(`[${wishlist.id}]`);
                console.log(`  Raw: ${wishlist.content.substring(0, 200)}${wishlist.content.length > 200 ? '...' : ''}`);
                console.log(`  Summary Wants: ${JSON.stringify(summary.summaryWants)}`);
                console.log(`  Summary Offers: ${JSON.stringify(summary.summaryOffers)}`);
                console.log('');

                // Persist the summary
                wishlist.summaryWants = summary.summaryWants;
                wishlist.summaryOffers = summary.summaryOffers;
                await this.wishlistRepository.save(wishlist);
                
                successCount++;
            } catch (error) {
                console.error(`[${wishlist.id}] Failed to summarize:`, error);
                errorCount++;
            }
        }

        console.log(`${"=".repeat(80)}`);
        console.log(`WishlistSummaryService: Summarization completed`);
        console.log(`  Success: ${successCount}`);
        console.log(`  Errors: ${errorCount}`);
        console.log(`${"=".repeat(80)}\n`);
    }

    private parseSummary(raw: string): WishlistSummary | null {
        try {
            const cleaned = raw.replace(/\r/g, "").trim();
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return null;
            }

            const parsed = JSON.parse(jsonMatch[0]);
            const wants = Array.isArray(parsed.wants) ? parsed.wants : [];
            const offers = Array.isArray(parsed.offers) ? parsed.offers : [];

            // Clean and validate items
            const cleanWants = wants
                .filter((item: any) => typeof item === 'string' && item.trim().length > 0)
                .map((item: string) => this.cleanArrayItem(item))
                .filter((item: string) => item.length > 0 && item.length <= 100)
                .slice(0, 10);

            const cleanOffers = offers
                .filter((item: any) => typeof item === 'string' && item.trim().length > 0)
                .map((item: string) => this.cleanArrayItem(item))
                .filter((item: string) => item.length > 0 && item.length <= 100)
                .slice(0, 10);

            return {
                summaryWants: cleanWants.length > 0 ? cleanWants : [],
                summaryOffers: cleanOffers.length > 0 ? cleanOffers : [],
            };
        } catch (error) {
            console.error("WishlistSummaryService: Failed to parse summary JSON", error);
            return null;
        }
    }

    private cleanArrayItem(item: string): string {
        return item
            .replace(new RegExp(DELIMITER, "g"), " ")
            .replace(/\s+/g, " ")
            .replace(/[,\n\r]+/g, " ")
            .trim()
            .slice(0, 100);
    }

    private buildFallback(content: string): { wants: string[]; offers: string[] } {
        // Extract list items from markdown content as fallback
        const wants: string[] = [];
        const offers: string[] = [];

        const lines = content.split('\n');
        let currentSection: 'wants' | 'offers' | null = null;

        for (const line of lines) {
            const trimmed = line.trim();
            
            // Detect section headers
            if (/^##\s*what\s+i\s+want/i.test(trimmed)) {
                currentSection = 'wants';
                continue;
            }
            if (/^##\s*what\s+i\s+can\s+do/i.test(trimmed)) {
                currentSection = 'offers';
                continue;
            }

            // Extract list items
            const listItemMatch = trimmed.match(/^[-*]\s+(.+)$/);
            if (listItemMatch) {
                const item = this.cleanArrayItem(listItemMatch[1]);
                if (item.length > 0) {
                    if (currentSection === 'wants') {
                        wants.push(item);
                    } else if (currentSection === 'offers') {
                        offers.push(item);
                    }
                }
            }
        }

        return {
            wants: wants.slice(0, 10),
            offers: offers.slice(0, 10),
        };
    }
}

