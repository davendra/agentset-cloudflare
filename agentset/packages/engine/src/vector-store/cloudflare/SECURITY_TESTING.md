# Security Testing for Cloudflare Integration

This document outlines the security testing approach for the Cloudflare AI Search integration in the AgentSet platform.

## Table of Contents

1. [Authentication Testing](#authentication-testing)
2. [Authorization Testing](#authorization-testing)
3. [Input Validation Testing](#input-validation-testing)
4. [Data Integrity Testing](#data-integrity-testing)
5. [Error Handling Testing](#error-handling-testing)
6. [Multi-tenant Isolation Testing](#multi-tenant-isolation-testing)
7. [API Security Testing](#api-security-testing)

## Authentication Testing

### Overview
All Cloudflare integration endpoints use tRPC's `protectedProcedure` middleware to enforce authentication.

### Test Cases

#### TC-AUTH-001: Unauthenticated Request Rejection
**Location**: `/apps/web/src/server/api/trpc.ts:164-175`

**Objective**: Verify that requests without a valid session are rejected.

**Implementation Pattern**:
```typescript
// protectedProcedure middleware
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      session: ctx.session as NonNullable<typeof ctx.session>,
    },
  });
});
```

**Test Strategy**:
- Send request without session token
- Verify response status is UNAUTHORIZED
- Verify appropriate error message is returned
- Verify no data leakage in error response

#### TC-AUTH-002: Session Validation
**Objective**: Verify that expired or invalid sessions are rejected.

**Test Strategy**:
- Use expired session token
- Use malformed session token
- Use session token for deleted user
- Verify all cases return UNAUTHORIZED

## Authorization Testing

### Overview
After authentication, the `getNamespaceByUser` function ensures users can only access namespaces they belong to.

### Test Cases

#### TC-AUTHZ-001: Namespace Access Control
**Location**: `/apps/web/src/server/api/auth.ts:5-25`

**Objective**: Verify users can only access namespaces within their organization.

**Implementation Pattern**:
```typescript
export const getNamespaceByUser = cache(
  async (ctx: ProtectedProcedureContext, idOrSlug) => {
    return await ctx.db.namespace.findFirst({
      where: {
        ...("id" in idOrSlug ? { id: idOrSlug.id } : { slug: idOrSlug.slug }),
        organization: {
          members: { some: { userId: ctx.session.user.id } },
        },
      },
    });
  },
);
```

**Test Strategy**:
- **Valid Access**: User requests namespace they belong to → Success
- **Invalid Access**: User requests namespace they don't belong to → NOT_FOUND
- **Cross-Organization Access**: User tries to access another org's namespace → NOT_FOUND
- **Deleted Namespace**: User requests deleted namespace → NOT_FOUND

**Security Properties**:
- Authorization check happens on every request (no caching of permissions)
- Uses database-level constraints (organization.members)
- Returns NOT_FOUND instead of FORBIDDEN to prevent information leakage

#### TC-AUTHZ-002: Settings Update Authorization
**Location**: `/apps/web/src/server/api/routers/cloudflare.ts:41-97`

**Objective**: Verify users can only update settings for namespaces they have access to.

**Test Strategy**:
- User updates own namespace settings → Success
- User updates another org's namespace settings → NOT_FOUND
- User with read-only role attempts update → Verify role enforcement

#### TC-AUTHZ-003: Metrics Access Control
**Location**: `/apps/web/src/server/api/routers/cloudflare.ts:102-135`

**Objective**: Verify metrics queries are properly scoped to authorized namespaces.

**Test Strategy**:
- Query metrics for owned namespace → Success
- Query metrics for non-owned namespace → NOT_FOUND
- Query metrics with tenant/workspace filtering → Verify proper scoping

## Input Validation Testing

### Overview
All tRPC procedures use Zod schemas for comprehensive input validation.

### Test Cases

#### TC-INPUT-001: Required Field Validation
**Location**: `/apps/web/src/server/api/routers/cloudflare.ts`

**Test Strategy**:
```typescript
// Input schema examples
z.object({
  namespaceId: z.string(),          // Required
  endpoint: z.url(),                 // Required, must be valid URL
  apiKey: z.string().optional(),     // Optional
})
```

**Tests**:
- Missing required field → Validation error with field name
- Empty string for required field → Validation error
- Invalid URL format → Validation error with URL specifics

#### TC-INPUT-002: Enum Constraint Validation
**Location**: `/apps/web/src/server/api/routers/cloudflare.ts:46-54`

**Test Strategy**:
```typescript
cfModelRoute: z.enum(["final-answer", "fast-lane", "cheap"]).nullable().optional()
cfSafetyLevel: z.enum(["off", "standard", "strict"]).nullable().optional()
cfCacheMode: z.enum(["public", "private"]).nullable().optional()
```

**Tests**:
- Valid enum value → Accepted
- Invalid enum value → Validation error listing valid options
- Case-sensitive validation → "Public" vs "public"
- SQL injection attempt via enum field → Rejected by Zod

#### TC-INPUT-003: Numeric Constraint Validation
**Location**: `/apps/web/src/server/api/routers/cloudflare.ts:55,110`

**Test Strategy**:
```typescript
cfBudgetLimit: z.number().positive().nullable().optional()
limit: z.number().min(1).max(1000).default(100)
```

**Tests**:
- Negative number → Validation error
- Zero for .positive() → Validation error
- Exceeds max → Validation error
- Non-numeric string → Type validation error
- NaN, Infinity → Validation error

#### TC-INPUT-004: JSONB Field Validation
**Location**: `/apps/web/src/server/api/routers/cloudflare.ts:56`

**Test Strategy**:
```typescript
cfSettings: z.record(z.string(), z.unknown()).nullable().optional()
```

**Tests**:
- Valid JSON object → Accepted
- Deeply nested object → Verify depth limits
- Large payload → Verify size limits
- XSS attempt in JSON values → Sanitization check
- Prototype pollution attempt → Verify rejection

#### TC-INPUT-005: Date Range Validation
**Location**: `/apps/web/src/server/api/routers/cloudflare.ts:106-107`

**Test Strategy**:
```typescript
startDate: z.date().optional()
endDate: z.date().optional()
```

**Tests**:
- Valid date range → Accepted
- endDate before startDate → Should be validated in business logic
- Future dates → Accepted (valid use case)
- Invalid date format → Validation error

## Data Integrity Testing

### Test Cases

#### TC-DATA-001: SQL Injection Prevention
**Objective**: Verify Prisma ORM prevents SQL injection attacks.

**Test Strategy**:
- Input with SQL injection patterns in:
  - `namespaceId`: `"'; DROP TABLE namespace; --"`
  - `query`: `"test' OR '1'='1"`
  - `filter` parameters
- Verify all inputs are parameterized by Prisma
- No raw SQL queries should be used
- Verify queries execute safely and return no unauthorized data

**Security Properties**:
- All database queries use Prisma ORM
- Prisma automatically parameterizes all queries
- No string concatenation for query building

#### TC-DATA-002: JSONB Field Sanitization
**Location**: `/apps/web/src/server/api/routers/cloudflare.ts:34,48,80,95`

**Test Strategy**:
```typescript
// JSONB fields are cast to Record<string, unknown>
cfSettings: namespace.cfSettings as Record<string, unknown> | null
```

**Tests**:
- Store malicious JavaScript in JSONB → Verify sanitization on read
- Store HTML/XSS payloads → Verify no script execution on client
- Verify proper escaping when rendering in UI

## Error Handling Testing

### Test Cases

#### TC-ERROR-001: Error Information Leakage
**Location**: `/apps/web/src/server/api/trpc.ts:50-60`

**Objective**: Verify errors don't leak sensitive information.

**Test Strategy**:
```typescript
errorFormatter({ shape, error }) {
  return {
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
    },
  };
}
```

**Tests**:
- Database error → Verify no SQL details leaked
- Authentication failure → Generic "UNAUTHORIZED" message
- Authorization failure → Returns NOT_FOUND (not FORBIDDEN)
- Validation error → Returns field-specific errors only
- Internal server error → No stack traces in production

#### TC-ERROR-002: Cloudflare API Error Handling
**Location**: `/apps/web/src/server/api/routers/cloudflare.ts:157-183`

**Objective**: Verify external API errors are handled securely.

**Test Strategy**:
```typescript
catch (error) {
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Failed to connect to Cloudflare Worker: ${error instanceof Error ? error.message : "Unknown error"}`,
  });
}
```

**Tests**:
- Cloudflare API timeout → Generic error message
- Invalid API key → Don't expose key in error
- Network error → No internal IPs/hostnames leaked
- Rate limiting → Appropriate error code

#### TC-ERROR-003: Fallback to Local RAG
**Location**: `/apps/web/src/server/api/routers/search.ts:93-107`

**Objective**: Verify graceful degradation doesn't expose errors.

**Test Strategy**:
- Cloudflare search fails → Automatically falls back to local RAG
- Error is logged but not exposed to client
- Metrics record error count
- Client receives results with no indication of failure mode

## Multi-tenant Isolation Testing

### Test Cases

#### TC-TENANT-001: Namespace Isolation
**Objective**: Verify namespaces are properly isolated.

**Test Strategy**:
- User A searches in namespace X → Only sees namespace X results
- User B searches in namespace X → Denied (not a member)
- User C searches in namespace Y → Only sees namespace Y results
- Verify filter cannot be manipulated to access other namespaces

#### TC-TENANT-002: Metrics Isolation
**Location**: `/apps/web/src/server/api/routers/cloudflare.ts:122-132`

**Objective**: Verify metrics queries respect namespace boundaries.

**Test Strategy**:
```typescript
const metrics = await ctx.db.cloudflareMetric.findMany({
  where: {
    namespaceId: input.namespaceId,
    ...(input.workspaceId && { workspaceId: input.workspaceId }),
    ...(input.tenantId && { tenantId: input.tenantId }),
  },
});
```

**Tests**:
- Query metrics for namespace A → Only namespace A metrics returned
- Manipulate tenantId in query → Still scoped to authorized namespace
- Aggregate queries → No cross-namespace data leakage

## API Security Testing

### Test Cases

#### TC-API-001: Rate Limiting
**Location**: `/apps/web/src/server/api/trpc.ts:86-116`

**Objective**: Verify rate limiting prevents abuse.

**Test Strategy**:
- Send rapid requests → Verify TOO_MANY_REQUESTS response
- Verify rate limits are per-user/per-namespace
- Verify rate limit headers in response

#### TC-API-002: CORS Configuration
**Objective**: Verify CORS headers prevent unauthorized origins.

**Test Strategy**:
- Request from authorized origin → Success
- Request from unauthorized origin → CORS error
- Verify credentials handling
- Verify preflight requests

#### TC-API-003: Request Size Limits
**Objective**: Verify large payloads are rejected.

**Test Strategy**:
- Send oversized query → Request rejected
- Send oversized JSONB settings → Request rejected
- Verify limits documented in API spec

## Testing Implementation Plan

### Phase 1: Core Security Tests
1. Authentication tests (TC-AUTH-001, TC-AUTH-002)
2. Authorization tests (TC-AUTHZ-001, TC-AUTHZ-002)
3. Basic input validation (TC-INPUT-001, TC-INPUT-002)

### Phase 2: Advanced Validation
1. Numeric and date validation (TC-INPUT-003, TC-INPUT-005)
2. JSONB validation (TC-INPUT-004)
3. SQL injection prevention (TC-DATA-001)

### Phase 3: Error Handling & Isolation
1. Error information leakage (TC-ERROR-001, TC-ERROR-002)
2. Multi-tenant isolation (TC-TENANT-001, TC-TENANT-002)
3. Fallback mechanisms (TC-ERROR-003)

### Phase 4: API Security
1. Rate limiting (TC-API-001)
2. CORS configuration (TC-API-002)
3. Request size limits (TC-API-003)

## Security Test Framework

### Recommended Tools
- **Vitest**: Unit and integration testing
- **Supertest**: HTTP endpoint testing
- **Prisma Mock**: Database mocking for isolation
- **tRPC Testing**: Built-in test utilities

### Test Structure
```typescript
// Example test structure
describe('Security: Authentication', () => {
  describe('TC-AUTH-001: Unauthenticated Request Rejection', () => {
    it('should reject requests without session', async () => {
      const caller = createCaller({ db, session: null, headers: new Headers() });

      await expect(caller.cloudflare.getSettings({ namespaceId: 'test' }))
        .rejects
        .toThrow('UNAUTHORIZED');
    });
  });
});
```

## Security Checklist

- [ ] All procedures use `protectedProcedure` for authenticated endpoints
- [ ] `getNamespaceByUser` called on all namespace-scoped operations
- [ ] All inputs validated with Zod schemas
- [ ] Enum values restricted to known safe values
- [ ] Numeric inputs have min/max constraints
- [ ] JSONB fields sanitized on read
- [ ] Errors don't leak sensitive information
- [ ] SQL injection prevented via Prisma ORM
- [ ] XSS prevented via input validation
- [ ] Multi-tenant isolation verified with tests
- [ ] Rate limiting implemented and tested
- [ ] CORS properly configured
- [ ] Request size limits enforced

## References

- **Authentication**: `/apps/web/src/server/api/trpc.ts`
- **Authorization**: `/apps/web/src/server/api/auth.ts`
- **Cloudflare Router**: `/apps/web/src/server/api/routers/cloudflare.ts`
- **Search Router**: `/apps/web/src/server/api/routers/search.ts`
- **Database Schema**: `/packages/db/src/schema/`
- **Cloudflare Tools**: `/packages/cloudflare-tools/src/`

## Security Contact

For security issues or questions about these tests, refer to `/agentset-cloudflare-app/SECURITY.md`.
