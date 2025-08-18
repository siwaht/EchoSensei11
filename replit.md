# VoiceAI Dashboard

## Overview

VoiceAI Dashboard is a multi-tenant SaaS application that allows organizations to monitor their ElevenLabs voice AI agents. The platform follows a "Bring Your Own Key" (BYOK) model where clients securely connect their own ElevenLabs API credentials to monitor call logs, agent performance, and usage analytics. The application provides comprehensive dashboards for tracking voice agent interactions, billing information, and system integrations.

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

### ElevenLabs Integration
BYOK integration pattern for secure third-party service access:

- **API Key Management**: Client-provided API keys encrypted and stored securely using AES-256-CBC
- **Agent Validation**: Real-time validation of ElevenLabs conversational AI agent IDs via `/v1/convai/agents/` API
- **Call Data Collection**: Webhook endpoint `/api/webhooks/elevenlabs` for real-time call transcripts and audio
- **Manual Sync**: User-triggered sync button to fetch historical call logs from ElevenLabs API
- **Data Storage**: Complete call logs with transcripts, duration, costs, and audio URLs stored in PostgreSQL
- **Analytics**: Real-time dashboard showing total calls, minutes, estimated costs, and active agents

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL for serverless database hosting
- **Authentication**: Replit Auth for OpenID Connect authentication
- **Build System**: Vite for fast development and optimized production builds

### Third-party Services
- **ElevenLabs API**: Voice AI service integration with BYOK model
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