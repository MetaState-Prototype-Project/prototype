import jwt from "jsonwebtoken";


if (!process.env.EMOVER_JWT_SECRET) throw new Error("InternalError: Missing JWT_SECRET")

const JWT_SECRET = process.env.EMOVER_JWT_SECRET as string;


export function signToken(payload: { userId: string }): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: string } | null {
    try {
        return jwt.verify(token, JWT_SECRET) as { userId: string };
    } catch (error) {
        return null;
    }
}

