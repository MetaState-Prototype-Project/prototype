import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.ESIGNER_JWT_SECRET;

if (!JWT_SECRET) throw new Error("InternalError: Missing JWT Secret")

export const signToken = (payload: any): string => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyToken = (token: string): any => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid token');
    }
};


