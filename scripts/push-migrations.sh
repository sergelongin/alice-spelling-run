#!/bin/bash
# Push Supabase migrations to dev or prod environment
# Usage: ./scripts/push-migrations.sh [dev|prod]

set -e

# Load environment variables
if [ -f .env.development ]; then
  source .env.development
else
  echo "Error: .env.development not found"
  echo "Copy .env.development from template and fill in credentials"
  exit 1
fi

ENV=${1:-dev}

case "$ENV" in
  dev)
    echo "Pushing migrations to DEV environment..."
    if [ -z "$DEV_PROJECT_REF" ] || [ "$DEV_PROJECT_REF" = "your-dev-project-ref" ]; then
      echo "Error: DEV_PROJECT_REF not configured in .env.development"
      exit 1
    fi
    DEV_DB_URL="postgresql://postgres.${DEV_PROJECT_REF}:${DEV_DB_PASSWORD}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
    supabase db push --db-url "$DEV_DB_URL"
    echo "Done! Migrations applied to dev."
    ;;
  prod)
    echo ""
    echo "=========================================="
    echo "  WARNING: PRODUCTION DATABASE"
    echo "=========================================="
    echo ""
    read -p "Push migrations to PRODUCTION? This cannot be undone. (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "Aborted."
      exit 1
    fi
    PROD_DB_URL="postgresql://postgres.${PROD_PROJECT_REF}:${PROD_DB_PASSWORD}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
    supabase db push --db-url "$PROD_DB_URL"
    echo "Done! Migrations applied to production."
    ;;
  *)
    echo "Usage: $0 [dev|prod]"
    echo "  dev  - Push to development Supabase project (default)"
    echo "  prod - Push to production Supabase project (requires confirmation)"
    exit 1
    ;;
esac
