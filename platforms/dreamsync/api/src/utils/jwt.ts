import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.DREAMSYNC_JWT_SECRET;

if (!JWT_SECRET) throw new Error("InternalError: Missing DREAMSYNC_JWT_SECRET")

export const signToken = (payload: { userId: string }): string => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
};

export const verifyToken = (token: string): any => {
    return jwt.verify(token, JWT_SECRET);
};
