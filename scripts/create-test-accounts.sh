#!/usr/bin/env bash
#
# Creates QA test accounts via the Supabase Admin API (no confirmation emails sent).
# Safe to re-run: deletes existing accounts first if they exist.
#
# Prerequisites:
#   - supabase CLI installed and linked to the project
#   - jq installed
#
# Usage:
#   ./scripts/create-test-accounts.sh

set -euo pipefail

# --- Determine environment ---
ENV="${1:-prod}"
case "$ENV" in
  dev)
    PROJECT_REF="kphvkkoyungqebftytkt"
    ;;
  prod)
    PROJECT_REF="gibingvfmrmelpchlwzn"
    ;;
  *)
    echo "Usage: $0 [dev|prod]"
    echo "  dev  - Create accounts in development project"
    echo "  prod - Create accounts in production project (default)"
    exit 1
    ;;
esac

SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
echo "Target: $ENV ($PROJECT_REF)"

# --- Retrieve service_role key ---
echo "Retrieving service_role key..."
SERVICE_ROLE_KEY=$(supabase projects api-keys --project-ref "$PROJECT_REF" \
  | grep service_role \
  | awk '{print $NF}')

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "ERROR: Could not retrieve service_role key. Are you logged in to supabase CLI?"
  exit 1
fi

# --- Account definitions ---
declare -a EMAILS=("claude-qa-test@testmail.dev" "claude-qa-returning@testmail.dev")
declare -a NAMES=("QA New Signup" "QA Returning User")
PASSWORD="TestSpelling2024x"

# --- Helper: delete user by email if exists ---
delete_if_exists() {
  local email="$1"
  echo "  Checking for existing user: $email"

  # List users filtered by email
  local user_id
  user_id=$(curl -s -X GET \
    "${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    | jq -r --arg email "$email" '.users[] | select(.email == $email) | .id // empty')

  if [ -n "$user_id" ]; then
    echo "  Deleting user $email (id: $user_id)..."
    curl -s -X DELETE \
      "${SUPABASE_URL}/auth/v1/admin/users/${user_id}" \
      -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
      -H "apikey: ${SERVICE_ROLE_KEY}" \
      > /dev/null
    echo "  Deleted."
  else
    echo "  Not found, skipping delete."
  fi
}

# --- Helper: create user via admin API ---
create_user() {
  local email="$1"
  local display_name="$2"
  echo "  Creating user: $email"

  local response
  response=$(curl -s -X POST \
    "${SUPABASE_URL}/auth/v1/admin/users" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"${email}\",
      \"password\": \"${PASSWORD}\",
      \"email_confirm\": true,
      \"user_metadata\": {\"display_name\": \"${display_name}\"}
    }")

  local new_id
  new_id=$(echo "$response" | jq -r '.id // empty')
  if [ -n "$new_id" ]; then
    echo "  Created with id: $new_id"
  else
    echo "  ERROR creating user:"
    echo "$response" | jq .
    exit 1
  fi
}

# --- Main ---
echo ""
echo "=== Deleting existing test accounts ==="
for email in "${EMAILS[@]}"; do
  delete_if_exists "$email"
done

echo ""
echo "=== Creating test accounts via admin API (no emails sent) ==="
for i in "${!EMAILS[@]}"; do
  create_user "${EMAILS[$i]}" "${NAMES[$i]}"
done

echo ""
echo "=== Verifying login ==="
for email in "${EMAILS[@]}"; do
  echo "  Testing login for $email..."
  token_response=$(curl -s -X POST \
    "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"${email}\", \"password\": \"${PASSWORD}\"}")

  access_token=$(echo "$token_response" | jq -r '.access_token // empty')
  if [ -n "$access_token" ]; then
    echo "  Login successful."
  else
    echo "  ERROR: Login failed for $email"
    echo "$token_response" | jq .
    exit 1
  fi
done

echo ""
echo "Done. Both test accounts created and verified."
