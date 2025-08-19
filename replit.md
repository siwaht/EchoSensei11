# VoiceAI Dashboard

## Overview

VoiceAI Dashboard is a white-label, multi-tenant SaaS platform for managing and monitoring voice AI agents. The platform follows a "Bring Your Own Key" (BYOK) model where clients securely connect their VoiceAI API credentials to monitor call logs, agent performance, and usage analytics. The application provides comprehensive dashboards for tracking voice agent interactions, billing information, and system integrations. While the platform is powered by advanced voice AI technology, it operates as a fully branded solution where customers interact with the VoiceAI brand without awareness of the underlying infrastructure.

### Recent Updates (August 19, 2025)
- **Complete Mobile Responsiveness**: Implemented full mobile responsiveness across all application pages
- **Streamlined Navigation**: Removed redundant features and collapsible sections for cleaner interface
- **White-Label Platform**: Fully rebranded as VoiceAI with no visible ElevenLabs references
- **Consolidated Features**: Merged Call History into Conversations, removed Playground (redundant with agent testing)
- **Simplified Interface**: Direct navigation to all features without nested menus
- **Enhanced Audio Player**: Fixed play/pause functionality with proper state management and controls
- **Call Timestamp Syncing**: Integrated actual call timestamps from Voice API using start_time_unix_secs field
- **Redesigned Organizations Tab**: Created comprehensive organization management interface with detailed metrics and insights
- **Payment Gateway Integration**: Added complete payment processing infrastructure with Stripe and PayPal support
- **Checkout System**: Created checkout page for organizations to select and pay for billing packages
- **Payment Tracking**: Implemented payment history tracking and transaction management in database

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client-side is built with modern React technologies using Vite as the build tool. The architecture follows a component-based approach with:

- **UI Framework**: React with TypeScript for type safety
- **Styling**: Tailwind CSS with Shadcn/UI component library for consistent design
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state management and caching
- **Forms**: React Hook Form with Zod validation for robust form handling
- **Theme Support**: Light/dark mode toggle with theme provider

### Backend Architecture
The server uses Node.js with Express in a RESTful API design:

- **Runtime**: Node.js with Express framework
- **Language**: TypeScript for type safety across the stack
- **Authentication**: Passport.js with OpenID Connect for Replit Auth integration
- **Session Management**: Express sessions with PostgreSQL storage
- **API Security**: BYOK model with encrypted API key storage using AES-256-GCM encryption

### Database Layer
PostgreSQL database with Drizzle ORM for type-safe database operations:

- **Multi-tenant Design**: Strict data isolation by organization ID across all tables
- **Schema Management**: Drizzle Kit for migrations and schema generation
- **Connection**: Neon serverless PostgreSQL with connection pooling
- **Key Tables**: Users, Organizations, Integrations, Agents, Call Logs, and Analytics

### Authentication & Authorization
Secure authentication system with multi-tenant support:

- **Provider**: Replit Auth via OpenID Connect
- **Session Storage**: PostgreSQL-backed sessions with TTL support
- **Multi-tenancy**: Organization-based data isolation with user-organization relationships
- **Security**: Encrypted API key storage for third-party service integration
- **Admin System**: Role-based access control with dedicated admin dashboard
- **Admin User**: cc@siwaht.com has full administrative privileges

### VoiceAI Integration
BYOK integration pattern for secure API access:

- **API Key Management**: Client-provided API keys encrypted and stored securely using AES-256-CBC
- **Agent Validation**: Real-time validation of conversational AI agent IDs via secure API endpoints
- **Call Data Collection**: Webhook endpoint `/api/webhooks/voiceai` for real-time call transcripts and audio
- **Manual Sync**: User-triggered sync button to fetch historical call logs from Voice API
- **Audio Recordings**: Authenticated proxy endpoint `/api/audio/:conversationId` streams actual call recordings
- **Data Storage**: Complete call logs with transcripts, duration, costs, and audio URLs stored in PostgreSQL
- **Analytics**: Real-time dashboard showing total calls, minutes, estimated costs, and active agents
- **Conversations Interface**: Unified interface for browsing, playing, and downloading actual voice call recordings

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL for serverless database hosting
- **Authentication**: Replit Auth for OpenID Connect authentication
- **Build System**: Vite for fast development and optimized production builds

### Third-party Services
- **VoiceAI API**: Voice AI service integration with BYOK model (white-labeled platform)
- **Stripe**: Payment processing for credit card and digital wallet payments (configuration pending)
- **PayPal**: Alternative payment gateway for PayPal and Venmo payments (configuration pending)
- **Font Services**: Google Fonts for typography (Architects Daughter, DM Sans, Fira Code, Geist Mono)

### Development Tools
- **TypeScript**: Type safety across frontend and backend
- **Drizzle ORM**: Type-safe database operations with PostgreSQL
- **Zod**: Runtime type validation and schema definition
- **ESBuild**: Fast JavaScript bundling for production builds

### UI Components
- **Radix UI**: Accessible component primitives for complex UI elements
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/UI**: Pre-built component library with consistent design system
- **Recharts**: Data visualization for analytics dashboards
- **Lucide React**: Icon library for consistent iconography