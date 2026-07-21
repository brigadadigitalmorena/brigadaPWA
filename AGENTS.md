# Brigada PWA - Agent Guidelines

## System Overview

Progressive Web Application (PWA) for field workers (brigadistas) to complete surveys offline-first. The PWA replicates the mobile app functionality using web technologies.

For backend API documentation, see **brigadaBackEnd/AGENTS.md**.

## Build & Run

### Development

```bash
npm run dev           # Start Next.js dev server (port 3000)
npm run build         # Production build
npm run start         # Start production server
npm run lint          # Run ESLint
npm run type-check    # TypeScript type checking
```

### Prerequisites

- Node.js 20+
- npm or yarn
- Backend API running (see brigadaBackEnd/)

## Tech Stack

- **Next.js 14** (App Router) / TypeScript 5 / React 18
- **shadcn/ui** + **Tailwind CSS** for UI components
- **Zustand** for client state management
- **TanStack React Query** for server state
- **Dexie.js** (IndexedDB) for offline database
- **React Hook Form** + **Zod** for form validation
- **Axios** for HTTP client with JWT interceptors
- **Workbox** for Service Worker and offline caching
- **MapLibre GL JS** for maps
- **Path alias:** `@/*` → `./src/*`

## Architecture

```text
src/
  app/                    # Next.js App Router
    (auth)/              # Authentication routes
    (dashboard)/         # Protected routes
    layout.tsx           # Root layout with providers
  components/
    ui/                  # shadcn/ui components
    survey/              # Survey-related components
    sync/                # Sync status components
    common/              # Shared components
  contexts/              # React Contexts (Auth, Sync)
  lib/
    api/                 # API client and services
    db/                  # Dexie.js database
    sync/                # Sync engine
    services/            # Business logic
    hooks/               # Custom React hooks
    store/               # Zustand stores
    types/               # TypeScript types
  workers/               # Service Workers
public/
  manifest.json          # PWA manifest
  offline.html           # Offline fallback page
  icons/                 # PWA icons
```

## Critical Rules

1. **Offline-first approach.** All data operations must work offline. Sync happens when online.
2. **IndexedDB is the source of truth.** Use Dexie.js for all local data storage.
3. **JWT tokens in storage.** Access token in localStorage, refresh token in sessionStorage.
4. **Service Worker for caching.** Use Workbox strategies appropriately (NetworkFirst for API, CacheFirst for assets).
5. **Form validation with Zod.** All forms must validate with Zod schemas before submission.

## Offline Strategy

### Database (Dexie.js)

```typescript
import { db } from '@/lib/db/database';

// Read data
const surveys = await db.surveys.toArray();

// Write data with sync queue
await db.transaction('rw', db.responses, db.sync_queue, async () => {
  await db.responses.add(response);
  await db.sync_queue.add({ operation: 'CREATE_RESPONSE', ... });
});
```

### Sync Engine

- Queue operations in `sync_queue` table
- Process queue when online
- Exponential backoff for retries
- Dead letter queue for permanent failures

### Service Worker

- Precache app shell
- NetworkFirst for API calls
- CacheFirst for static assets
- Background sync for POST requests

## API Integration

### Authentication

```typescript
import { login, logout } from '@/lib/api/auth.service';

// Login
await login(username, password);

// Logout
await logout();
```

### Survey Operations

```typescript
import { getMyAssignments, submitResponse } from '@/lib/api/survey.service';

// Get assignments
const assignments = await getMyAssignments();

// Submit response
await submitResponse(responseData);
```

## Conventions

- **File naming:** kebab-case for files, PascalCase for components
- **Component structure:** One component per file, max 200 lines
- **Type safety:** Strict TypeScript, no `any` types
- **Error handling:** Try-catch with toast notifications
- **Loading states:** Skeleton loaders for async content

## Key Documentation

| Topic | File |
|-------|------|
| API types | `src/lib/types/index.ts` |
| Database schema | `src/lib/db/database.ts` |
| Auth context | `src/contexts/auth.context.tsx` |
| Sync context | `src/contexts/sync.context.tsx` |
| API client | `src/lib/api/client.ts` |

## Workflow Requirements

- Every code change must update relevant documentation
- Run `npm run type-check` before committing
- Run `npm run lint` before committing
- Test offline functionality before deploying

## Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Type checking
npm run type-check

# Linting
npm run lint
```

## Deployment

### Vercel (Recommended)

```bash
vercel --prod
```

### Docker

```bash
docker build -t brigada-pwa .
docker run -p 3000:3000 brigada-pwa
```

## Security

- HTTPS required for Service Workers
- JWT tokens with expiration
- Content Security Policy headers
- Input validation with Zod
- XSS protection (React default)

## Performance

- Code splitting with Next.js
- Image optimization with next/image
- Lazy loading for components
- Service Worker caching
- IndexedDB for offline data

## Accessibility

- Semantic HTML
- ARIA labels
- Keyboard navigation
- Focus management
- Color contrast (WCAG 2.1 AA)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## PWA Installation

Users can install the PWA:
1. Visit the site in a supported browser
2. Click "Install" or "Add to Home Screen"
3. App appears as native application

## Offline Capabilities

- View cached surveys
- Fill surveys offline
- Save responses locally
- Sync when online
- View sync status

## Future Enhancements

- [ ] Push notifications
- [ ] Background sync improvements
- [ ] Conflict resolution UI
- [ ] Signature capture
- [ ] Advanced offline maps
- [ ] Multi-language support
