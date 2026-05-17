import { AppDataSource } from "../database/data-source";
import { Subscription } from "../database/entities/Subscription";
import type { Packet } from "../database/entities/Packet";

/**
 * Resolves which subscriptions should receive a given packet. A subscription
 * matches when:
 *  - its consumer is approved and the subscription is active, and
 *  - its ontologyFilter is empty OR contains the packet's ontology, and
 *  - its evaultFilter is empty OR contains the packet's w3id / evaultPublicKey.
 */
export class SubscriptionMatcher {
    async match(packet: Packet): Promise<Subscription[]> {
        const evaultIds = [packet.w3id, packet.evaultPublicKey].filter(
            (v): v is string => Boolean(v),
        );

        return AppDataSource.getRepository(Subscription)
            .createQueryBuilder("s")
            .innerJoin("consumers", "c", "c.id = s.consumerId")
            .where("s.active = true")
            .andWhere("c.status = :approved", { approved: "approved" })
            .andWhere(
                "(cardinality(s.ontologyFilter) = 0 OR :ontology = ANY(s.ontologyFilter))",
                { ontology: packet.ontology },
            )
            .andWhere(
                evaultIds.length > 0
                    ? "(cardinality(s.evaultFilter) = 0 OR s.evaultFilter && :evaultIds)"
                    : "cardinality(s.evaultFilter) = 0",
                evaultIds.length > 0 ? { evaultIds } : {},
            )
            .getMany();
    }
}
