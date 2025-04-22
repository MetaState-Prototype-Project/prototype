import { YogaInitialContext } from "graphql-yoga";
import { DbService } from "../db/db.service";
import { MetaEnvelope } from "../db/types";

export type VaultContext = YogaInitialContext & {
  currentUser: string | null;
};

export class VaultAccessGuard {
  constructor(private db: DbService) {}

  /**
   * Checks if the current user has access to a meta envelope based on its ACL
   * @param metaEnvelopeId - The ID of the meta envelope to check access for
   * @param context - The GraphQL context containing the current user
   * @returns Promise<boolean> - Whether the user has access
   */
  private async checkAccess(
    metaEnvelopeId: string,
    context: VaultContext
  ): Promise<boolean> {
    if (!context.currentUser) {
      const metaEnvelope = await this.db.findMetaEnvelopeById(metaEnvelopeId);
      if (metaEnvelope && metaEnvelope.acl.includes("*")) return true;
      return false;
    }

    const metaEnvelope = await this.db.findMetaEnvelopeById(metaEnvelopeId);
    if (!metaEnvelope) {
      return false;
    }

    // If ACL contains "*", anyone can access
    if (metaEnvelope.acl.includes("*")) {
      return true;
    }

    // Check if the current user's ID is in the ACL
    return metaEnvelope.acl.includes(context.currentUser);
  }

  /**
   * Filters out ACL from meta envelope responses
   * @param metaEnvelope - The meta envelope to filter
   * @returns The filtered meta envelope without ACL
   */
  private filterACL(metaEnvelope: any) {
    if (!metaEnvelope) return null;
    const { acl, ...filtered } = metaEnvelope;
    return filtered;
  }

  /**
   * Filters a list of meta envelopes to only include those the user has access to
   * @param envelopes - List of meta envelopes to filter
   * @param context - The GraphQL context containing the current user
   * @returns Promise<Array> - Filtered list of meta envelopes
   */
  private async filterEnvelopesByAccess(
    envelopes: MetaEnvelope[],
    context: VaultContext
  ): Promise<any[]> {
    const filteredEnvelopes = [];
    for (const envelope of envelopes) {
      const hasAccess =
        envelope.acl.includes("*") ||
        envelope.acl.includes(context.currentUser ?? "");
      if (hasAccess) {
        filteredEnvelopes.push(this.filterACL(envelope));
      }
    }
    return filteredEnvelopes;
  }

  /**
   * Middleware function to check access before executing a resolver
   * @param resolver - The resolver function to wrap
   * @returns A wrapped resolver that checks access before executing
   */
  public middleware<T, Args extends { [key: string]: any }>(
    resolver: (parent: T, args: Args, context: VaultContext) => Promise<any>
  ) {
    return async (parent: T, args: Args, context: VaultContext) => {
      // For operations that don't require a specific meta envelope ID (bulk queries)
      if (!args.id && !args.envelopeId) {
        const result = await resolver(parent, args, context);

        // If the result is an array of meta envelopes, filter based on access
        if (Array.isArray(result)) {
          return this.filterEnvelopesByAccess(result, context);
        }

        // If the result is a single meta envelope, filter ACL
        return this.filterACL(result);
      }

      // For operations that target a specific meta envelope
      const metaEnvelopeId = args.id || args.envelopeId;
      if (!metaEnvelopeId) {
        const result = await resolver(parent, args, context);
        return this.filterACL(result);
      }

      const hasAccess = await this.checkAccess(metaEnvelopeId, context);
      if (!hasAccess) {
        throw new Error("Access denied");
      }

      // console.log
      const result = await resolver(parent, args, context);
      return this.filterACL(result);
    };
  }
}
