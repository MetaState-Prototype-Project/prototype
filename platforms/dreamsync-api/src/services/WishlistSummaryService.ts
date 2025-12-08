import OpenAI from "openai";
import { Repository, IsNull } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Wishlist } from "../database/entities/Wishlist";

type WishlistSummary = {
    summaryWants: string;
    summaryOffers: string;
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
Summarize the wishlist into two ultra-short single-line fragments (<=120 chars each).
Return EXACTLY in this format, nothing else:
wants: <succinct wants summary>
offers: <succinct offers summary>
- Be terse, remove filler, prefer keywords over sentences.
- Avoid newlines, commas, and the delimiter "${DELIMITER}".
- If explicit wants/offers are missing, infer concise intent/skills from context.
`.trim();

        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are a terse summarizer that emits exactly two lines: wants and offers.",
                    },
                    {
                        role: "user",
                        content: `${prompt}\n\nWishlist content:\n${content}`,
                    },
                ],
                temperature: 0.2,
                max_tokens: 180,
            });

            const raw = response.choices[0]?.message?.content || "";
            const parsed = this.parseSummary(raw);
            if (parsed) {
                return parsed;
            }
        } catch (error) {
            console.error("WishlistSummaryService: OpenAI summarization failed, using fallback", error);
        }

        // Fallback: truncate raw content into two identical concise lines
        const fallback = this.buildFallback(content);
        return {
            summaryWants: fallback,
            summaryOffers: fallback,
        };
    }

    async summarizeAndPersist(wishlist: Wishlist): Promise<Wishlist> {
        const { summaryWants, summaryOffers } = await this.summarizeWishlistContent(wishlist.content);
        wishlist.summaryWants = summaryWants;
        wishlist.summaryOffers = summaryOffers;
        return this.wishlistRepository.save(wishlist);
    }

    async ensureSummaries(wishlist: Wishlist): Promise<Wishlist> {
        if (wishlist.summaryWants && wishlist.summaryOffers) {
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

    private parseSummary(raw: string): WishlistSummary | null {
        const cleaned = raw.replace(/\r/g, "").trim();
        const wantsMatch = cleaned.match(/wants:\s*(.*)/i);
        const offersMatch = cleaned.match(/offers:\s*(.*)/i);

        if (!wantsMatch && !offersMatch) {
            return null;
        }

        const summaryWants = this.cleanFragment(wantsMatch?.[1] || "");
        const summaryOffers = this.cleanFragment(offersMatch?.[1] || "");

        if (!summaryWants && !summaryOffers) {
            return null;
        }

        return {
            summaryWants: summaryWants || summaryOffers || "",
            summaryOffers: summaryOffers || summaryWants || "",
        };
    }

    private cleanFragment(fragment: string): string {
        return fragment
            .replaceAll(DELIMITER, " ")
            .replace(/\s+/g, " ")
            .replace(/[,\n\r]+/g, " ")
            .trim()
            .slice(0, MAX_FALLBACK_LENGTH);
    }

    private buildFallback(content: string): string {
        return this.cleanFragment(content).slice(0, MAX_FALLBACK_LENGTH);
    }
}

