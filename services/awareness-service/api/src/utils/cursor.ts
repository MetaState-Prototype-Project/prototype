/**
 * Opaque pagination cursor encoding a (receivedAt, id) pair. Packets are ordered
 * by (receivedAt, id) so this pair uniquely positions a row in the result set.
 */
export interface PacketCursor {
    receivedAt: string;
    id: string;
}

export function encodeCursor(cursor: PacketCursor): string {
    return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(raw: string): PacketCursor | null {
    try {
        const parsed = JSON.parse(
            Buffer.from(raw, "base64url").toString("utf8"),
        );
        if (
            parsed &&
            typeof parsed.receivedAt === "string" &&
            typeof parsed.id === "string"
        ) {
            return parsed;
        }
        return null;
    } catch {
        return null;
    }
}
