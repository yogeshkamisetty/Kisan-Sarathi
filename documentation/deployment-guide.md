# Deployment, Infrastructure & Operations Guide
**System:** KisanSaathi — *Fasal Awaaz*

---

## 1. Local & Pilot Deployment via Docker Compose

### Prerequisites
- Docker Engine 24+ and Docker Compose v2+
- Node.js 18+ and npm 9+
- Android Studio / Expo Go / Android device (for mobile client)

### Quick Start Commands
```bash
# 1. Copy environment template and configure secrets
cp .env.example .env

# 2. Start PostgreSQL 16, Redis 7, MinIO S3 Storage, and Fasal Awaaz API
docker compose up -d --build

# 3. Run Prisma database migrations and seed verified policies & synthetic demo data
npm run db:migrate --workspace=apps/api
npm run db:seed --workspace=apps/api

# 4. Verify API & Voice Provider Health
curl -s http://localhost:3000/api/v1/health | jq .
curl -s http://localhost:3000/api/v1/voice/providers/health | jq .

# 5. Run Automated Unit & Integration Test Suite
npm test
```

---

## 2. Database Backup & Restore Procedures

### Automated PostgreSQL Backup (`infrastructure/scripts/backup-db.sh`)
```bash
./infrastructure/scripts/backup-db.sh ./backups
```
Creates a timestamped, compressed `pg_dump` custom-format archive (`fasal_awaaz_YYYYMMDD_HHMMSS.dump`) with SHA-256 checksum verification.

### Restore Procedure (`infrastructure/scripts/restore-db.sh`)
```bash
./infrastructure/scripts/restore-db.sh ./backups/fasal_awaaz_20261104_060000.dump
```

---

## 3. Production Security Checklist
1. Set `NODE_ENV=production` and `ENABLE_DEV_MOCK_OTP=false` (enforces startup validation failure if real OTP or database credentials are missing).
2. Provision TLS 1.3 termination via reverse proxy / cloud load balancer.
3. Store `GNANI_API_KEY`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `DATABASE_URL` in AWS Secrets Manager / GCP Secret Manager / HashiCorp Vault.
4. Never seed synthetic demonstration accounts in production (`SEED_DEMO_DATA=false`).
