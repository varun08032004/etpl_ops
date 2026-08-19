# EtherTrack Internal Ops - Runbook

## Overview
This runbook covers deployment, rollback, incident response, and operational procedures for the EtherTrack Internal Ops ERP system.

---

## Architecture Summary

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Client    │────▶│   Nginx     │────▶│  Backend API    │
│  (React)    │     │  (Reverse   │     │  (Node.js/Express)│
│  Port 3001  │     │   Proxy)    │     │   Port 5001     │
└─────────────┘     └─────────────┘     └────────┬────────┘
                                                 │
                    ┌────────────────────────────┼────────────────────────────┐
                    │                            │                            │
              ┌─────▼─────┐               ┌──────▼──────┐              ┌─────▼─────┐
              │ PostgreSQL│               │   Redis     │              │  Ollama   │
              │ (Supabase)│               │  (Sessions) │              │  (AI/LLM) │
              └───────────┘               └─────────────┘              └───────────┘
```

---

## Deployment Procedures

### Prerequisites
- Docker 24+ and Docker Compose 2+
- Node.js 20+ (for local builds)
- Access to Supabase PostgreSQL
- Access to Ollama instance (for AI features)
- Render account (production deployment)

### Environment Variables (Required)
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# JWT
JWT_SECRET=<64-char-base64>
JWT_REFRESH_SECRET=<64-char-base64>
INTERNAL_OPS_REFRESH_SECRET=<64-char-base64>

# Encryption
ENCRYPTION_KEY=<32-byte-base64>  # For PII encryption
KEY_VERSION=1

# AI
OLLAMA_HOST=http://ollama:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_CHAT_MODEL=llama3.1

# Frontend
VITE_API_URL=https://api.ethertrack.in
```

### Local Development
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Run migrations
docker-compose exec backend npm run migrate

# Run tests
docker-compose exec backend npm test
```

### Production Deployment (Render)

#### Backend Service
1. Connect GitHub repo to Render
2. Create Web Service from `backend/` directory
3. Build Command: `npm ci && npm run build`
4. Start Command: `npm start`
5. Add all environment variables from above
6. Set health check path: `/health`

#### Frontend Service
1. Create Static Site from `frontend/` directory
2. Build Command: `npm ci && npm run build`
3. Publish Directory: `dist`
4. Add `VITE_API_URL` environment variable
5. Configure rewrite rules for SPA routing

#### Cron Jobs (Render)
- Secret rotation: `0 3 * * 0` (weekly) → runs `npm run rotate-secrets`

### Manual Deployment (Docker)
```bash
# Build images
docker build -t ethertrack/backend:latest ./backend
docker build -t ethertrack/frontend:latest ./frontend

# Push to registry
docker push ethertrack/backend:latest
docker push ethertrack/frontend:latest

# Deploy to server
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

---

## Rollback Procedures

### Render (Automatic)
1. Go to Render Dashboard → Service → Deploys
2. Click "Rollback" on previous successful deploy
3. Verify health checks pass

### Docker (Manual)
```bash
# List images
docker images ethertrack/backend

# Tag previous version
docker tag ethertrack/backend:<prev-sha> ethertrack/backend:rollback

# Deploy rollback
docker-compose -f docker-compose.prod.yml up -d --force-recreate backend

# Verify
curl https://api.ethertrack.in/health
```

### Database Rollback
```bash
# Supabase: Use Point-in-Time Recovery (PITR)
# Go to Supabase Dashboard → Database → Backups → Restore

# Or run down migration manually
docker-compose exec backend npm run migrate:down
```

---

## Incident Response

### Severity Levels
| Level | Description | Response Time | Escalation |
|-------|-------------|---------------|------------|
| SEV-1 | Complete outage, data loss | 15 min | Page on-call, notify leadership |
| SEV-2 | Major feature down, degraded performance | 1 hour | Notify team lead |
| SEV-3 | Minor issue, workaround exists | 4 hours | Create ticket |
| SEV-4 | Cosmetic, non-urgent | Next sprint | Backlog |

### Common Incidents & Responses

#### 1. API Returns 5xx Errors
```bash
# Check backend logs
docker-compose logs -f backend --tail=100

# Check database connectivity
docker-compose exec backend npm run db:check

# Check memory/CPU
docker stats
```

