# Security Architecture

## Authentication

### JWT-Based Authentication

The API Gateway validates JWT tokens for every authenticated request.

```http
Authorization: Bearer <jwt_token>
```

### Token Structure

```json
{
  "sub": "user-uuid",
  "roles": ["USER"],
  "iat": 1712345678,
  "exp": 1712432078
}
```

### Refresh Token Flow

1. Client authenticates with credentials
2. Server returns access token (15 min) + refresh token (7 days)
3. Client uses access token for API calls
4. On 401, client uses refresh token to get new access token
5. Refresh tokens are rotated on each use

## Role-Based Access Control (RBAC)

### Roles

| Role | Permissions |
|------|-------------|
| `USER` | Create orders, view own orders, cancel own orders |
| `ADMIN` | All operations, system configuration, audit access |
| `WAREHOUSE` | View inventory, manage stock levels |

### Endpoint Authorization

| Endpoint | Method | Roles |
|----------|--------|-------|
| `/api/orders` | POST | USER, ADMIN |
| `/api/orders` | GET | USER (own), ADMIN (all) |
| `/api/orders/:id` | GET | USER (own), ADMIN |
| `/api/orders/:id/cancel` | POST | USER (own), ADMIN |
| `/api/inventory/*` | GET | USER, ADMIN, WAREHOUSE |
| `/api/analytics/*` | GET | ADMIN |
| `/api/audit/*` | GET | ADMIN |

## Security Headers

```typescript
app.use(helmet());
```

- Content-Security-Policy
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Strict-Transport-Security
- X-XSS-Protection

## Additional Security Measures

1. **Input Validation**: Zod schemas validate all request payloads
2. **Rate Limiting**: Redis-backed rate limiting (100 req/min per user)
3. **CORS**: Configured for known frontend origins only
4. **SQL Injection Prevention**: Parameterized queries throughout
5. **Secrets Management**: Kubernetes Secrets for sensitive data
6. **Data Encryption**: TLS for all inter-service communication
