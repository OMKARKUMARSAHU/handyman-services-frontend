#!/bin/bash
# PHASE 16 ("broken thumbnails", round 2) -- there was previously NO
# mechanism at all for getting a knex migration applied to the real
# production RDS database: the local dev machine's network egress has no
# raw-TCP path to the RDS endpoint (DNS for it doesn't even resolve from
# there), and `aws`/`eb` CLIs are not installed locally either, so every
# past "migration" only ever ran against the local dev MySQL instance.
# This is very likely why 20260101000016_backfill_media_urls_to_proxy_route
# was written but never actually took effect on production (its target
# columns on production still held the *original* pre-migration values).
#
# This EB platform hook runs on every deploy, as root, AFTER the new app
# version is extracted to its final location and dependencies installed,
# but before the app is confirmed healthy -- exactly where "ship schema/
# data migrations with the code that needs them" belongs. It runs from
# inside the EB instance itself, which is the one place that already has
# a working, security-group-permitted path to RDS (the app itself proves
# that every time it starts), and it sources EB's own exported app
# environment variables so it gets the exact same DB_HOST/DB_USER/
# DB_PASSWORD/DB_NAME/NODE_ENV the running app uses -- nothing hardcoded,
# nothing logged.
#
# knex's own `knex_migrations` tracking table makes this safe to run on
# every single deploy: already-applied migrations are skipped automatically,
# so this never re-runs 20260101000001..20260101000017 -- it only ever
# applies whatever is new.
set -euo pipefail

if [ -f /opt/elasticbeanstalk/deployment/env ]; then
  set -a
  # shellcheck disable=SC1091
  source /opt/elasticbeanstalk/deployment/env
  set +a
fi

APP_DIR="/var/app/current"
if [ ! -d "$APP_DIR" ]; then
  echo "[migrate-hook] $APP_DIR does not exist yet -- skipping (nothing to migrate against)."
  exit 0
fi

cd "$APP_DIR"
echo "[migrate-hook] Running knex migrate:latest against $DB_HOST/$DB_NAME ..."
/usr/bin/env node_modules/.bin/knex --knexfile dist/database/knexfile.js migrate:latest
echo "[migrate-hook] Migrations complete."
