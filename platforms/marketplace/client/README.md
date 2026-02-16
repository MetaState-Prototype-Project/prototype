# Overview

This is a full-stack web application built as an app marketplace or directory. The platform allows users to browse and review applications, while providing administrative capabilities for managing app listings. The application features a public-facing frontend for discovering apps and submitting reviews, alongside an admin dashboard for content management.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes (Latest First)

## Admin Dashboard Improvements (August 11, 2025)
- Simplified admin login page to basic card - removed registration form, information section, and security notices
- Fixed desktop layout for cleaner, more functional admin dashboard
- Updated "View Public Site" button to open in new tab using target="_blank"
- Renamed "Marketplace Apps" to "Post-Platforms" throughout admin interface
- Added pagination system with 10 items per page for better data management
- Implemented pagination controls with Previous/Next buttons and numbered pages
- Added pagination info showing current range of displayed items
- Downloaded W3DS logo locally and recolored from gray to correct MetaState brand purple (#D9B3FF)
- Removed search functionality from navigation header for cleaner design
- Reduced hero section and categories padding for more compact layout
- Updated main description to "MetaState Post-Platforms for sovereign control of your data"

## Admin Interface Rebranding (August 11, 2025)
- Admin login page completely rebranded with MetaState Foundation styling
- Login and register buttons updated with lime green styling (HSL 85,100%,85%)
- Admin dashboard header modernized with bold typography and branded colors
- Stats cards redesigned with custom rounded containers using MetaState purple and green
- Replaced shadcn Card components with custom styled div containers
- Added hover effects and scaling micro-interactions to buttons
- Fixed JSX syntax errors during rebranding process
- Maintained functional admin authentication system (admin@marketplace.com / admin123)

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side navigation
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **State Management**: TanStack Query (React Query) for server state management
- **Authentication**: Context-based auth provider with session management

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Authentication**: Passport.js with local strategy using session-based auth
- **Password Security**: Built-in crypto module with scrypt for password hashing
- **Session Storage**: In-memory store for development (MemoryStore)
- **API Design**: RESTful endpoints with JSON responses

## Database Architecture
- **Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle ORM with connection pooling
- **Schema Management**: Drizzle migrations with schema definitions in TypeScript
- **Tables**: Users, apps, and reviews with proper foreign key relationships
- **Features**: UUID primary keys, automatic timestamps, cascade deletions

## File Storage
- **Object Storage**: Google Cloud Storage integration
- **File Uploads**: Uppy file uploader with drag-and-drop interface
- **Access Control**: Custom ACL system for object permissions
- **Storage Client**: Google Cloud Storage SDK with external account credentials via Replit sidecar

## Development Environment
- **Hot Reload**: Vite development server with HMR
- **Error Handling**: Runtime error overlay for development
- **Logging**: Custom request/response logging middleware
- **Build Process**: Vite for frontend bundling, esbuild for server bundling

# External Dependencies

## Core Technologies
- **React**: Frontend framework with hooks and context API
- **Express.js**: Web application framework for Node.js
- **PostgreSQL**: Primary database via Neon serverless platform
- **Drizzle ORM**: Type-safe database operations and migrations

## Authentication & Security
- **Passport.js**: Authentication middleware with local strategy
- **Express Session**: Session management with configurable stores
- **Node.js Crypto**: Built-in cryptographic functions for password hashing

## File Management
- **Google Cloud Storage**: Object storage service for file uploads
- **Uppy**: Modern file uploader with multiple plugins
- **AWS S3 Plugin**: Uppy plugin for S3-compatible storage uploads

## UI & Styling
- **Radix UI**: Headless UI primitives for accessibility
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: SVG icon library
- **shadcn/ui**: Pre-built component library

## Development Tools
- **Vite**: Frontend build tool and development server
- **TypeScript**: Static type checking for JavaScript
- **TanStack Query**: Data fetching and caching library
- **Wouter**: Minimalist routing library for React

## Hosting & Deployment
- **Replit**: Development and hosting platform
- **Neon Database**: Serverless PostgreSQL hosting
- **Google Cloud Platform**: Object storage and authentication services