**Resolution:**
- Restart backend: `docker-compose restart backend`
- Check for migration locks: `SELECT * FROM pg_locks WHERE NOT granted;`
- Scale up if resource exhausted

#### 2. Database Connection Pool Exhausted
```bash
# Check active connections
docker-compose exec backend node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT count(*) FROM pg_stat_activity').then(r => console.log(r.rows));
"
```

**Resolution:**
- Increase pool size in `config/database.js`
- Kill idle connections: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < NOW() - INTERVAL '5 minutes';`
- Restart backend

#### 3. Authentication Failures (401/403)
```bash
# Check JWT secrets match
docker-compose exec backend node -e "console.log(process.env.JWT_SECRET?.slice(0,10))"

# Verify token
docker-compose exec backend node -e "
const jwt = require('jsonwebtoken');
console.log(jwt.verify('<token>', process.env.JWT_SECRET));
"
```

**Resolution:**
- Rotate secrets if compromised: `npm run rotate-secrets`
- Clear Redis sessions: `docker-compose exec redis redis-cli FLUSHDB`
- Check clock sync on servers

#### 4. AI/Ollama Unavailable
```bash
# Check Ollama health
curl http://ollama:11434/api/tags

# Check models
curl http://ollama:11434/api/show -d '{"name":"llama3.1"}'
```

**Resolution:**
- Pull missing models: `docker-compose exec ollama ollama pull llama3.1`
- Restart Ollama: `docker-compose restart ollama`
- Check GPU memory: `nvidia-smi`

#### 5. Rate Limiting Too Aggressive
```bash
# Check current rate limit config
grep -A 10 "rateLimit" backend/server.js
```

**Resolution:**
- Adjust `max` and `windowMs` in server.js
- Add IP allowlist for internal services
- Deploy config change

---

## Monitoring & Alerting

### Health Checks
- **Liveness**: `GET /health` → 200 OK
- **Readiness**: `GET /ready` → 200 OK + DB/Redis connectivity

### Key Metrics to Monitor
| Metric | Warning | Critical |
|--------|---------|----------|
| API latency (p95) | > 500ms | > 2s |
| Error rate | > 1% | > 5% |
| DB connections | > 80% pool | > 95% pool |
| Memory usage | > 70% | > 90% |
| CPU usage | > 70% | > 90% |
| Rate limit hits | > 100/min | > 500/min |

### Log Locations
- **Backend**: `docker-compose logs backend` or `/var/log/ethertrack/backend.log`
- **Nginx**: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- **Database**: Supabase Dashboard → Logs
- **AI**: `docker-compose logs ollama`

---

## Security Procedures

### Secret Rotation (Weekly)
```bash
# Automated via cron
npm run rotate-secrets

# Manual
node scripts/rotate-secret.js --secret=JWT_SECRET --generate
node scripts/rotate-secret.js --secret=ENCRYPTION_KEY --generate
```

### Incident: Suspected Secret Compromise
1. Immediately rotate all secrets: `npm run rotate-secrets --all`
2. Invalidate all sessions: `redis-cli FLUSHDB`
3. Force re-login for all users
4. Audit access logs for suspicious activity
5. Notify security team

### Certificate Renewal
- Render manages TLS automatically
- For custom domains: Check Let's Encrypt renewal in Render dashboard

---

## Backup & Recovery

### Database (Supabase)
- **Automatic**: Daily PITR backups (7-day retention)
- **Manual**: `pg_dump` via Supabase CLI
- **RPO**: 5 minutes (WAL archiving)
- **RTO**: < 30 minutes

### Redis
- **Persistence**: AOF every 1 second
- **Backup**: `redis-cli BGSAVE` daily cron

### Application Code
- GitHub (primary)
- Docker images in registry (versioned)

---

## Contact Information

| Role | Name | Contact |
|------|------|---------|
| On-Call Engineer | Rotation | PagerDuty / Slack #oncall |
| Tech Lead | - | - |
| Security Team | - | security@ethertrack.in |
| Infrastructure | - | infra@ethertrack.in |
| Supabase Support | - | Dashboard → Support |
| Render Support | - | Dashboard → Support |

---

## Runbook Maintenance
- **Review**: Monthly
- **Update**: After each incident, deployment change, or architecture change
- **Owner**: Platform Team
- **Location**: This document in Git (runbook.md)