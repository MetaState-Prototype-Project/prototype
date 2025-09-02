# eReputation - Professional Reputation Management Platform

## Overview

eReputation is a full-stack web application for professional reputation analysis and management. The platform allows users to calculate reputation scores for themselves and others (users, groups, platforms) using AI-powered analysis. It features a modern React frontend with shadcn/ui components and an Express.js backend with PostgreSQL database integration.

## Recent Changes (August 11, 2025)

### Production-Ready Email/Password Authentication System Completed
- Successfully replaced Replit auth with comprehensive email/password authentication
- Implemented bcrypt password hashing for secure credential storage
- Created session-based authentication with PostgreSQL session store
- Built QR code-style authentication interface with eReputation branding
- Updated all API routes and middleware to use new requireAuth system
- Created TypeORM User entity with email, password, firstName, lastName fields
- Cleaned authentication page design with W3DS branding and MetaState messaging

### Database Migration to TypeORM Completed
- Successfully migrated from Drizzle ORM to TypeORM with PostgreSQL
- Created comprehensive TypeORM entities preserving all existing schema relationships
- Implemented automatic database schema creation and initialization
- Maintained backward compatibility through schema re-exports
- Database migration infrastructure ready for seamless data preservation

### AI Functionality Removed - Simple Digital Signatures Added
- Removed all AI/OpenAI functionality from reference creation and reputation calculation
- Implemented simple digital signature system for references using basic cryptographic hashing
- References now include digital signature and timestamp for authenticity verification
- Reputation calculations use simplified random scoring instead of AI analysis
- System ready for future replacement with more sophisticated signature libraries

### Unified Reference View Modal System Completed
- Created shared ReferenceViewModal component for consistent modal behavior across all pages
- Fixed dashboard reference view to display actual reference content from database instead of mock data
- Both dashboard and references pages now use identical modal component for viewing references
- Updated activity handler to access full reference data from activity.data property
- Eliminated duplicate modal code and ensured consistent user experience
- Mobile-first responsive design maintained across all reference viewing interfaces
- Maintained separate modal systems: ReferenceViewModal for references, Activity Details modal for eReputation calculations

### Landing Page Redesign Completed
- Implemented clean gradient background (fig/30 to fig/10, bottom to top)
- Removed blur effects behind logo for cleaner appearance
- Updated modal background to fig-10 for consistency
- Applied branded fig background icons with swiss-cheese gold text throughout
- Updated feature text to "Calculate", "Reference", "Share" with proper spacing
- Optimized icon spacing for desktop viewing (gap-8, justify-center)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: TypeORM for entity-based database operations
- **Authentication**: Email/password authentication with bcrypt hashing
- **Session Management**: Express sessions with PostgreSQL storage
- **File Uploads**: Multer for handling file attachments

## Key Components

### Authentication System
- **Provider**: Email/password authentication with bcrypt
- **Session Storage**: PostgreSQL-backed sessions with connect-pg-simple
- **Security**: HTTP-only secure cookies with session-based authentication
- **User Management**: Registration and login with secure password hashing
- **Interface**: QR code-style login page with eReputation and W3DS branding

### Reputation Analysis Engine
- **AI Integration**: OpenAI GPT-4o for reputation analysis
- **Analysis Types**: Self-assessment, user evaluation, group/platform analysis
- **Variables**: Configurable analysis parameters (comment history, references, qualifications, etc.)
- **Scoring**: 1-10 reputation score with confidence metrics

### Database Schema
- **Users**: Profile information and authentication data
- **Reputation Calculations**: Analysis results with scores and confidence
- **References**: Professional endorsements and testimonials
- **File Uploads**: Document attachments for evidence
- **Sessions**: Authentication session storage

### File Management
- **Upload Handling**: Multer-based file processing
- **File Types**: Images (JPEG, PNG, GIF) and documents (PDF, DOC, DOCX)
- **Size Limits**: 10MB maximum file size
- **Storage**: Local filesystem storage with configurable paths

## Data Flow

1. **Authentication Flow**:
   - User initiates login via Replit Auth
   - OIDC provider validates credentials
   - Session created and stored in PostgreSQL
   - User profile created/updated in database

2. **Reputation Calculation Flow**:
   - User selects analysis type and variables
   - Backend creates calculation record with "processing" status
   - OpenAI API analyzes based on selected parameters
   - Results stored with score, confidence, and detailed analysis
   - Frontend updates to show completed analysis

3. **Reference Management Flow**:
   - Users can create references for others
   - File uploads supported for evidence
   - References linked to target users/groups/platforms
   - Analysis engine can incorporate reference data

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL for serverless database hosting
- **Authentication**: Replit Auth service for OIDC authentication
- **AI Processing**: OpenAI API for reputation analysis

### Development Tools
- **Package Manager**: npm with lockfile version 3
- **TypeScript**: Type checking and compilation
- **ESBuild**: Production bundling for server code
- **Drizzle Kit**: Database migrations and schema management

### UI/UX Libraries
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first styling framework
- **Lucide React**: Icon library
- **React Hook Form**: Form state management
- **Zod**: Runtime type validation

## Deployment Strategy

### Development Environment
- **Dev Server**: Vite dev server with HMR for frontend
- **Backend**: tsx for TypeScript execution with hot reload
- **Database**: Drizzle push for schema synchronization
- **Environment**: NODE_ENV=development with debug logging

### Production Build
- **Frontend**: Vite build to dist/public directory
- **Backend**: ESBuild bundle to dist/index.js
- **Static Serving**: Express serves built frontend assets
- **Process**: Single Node.js process serving both frontend and API

### Environment Configuration
- **Database**: DATABASE_URL for PostgreSQL connection
- **Auth**: REPL_ID, SESSION_SECRET, ISSUER_URL for authentication
- **AI**: OPENAI_API_KEY for reputation analysis
- **Domains**: REPLIT_DOMAINS for CORS and auth configuration

### File Structure
```
├── client/          # React frontend application
├── server/          # Express.js backend API
├── shared/          # Shared TypeScript types and schemas
├── dist/            # Production build output
├── uploads/         # File upload storage
└── migrations/      # Database migration files
```

The application follows a monorepo structure with clear separation between frontend, backend, and shared code, making it easy to maintain and scale both components independently while sharing common types and utilities.