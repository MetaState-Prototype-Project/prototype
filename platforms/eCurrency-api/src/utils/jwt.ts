import jwt, { JwtPayload } from "jsonwebtoken";

// Fail fast if JWT_SECRET is missing
if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required but was not provided. Please set JWT_SECRET in your environment configuration.");
}

const JWT_SECRET = process.env.ECURRENCY_JWT_SECRET;

export interface AuthTokenPayload {
    userId: string;
}

export const signToken = (payload: AuthTokenPayload): string => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
};

export const verifyToken = (token: string): AuthTokenPayload => {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & AuthTokenPayload;

    // Validate that the decoded token has the required userId field
    if (!decoded.userId || typeof decoded.userId !== 'string') {
        throw new Error("Invalid token: missing or invalid userId");
    }

    return {
        userId: decoded.userId
    };
};

