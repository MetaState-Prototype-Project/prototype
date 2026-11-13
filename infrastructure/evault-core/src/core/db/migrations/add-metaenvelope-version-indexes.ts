import type { Driver } from "neo4j-driver";

export async function createMetaEnvelopeVersionIndexes(
    driver: Driver,
): Promise<void> {
    const session = driver.session();
    try {
        await session.run(
            "CREATE CONSTRAINT metaenvelope_history_key IF NOT EXISTS FOR (h:MetaEnvelopeHistory) REQUIRE (h.metaEnvelopeId, h.eName) IS UNIQUE",
        );
        await session.run(
            "CREATE INDEX metaenvelope_version_key IF NOT EXISTS FOR (v:MetaEnvelopeVersion) ON (v.metaEnvelopeId, v.eName, v.version)",
        );
        await session.run(
            "CREATE INDEX metaenvelope_version_ename IF NOT EXISTS FOR (v:MetaEnvelopeVersion) ON (v.eName)",
        );
    } finally {
        await session.close();
    }
}
