# VoiceAI Dashboard

## Overview

VoiceAI Dashboard is a white-label, multi-tenant SaaS platform for managing and monitoring voice AI agents. The platform follows a "Bring Your Own Key" (BYOK) model where clients securely connect their VoiceAI API credentials to monitor call logs, agent performance, and usage analytics. The application provides comprehensive dashboards for tracking voice agent interactions, billing information, and system integrations. While the platform is powered by advanced voice AI technology, it operates as a fully branded solution where customers interact with the VoiceAI brand without awareness of the underlying infrastructure.

### Recent Updates (August 26, 2025)
- **RAG System Prompt Configuration Fixed**: Implemented backend endpoints to save and load RAG configuration including system prompts
- **Configuration Persistence**: Added `/api/tools/rag-config` endpoints for saving and retrieving RAG settings
- **Frontend Auto-Load**: RAG configuration now automatically loads saved settings when opening the knowledge base page
- **System Prompt Integration**: RAG webhook now properly uses saved system prompt when formatting responses
- **RAG Webhook Fixed**: Fixed vector search functionality in RAG system webhook - now successfully retrieves and returns relevant information from uploaded documents
- **Enhanced Search Logic**: Improved document search to work across all organizations when specific agent/org IDs not provided
- **Vector Search Working**: Resolved issues with embeddings and vector similarity search using LanceDB and OpenAI embeddings
- **Webhook Testing**: Successfully tested webhook endpoint returning accurate document content for queries

### Previous Updates (August 25, 2025)
- **Custom RAG Tool**: Implemented custom Retrieval-Augmented Generation (RAG) system as a webhook-based tool for voice agents
- **RAG Webhook Endpoints**: Created multiple webhook endpoints (/api/public/rag, /api/webhooks/rag, /api/tools/rag) for ElevenLabs agent integration
- **Simplified Webhook Response**: Updated webhook to return simple JSON with just a "message" field for better ElevenLabs compatibility
- **Manual Setup Instructions**: Added clear instructions for manually adding webhook to ElevenLabs agents (automatic sync not supported for custom tools)
- **Renamed to RAG System**: Changed naming from "Knowledge Base" to "RAG System" to clarify this is a custom tool, not ElevenLabs' built-in knowledge base
- **Vector Database Integration**: Integrated LanceDB for efficient semantic search with OpenAI embeddings
- **Document Management**: Added ability to upload and manage documents for the RAG system with chunking and indexing

### Previous Updates (August 24, 2025)
- **Complete Mobile Responsiveness**: Implemented full mobile responsiveness across all application pages
- **Mobile-First Call History**: Converted call history table to responsive card layout on mobile devices
- **Responsive Navigation**: Updated AppShell with mobile-friendly collapsible navigation
- **Adaptive UI Components**: All buttons, forms, and grids now stack appropriately on smaller screens
- **Enhanced Audio Player**: Fixed play/pause functionality with proper state management and controls
- **Call Timestamp Syncing**: Integrated actual call timestamps from ElevenLabs API using start_time_unix_secs field
- **Redesigned Organizations Tab**: Created comprehensive organization management interface with detailed metrics and insights
- **Payment Gateway Integration**: Added complete payment processing infrastructure with Stripe and PayPal support
- **Checkout System**: Created checkout page for organizations to select and pay for billing packages
- **Payment Tracking**: Implemented payment history tracking and transaction management in database
- **Agent Playground**: Created interactive testing environment for voice AI agents with chat interface and call simulation
- **Enhanced User Experience**: Added comprehensive onboarding guide, step-by-step setup flows, contextual tooltips, and improved empty states
- **Getting Started Component**: Created interactive getting started guide on the dashboard with progress tracking
- **Intuitive Empty States**: Redesigned all empty states with clear guidance and action steps for new users

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
- **Manual Sync**: User-triggered sync button to fetch historical call logs from VoiceAI API
- **Audio Recordings**: Authenticated proxy endpoint `/api/audio/:conversationId` streams actual call recordings
- **Data Storage**: Complete call logs with transcripts, duration, costs, and audio URLs stored in PostgreSQL
- **Analytics**: Real-time dashboard showing total calls, minutes, estimated costs, and active agents
- **Recordings Tab**: Dedicated interface for browsing, playing, and downloading actual voice call recordings

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