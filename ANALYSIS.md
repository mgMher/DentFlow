# DentFlow - TherapyLake Architecture Analysis

## Patterns Copied from TherapyLake

### Backend Architecture
1. **NestJS Module Organization** - Same pattern of feature modules with module/controller/service/schema/dto structure. TherapyLake has 58+ modules, DentFlow replicates this clean separation.
2. **Global Guards Pattern** - APP_GUARD registration for AuthGuard + RolesGuard, same as TherapyLake's AuthNGuard pattern.
3. **DTO Validation** - class-validator + class-transformer with global ValidationPipe, mirroring TherapyLake's approach.
4. **JWT Authentication** - Same Bearer token pattern with access/refresh token pair, though simplified (no multi-tenant JWT complexity).
5. **Global API Prefix** - `/api` prefix matching TherapyLake.
6. **Helmet Security** - Security headers middleware from TherapyLake's main.ts.
7. **Swagger Documentation** - Conditional Swagger setup (non-production only).

### Frontend Architecture
1. **Redux + Redux-Saga** - Same 5-file pattern per slice (types, actions, reducer, saga, service) as TherapyLake's store organization.
2. **HTTP State Tracking** - Loading/error/success arrays pattern from TherapyLake's `http_requests_on_load/errors/success` stores.
3. **Axios Interceptors** - Same pattern: request interceptor for token injection, response interceptor for 401 → refresh token flow.
4. **React Router v6** - Same routing pattern with protected routes.
5. **MUI Component Library** - Same MUI v6 usage for UI components.
6. **Toast Notifications** - react-toastify with same configuration pattern.
7. **Collapsible Sidebar** - Navigation pattern similar to TherapyLake's menuBar structure.

## Patterns Improved Over TherapyLake

### Backend Improvements

1. **TypeScript Strictness**
   - TherapyLake: `noImplicitAny: false`, loose typing in many places
   - DentFlow: Proper TypeScript types throughout, DTOs fully typed
   - Why: Type safety prevents runtime errors, especially important for medical data

2. **NestJS MongooseModule Integration**
   - TherapyLake: Raw `model()` factory calls, custom TenantModelService (due to multi-tenant complexity)
   - DentFlow: Standard `@InjectModel()` with `MongooseModule.forFeature()` — the NestJS-native approach
   - Why: TherapyLake's raw model pattern was necessitated by multi-tenant `.useDb()`. DentFlow's single-DB approach allows idiomatic NestJS/Mongoose integration

3. **Simpler Multi-tenancy**
   - TherapyLake: Per-org databases, AsyncLocalStorage context, connection pooling, complex OrgMiddleware
   - DentFlow: Single database with `clinicId` field on every document, injected from JWT
   - Why: Dramatically simpler — no connection management overhead, no context threading, standard query patterns

4. **Security: Session Secret**
   - TherapyLake: `secret: 'my-secret'` hardcoded in main.ts (line 48)
   - DentFlow: No express-session (uses stateless JWT only). If sessions were needed, secret would come from env.
   - Why: Hardcoded session secrets are a security vulnerability

5. **Security: CORS Configuration**
   - TherapyLake: `app.enableCors()` with no origin restriction (accepts any origin)
   - DentFlow: `app.enableCors({ origin: process.env.CLIENT_URL, credentials: true })` — origin-restricted
   - Why: Unrestricted CORS is a security risk in production

6. **Validation Pipe Config**
   - TherapyLake: `new ValidationPipe({ transform: true })`
   - DentFlow: `new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })`
   - Why: `whitelist` strips unexpected properties, `forbidNonWhitelisted` rejects them — prevents mass assignment attacks

7. **Error Handling**
   - TherapyLake: No visible global exception filter
   - DentFlow: GlobalExceptionFilter that normalizes all errors to `{ statusCode, message, timestamp }`
   - Why: Consistent error responses, prevents stack trace leakage in production

8. **Response Transformation**
   - TherapyLake: Raw response objects
   - DentFlow: TransformInterceptor wrapping all responses in `{ statusCode, message, data }`
   - Why: Consistent API response shape makes frontend development predictable

### Frontend Improvements

1. **TypeScript Instead of JavaScript**
   - TherapyLake: Plain JavaScript (.js files) throughout frontend
   - DentFlow: Full TypeScript (.tsx files) with typed props, state, and API responses
   - Why: Type safety, better IDE support, catches errors at compile time

2. **i18n from Day One**
   - TherapyLake: No i18n — all strings hardcoded in English
   - DentFlow: react-i18next with 3 languages (Armenian default, Russian, English)
   - Why: Armenian-market product needs native language support. Retrofitting i18n is painful

3. **Dark Mode Support**
   - TherapyLake: Light mode only
   - DentFlow: Dark mode with theme toggle, persisted to localStorage
   - Why: Modern UX expectation, reduces eye strain in clinical environments

4. **react-hook-form Instead of Uncontrolled Forms**
   - TherapyLake: Mix of controlled inputs and manual state management
   - DentFlow: react-hook-form for all forms — better performance, built-in validation
   - Why: Cleaner form code, better performance (fewer re-renders), declarative validation

5. **Component Architecture**
   - TherapyLake: Large monolithic page components
   - DentFlow: Smaller, reusable UI components (StatCard, PageHeader, StatusChip, EmptyState, ConfirmDialog)
   - Why: Better reusability, easier testing, cleaner page components

## Security Issues Found in TherapyLake

1. **Hardcoded Session Secret** (`api/src/main.ts:48`)
   - `secret: 'my-secret'` — should be `process.env.SESSION_SECRET`
   - Risk: Session hijacking if secret is known

2. **Unrestricted CORS** (`api/src/main.ts:56`)
   - `app.enableCors()` with no options — accepts requests from any origin
   - Risk: Cross-origin attacks, credential theft

3. **Missing Whitelist on ValidationPipe** (`api/src/main.ts:60`)
   - No `whitelist: true` — allows unexpected properties through DTOs
   - Risk: Mass assignment vulnerabilities

4. **localStorage for Permissions** (`client/src/store/auth/auth.saga.js:28`)
   - `localStorage.setItem('permissions', JSON.stringify(res.data?.permissions))`
   - Risk: Client-side permission data can be tampered with. Permissions should be verified server-side only

5. **Empty Catch Blocks** (multiple files)
   - Several `catch (error) {}` blocks that silently swallow errors
   - Risk: Failures go undetected, debugging becomes difficult

6. **Commented-out Error Handling** (`client/src/App.js:92-97`)
   - Error toast display logic is commented out entirely
   - Impact: Users don't see API error messages

## Additional Notes

- TherapyLake's multi-tenant migration (per-org DBs → single container with AsyncLocalStorage) is architecturally impressive but adds significant complexity. DentFlow's single-DB clinicId approach achieves tenant isolation with much less code.
- TherapyLake uses `moment.js` (deprecated) alongside `date-fns` and `dayjs` — three date libraries. DentFlow standardizes on `date-fns` only.
- TherapyLake's frontend uses React 19 but the CLAUDE.md documentation says React 17.0.2 — documentation drift.
- TherapyLake uses `chart.js`, `echarts`, AND `apexcharts` — three charting libraries. DentFlow uses `chart.js` + `react-chartjs-2` only.
