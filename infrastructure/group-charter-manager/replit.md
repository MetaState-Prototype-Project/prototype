# Group Charter Application

## Overview

This is a full-stack web application for managing group charters and social group memberships. The application allows users to create, manage, and track charters for various social groups across different platforms (Instagram, Facebook, Discord). It features a modern React frontend with shadcn/ui components and an Express.js backend with PostgreSQL database integration.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **API Design**: RESTful API with JSON responses
- **Session Management**: Express sessions with PostgreSQL session store
- **Error Handling**: Centralized error handling middleware

### Project Structure
```
├── client/          # React frontend
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Utility functions
├── server/          # Express backend
│   ├── routes.ts    # API route definitions
│   ├── storage.ts   # Data access layer
│   └── vite.ts      # Vite development server setup
├── shared/          # Shared TypeScript types and schemas
└── migrations/      # Database migration files
```

## Key Components

### Database Schema
- **Users**: User accounts with authentication
- **Social Groups**: Groups from external platforms (Instagram, Facebook, Discord)
- **Charters**: Rules and guidelines for specific groups
- **Group Members**: Membership relationships with roles

### API Endpoints
- `GET /api/user` - Get current user information
- `GET /api/groups` - Get user's social groups
- `GET /api/charters` - Get user's charters
- `GET /api/charters/:id` - Get specific charter details
- `POST /api/charters` - Create new charter

### Frontend Pages
- **Dashboard**: Overview of user's groups and charters
- **Charter Detail**: Detailed view of a specific charter
- **Create Charter**: Form to create new charters
- **404 Page**: Error page for invalid routes

## Data Flow

1. **User Authentication**: Currently mocked (user ID 1), but infrastructure ready for real auth
2. **Data Fetching**: React Query handles API calls with caching and error handling
3. **State Management**: Server state managed by React Query, local state by React hooks
4. **Form Submission**: React Hook Form with Zod validation, API calls via fetch
5. **Database Operations**: Drizzle ORM with type-safe queries to PostgreSQL

## External Dependencies

### Frontend Dependencies
- React ecosystem (React, React DOM, React Router via Wouter)
- UI components (Radix UI primitives, shadcn/ui)
- Styling (Tailwind CSS, class-variance-authority)
- Forms (React Hook Form, Zod validation)
- Data fetching (TanStack Query)

### Backend Dependencies
- Express.js with TypeScript support
- Database (Drizzle ORM, Neon Database serverless driver)
- Session management (connect-pg-simple)
- Development tools (tsx, esbuild for production builds)

### Development Tools
- Vite for frontend development
- TypeScript for type safety
- Drizzle Kit for database migrations
- PostCSS with Tailwind CSS

## Deployment Strategy

### Development Environment
- Frontend: Vite dev server with HMR
- Backend: tsx for TypeScript execution with auto-reload
- Database: Neon Database serverless PostgreSQL

### Production Build
- Frontend: Vite builds optimized static assets
- Backend: esbuild bundles server code for Node.js
- Database: Drizzle migrations applied via `db:push` command

### Environment Configuration
- `DATABASE_URL` required for database connection
- Development vs production mode handled via `NODE_ENV`
- Replit-specific configurations for development banner and cartographer

## Recent Changes
- July 17, 2025: UI Development Complete - Final polish and organization:
  - ✓ Separated Charter Owner & Admins into two distinct cards for better organization
  - ✓ Added charter description to Charter Details section above guidelines
  - ✓ Updated back button hover state to use amber brand color with 10% opacity
  - ✓ UI is now feature-complete with consistent amber brand colors throughout
  - ⚠️ Known Issue: Edit charter form may have pre-population bugs requiring investigation

- July 17, 2025: Fixed remaining purple elements to use amber brand colors:
  - ✓ Updated "View Charter" button color from purple to amber
  - ✓ Updated guideline numbering badges in forms from purple to amber
  - ✓ Updated "Add Another Guideline" button from purple to amber
  - ✓ Updated form input focus colors from purple to amber
  - ✓ Updated loading elements to use black with 10% opacity for subtle appearance
  - ✓ Moved navigation buttons to right side of navbar next to user button
  - ✓ Hidden dashboard button when user is on dashboard page for cleaner UX

- July 17, 2025: Changed brand colors to amber gold yellow gradient:
  - ✓ Updated primary colors from purple-pink to amber gold (f59e0b to d97706)
  - ✓ Updated secondary colors to complementary yellow tones (fbbf24 to f59e0b)
  - ✓ Updated background gradient to warm amber tones (fffbf0 to fef3c7)
  - ✓ Updated CSS variables for light and dark modes
  - ✓ Maintained proper contrast ratios for accessibility
  - ✓ Updated shadows and hover effects to match new brand colors

