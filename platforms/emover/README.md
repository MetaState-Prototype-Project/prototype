# Emover Frontend

Frontend platform for evault migration, built with Next.js.

## Features

- Secure eID Wallet authentication
- View current evault host/provider
- List and select new provisioners
- Migration flow with QR code signing
- Real-time migration progress
- Comprehensive logging display

## Environment Variables

- `NEXT_PUBLIC_EMOVER_BASE_URL` - Backend API base URL (default: http://localhost:4000)

## Development

```bash
npm install
npm run dev
```

## Pages

- `/login` - Authentication page with QR code
- `/` - Dashboard showing current evault and provisioner selection
- `/migrate` - Migration progress page with QR code signing

