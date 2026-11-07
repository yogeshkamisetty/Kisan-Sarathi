FROM node:20-alpine AS base
WORKDIR /app

RUN addgroup -S fasal && adduser -S fasal -G fasal

COPY package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY demo ./demo

RUN mkdir -p /app/.data
RUN chown -R fasal:fasal /app
USER fasal

VOLUME ["/app/.data"]

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

CMD ["node", "apps/api/src/main.js"]
