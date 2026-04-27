# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Initial setup (install deps + init Prisma DB)
npm run setup

# Development server (requires node-compat.cjs shim)
npm run dev

# Build for production
npm run build

# Run all tests
npm test

# Run a single test file
npx vitest run src/lib/__tests__/file-system.test.ts

# Lint
npm run lint

# Reset database
npm run db:reset

# Regenerate Prisma client after schema changes
npx prisma generate

# Run new migration
npx prisma migrate dev
```

## Environment

Set `ANTHROPIC_API_KEY` in `.env` to enable real AI generation. Without it, the app falls back to `MockLanguageModel` (static demo output defined in `src/lib/provider.ts`).

`JWT_SECRET` defaults to `"development-secret-key"` if not set — set it explicitly in production.

## Architecture

UIGen is an AI-powered React component generator with live preview. Users describe a component in chat; Claude uses tool calls to write files into a virtual file system; a live iframe renders the result.

### Data Flow

```
User prompt → POST /api/chat → streamText (Vercel AI SDK)
  → Claude with tools: str_replace_editor / file_manager
  → Virtual FS updated via tool calls
  → Persisted to Prisma (Project.data + Project.messages as JSON strings)
  → PreviewFrame re-renders iframe with Babel-transpiled JSX
```

### Key Layers

**API Route** (`src/app/api/chat/route.ts`): Streams AI responses. Loads/saves project state from Prisma. Registers two tools: `str_replace_editor` (create/edit files) and `file_manager` (directory ops). Uses `getLanguageModel()` to swap real/mock Claude.

**Virtual File System** (`src/lib/file-system.ts`): In-memory FS abstraction (no actual disk I/O). Serializes to JSON for DB persistence. All file operations (CRUD, rename) go through this.

**Contexts** (`src/lib/contexts/`):
- `FileSystemContext`: Owns the virtual FS instance, exposes it to all components.
- `ChatContext`: Owns message history, calls `/api/chat`, updates FS from streaming tool results.

**Preview** (`src/components/preview/PreviewFrame.tsx`): Renders an `<iframe>` with an import map + Babel standalone. `src/lib/transform/jsx-transformer.ts` handles JSX → JS transpilation and resolves component imports within the virtual FS.

**Authentication** (`src/lib/auth.ts`): JWT via `jose`, stored in HTTP-only cookies (7-day expiry). Server actions in `src/actions/` handle sign-up/in/out and project CRUD.

### UI Layout

Three-panel layout in `src/app/main-content.tsx`:
- Left 35%: Chat interface
- Right 65%: Resizable — Preview iframe **or** Monaco code editor + file tree

### Database Schema

SQLite via Prisma. Two models: `User` and `Project`. `Project.messages` and `Project.data` are JSON strings (chat history and virtual FS snapshot respectively).

### Mock Provider

When no API key is set, `MockLanguageModel` in `src/lib/provider.ts` simulates a multi-step Claude interaction with hardcoded tool calls — useful for development without burning API credits.