- July 17, 2025: Created custom certificate ribbon logo icon:
  - ✓ Designed SVG certificate ribbon icon with gradient styling
  - ✓ Replaced generic Users icon with custom certificate ribbon in navbar
  - ✓ Icon features certificate document with ribbon tails and golden seal
  - ✓ Matches app branding with purple-pink gradient theme

- July 17, 2025: Added golden "Owner" badge for charter cards:
  - ✓ Added Crown icon with golden gradient background next to green check badge
  - ✓ Only visible to charter owners for security and clear ownership identification
  - ✓ Responsive design matching existing badge styling

- July 17, 2025: Removed dashboard stats cards for cleaner interface:
  - ✓ Removed Total Charters and Active Groups cards from dashboard
  - ✓ Simplified dashboard layout focusing on charter and group content

- July 17, 2025: Reduced top page margin by half for better visual balance:
  - ✓ App layout: pt-20 → pt-10 (reduced main content top padding)
  - ✓ Improved overall page spacing and visual hierarchy

- July 17, 2025: Charter editing functionality completed:
  - ✓ Created dedicated edit charter page at `/charter/:id/edit`
  - ✓ Reused form structure from create charter with pre-populated data
  - ✓ Added proper form validation and submission for updates
  - ✓ Updated charter detail page to link to edit page instead of inline editing
  - ✓ Implemented PATCH API endpoint for charter updates
  - ✓ Added proper loading states and error handling
  - ✓ Form includes all settings: auto-approve, allow posts, charter status
  - ✓ Proper navigation back to charter detail after successful update

- July 17, 2025: Charter creation form completed with settings panel:
  - ✓ Fixed critical form submission issue by synchronizing guidelines with form validation
  - ✓ Added Charter Settings section with three toggle switches:
    * Auto-approve new members (defaults to Disabled)
    * Allow member posts (defaults to Enabled)
    * Charter status (defaults to Active)
  - ✓ Updated database schema to include autoApprove and allowPosts fields in form
  - ✓ Integrated settings with form validation and submission
  - ✓ Removed debug logging after successful form testing
  - ✓ Form now fully functional with all required fields and settings

- July 17, 2025: Dashboard completed with comprehensive platform badge system:
  - ✓ Created reusable PlatformBadge component for consistent platform display
  - ✓ Unified platform branding: Pictique (Instagram/Facebook) and Blabsy (Twitter/Discord)
  - ✓ Updated dashboard table to use styled platform badges
  - ✓ Updated charter cards to use platform badges
  - ✓ Updated charter detail page to use platform badges
  - ✓ Updated create charter form to use platform badges
  - ✓ Fixed database relationships to properly show Live vs No Charter status
  - ✓ Added visual status indicators with colored dots and badges
  - ✓ Simplified charter cards: removed image, description, member count
  - ✓ Changed "View Details" to "View Charter" in charter cards
  - ✓ Added group name as subtitle in charter cards for better context
  - ✓ Dashboard now complete with clean, modern design and consistent branding

- July 17, 2025: Removed landing page and updated authentication flow:
  - ✓ Removed landing page component entirely
  - ✓ Updated app routing to redirect unauthenticated users directly to login
  - ✓ Simplified authentication flow - no intermediate landing page
  - ✓ Users now go straight to login when accessing the app

- July 03, 2025: Comprehensive mobile responsive design fixes:
  - ✓ Added mobile navigation menu with hamburger toggle
  - ✓ Optimized all page layouts for mobile screens
  - ✓ Improved touch targets (minimum 44px for accessibility)
  - ✓ Fixed charter cards layout and text truncation on mobile
  - ✓ Made forms fully responsive with better spacing
  - ✓ Added global mobile CSS optimizations
  - ✓ Improved button and text sizing across breakpoints
  - ✓ Fixed horizontal scrolling issues

- July 03, 2025: Fixed critical platform issues:
  - ✓ Charter creation API and form submission
  - ✓ Dashboard stats authentication (now uses user ID)  
  - ✓ Navbar displays actual user name from auth
  - ✓ Replaced Font Awesome with Lucide React icons
  - ✓ Added proper image URLs to social groups
  - ✓ Cleaned up debug logging
  - ✓ Fixed TypeScript errors in server routes

## Changelog
- July 03, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.