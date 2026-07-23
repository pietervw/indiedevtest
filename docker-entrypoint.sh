#!/bin/sh
set -e
mkdir -p /app/data
chown -R nextjs:nodejs /app/data

# Fail closed if Cloudflare R2 env is incomplete (Coolify / production).
if [ ! -f /app/scripts/check-storage-env.mjs ]; then
  echo "[entrypoint] missing /app/scripts/check-storage-env.mjs" >&2
  exit 1
fi
node /app/scripts/check-storage-env.mjs

exec su-exec nextjs node server.js
