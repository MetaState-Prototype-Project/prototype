---
sidebar_position: 1
---

# Getting Started with Platform Development

This guide will help you get started building platforms in the metastate ecosystem. We'll cover the essential concepts and patterns you'll need to implement, using `@eCurrency-api` as a reference example.

## Overview

Platforms in the metastate ecosystem follow a standard architecture pattern:
1. **[Authentication](/docs/W3DS%20Protocol/Authentication)** — Users authenticate using their W3ID (Web3 Identity) via the `w3ds://auth` protocol
2. **[Webhooks](/docs/Post%20Platform%20Guide/webhook-controller)** — Platform data syncs from the global eVault system via webhooks
3. **[Mappings](/docs/Post%20Platform%20Guide/mapping-rules)** — Data transformation between global ontology and local database schemas

This document focuses on authentication. For webhooks and mappings, see the other documentation files.

## Authentication

All platforms use a signature-based authentication system that leverages users' existing ename and keys attached to that. The authentication flow follows the [`w3ds://auth`](/docs/W3DS%20Protocol/Authentication) protocol.

### Authentication Flow

The authentication process involves these steps:

1. **Client requests auth offer** → Server returns `w3ds://auth` URL with session ID
2. **User signs in via w3ds client** → User is redirected back with signature
3. **Server verifies signature** → Uses `signature-validator` to verify the signature
4. **Server finds/creates user** → Looks up user by eName, generates JWT token
5. **Client uses Bearer token** → Includes token in `Authorization: Bearer <token>` header
6. **Middleware validates token** → `authMiddleware` extracts token and loads user into `req.user`
7. **Protected routes** → Use `authGuard` to ensure user is authenticated

### Implementation Example (eCurrency-api)

#### 1. Offer Endpoint (`GET /api/auth/offer`)

This endpoint generates an authentication offer URL that the client can use to initiate the login flow.

```typescript
getOffer = async (req: Request, res: Response) => {
    const baseUrl = "http://localhost:9888";
    const url = new URL("/api/auth", baseUrl).toString();
    const sessionId = uuidv4();
    const offer = `w3ds://auth?redirect=${url}&session=${sessionId}&platform='PLATFORM NAME HERE`;
    res.json({ offer, sessionId });
};
```

**Response:**
```json
{
  "offer": "w3ds://auth?redirect=http://localhost:9888/api/auth&session=abc123...&platform=ecurrency",
  "sessionId": "abc123..."
}
```

The client opens this URL in a w3ds-compatible client (like the [eID Wallet](/docs/Infrastructure/eID-Wallet)), which handles the user's signature and redirects back to your platform.

#### 2. Login Endpoint (`POST /api/auth`)

This endpoint receives the authentication result from the w3ds client and verifies the signature.

**Request body:**
```json
{
  "ename": "@user.w3id",
  "session": "abc123...",
  "w3id": "https://evault.example.com/users/123",
  "signature": "z..."
}
```

**Implementation:**
```typescript
login = async (req: Request, res: Response) => {
    const { ename, session, signature } = req.body;
    
    // Verify signature using signature-validator (see [Signing](/docs/W3DS%20Protocol/Signing) / [Signature Formats](/docs/W3DS%20Protocol/Signature-Formats))
    const verificationResult = await verifySignature({
        eName: ename,
        signature: signature,
        payload: session,
        registryBaseUrl: process.env.PUBLIC_REGISTRY_URL,
    });
    
    if (!verificationResult.valid) {
        return res.status(401).json({ 
            error: "Invalid signature", 
            message: verificationResult.error 
        });
    }
    
    // Find user by eName (users must be created via webhook first)
    const user = await this.userService.findUser(ename);
    if (!user) {
        return res.status(404).json({ 
            error: "User not found",
            message: "User must be created via [eVault](/docs/Infrastructure/eVault) [webhook](/docs/Post%20Platform%20Guide/webhook-controller) before authentication" 
        });
    }
    
    // Generate JWT token
    const token = signToken({ userId: user.id });
    
    res.status(200).json({
        user: { /* user data */ },
        token,
    });
};
```

**Key points:**
- The `session` string is what was signed by the user
- Signature verification uses the `signature-validator` package (see [Signing](/docs/W3DS%20Protocol/Signing)), which:
  - Fetches the user's public key from their [eVault](/docs/Infrastructure/eVault)
  - Verifies the signature using Web Crypto API
  - Supports multiple signature formats (multibase, base64, etc.)
- Users must exist in your database before they can authenticate (created via [webhooks](/docs/Post%20Platform%20Guide/webhook-controller))
- The JWT token contains the `userId` and expires in 7 days

#### 3. JWT Token Generation

The JWT token is generated using a secret key stored in `JWT_SECRET` environment variable.

```typescript
// src/utils/jwt.ts
export const signToken = (payload: AuthTokenPayload): string => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
};

export const verifyToken = (token: string): AuthTokenPayload => {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & AuthTokenPayload;
    if (!decoded.userId || typeof decoded.userId !== 'string') {
        throw new Error("Invalid token: missing or invalid userId");
    }
    return { userId: decoded.userId };
};
```

**Important:** Always set `JWT_SECRET` as an environment variable and never commit it to version control.

#### 4. Auth Middleware

The auth middleware extracts the JWT token from the `Authorization` header and loads the user into `req.user`.

```typescript
// src/middleware/auth.ts
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(); // Continue without user (for optional auth routes)
    }
    
    const token = authHeader.substring(7);
    
    try {
        const { userId } = verifyToken(token);
        const user = await userService.getUserById(userId);
        
        if (user) {
            req.user = user;
        }
    } catch (error) {
        // Invalid token - continue without user
    }
    
    next();
};
```

#### 5. Auth Guard

The auth guard ensures that a user is authenticated before proceeding.

```typescript
export const authGuard = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
};
```

### Route Configuration

Routes are configured to use middleware appropriately:

```typescript
// Public routes (no auth required)
app.get("/api/auth/offer", authController.getOffer);
app.post("/api/auth", authController.login);
app.post("/api/webhook", webhookController.handleWebhook); // Webhooks don't require auth

// Protected routes (auth required)
app.use(authMiddleware); // Apply auth middleware to all routes below

app.get("/api/users/me", authGuard, userController.currentUser);
app.post("/api/currencies", authGuard, currencyController.createCurrency);
// ... other protected routes
```

**Route patterns:**
- **Public routes**: Authentication endpoints, webhooks, and any public-facing APIs
- **Protected routes**: All routes after `app.use(authMiddleware)` require authentication
- **Optional auth routes**: Routes that work with or without authentication (rare)

### Environment Variables

Required environment variables for authentication:

```env
# JWT secret for token signing/verification
JWT_SECRET=your-secret-key-here

# Registry base URL for signature verification
PUBLIC_REGISTRY_URL=https://registry.example.com

## References

- [Authentication](/docs/W3DS%20Protocol/Authentication) — w3ds://auth protocol
- [Signing](/docs/W3DS%20Protocol/Signing) — Signature creation and verification
- [Signature Formats](/docs/W3DS%20Protocol/Signature-Formats) — Cryptographic details
- [Webhook Controller](/docs/Post%20Platform%20Guide/webhook-controller) — Receiving webhooks
- [Mapping Rules](/docs/Post%20Platform%20Guide/mapping-rules) — Schema mapping
- [eVault](/docs/Infrastructure/eVault) — Storage and key binding
- [Registry](/docs/Infrastructure/Registry) — W3ID resolution and JWKS

