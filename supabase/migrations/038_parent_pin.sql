-- Migration: Add Parent PIN support with rate limiting
-- Stores bcrypt-hashed PINs for parent dashboard access

-- Enable pgcrypto extension for bcrypt (gen_salt, crypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add PIN columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pin_updated_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pin_failed_attempts INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ;

-- RPC: Set PIN (server-side bcrypt)
-- Returns the bcrypt hash so client can cache it for offline verification
CREATE OR REPLACE FUNCTION set_parent_pin(p_pin TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_hash TEXT;
BEGIN
  -- Validate PIN format
  IF NOT p_pin ~ '^\d{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be 4 digits');
  END IF;

  -- Generate bcrypt hash with cost factor 10
  v_hash := crypt(p_pin, gen_salt('bf', 10));

  -- Update profile with new PIN
  UPDATE profiles
  SET
    pin_hash = v_hash,
    pin_updated_at = NOW(),
    pin_failed_attempts = 0,
    pin_locked_until = NULL
  WHERE id = auth.uid();

  -- Return hash for client-side caching (offline verification)
  RETURN json_build_object('success', true, 'pin_hash', v_hash);
END; $$;

-- RPC: Verify PIN (server-side) with rate limiting
CREATE OR REPLACE FUNCTION verify_parent_pin(p_pin TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_hash TEXT;
  v_failed INT;
  v_locked TIMESTAMPTZ;
BEGIN
  -- Get current PIN data
  SELECT pin_hash, pin_failed_attempts, pin_locked_until
  INTO v_hash, v_failed, v_locked
  FROM profiles
  WHERE id = auth.uid();

  -- Check if account is locked
  IF v_locked IS NOT NULL AND v_locked > NOW() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Too many attempts. Try again later.',
      'locked_until', v_locked
    );
  END IF;

  -- Check if PIN is set
  IF v_hash IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No PIN set');
  END IF;

  -- Verify PIN
  IF crypt(p_pin, v_hash) = v_hash THEN
    -- Success: reset failed attempts
    UPDATE profiles
    SET pin_failed_attempts = 0, pin_locked_until = NULL
    WHERE id = auth.uid();

    -- Return hash for client-side caching (offline verification)
    RETURN json_build_object('success', true, 'pin_hash', v_hash);
  ELSE
    -- Failure: increment attempts, lock after 5
    v_failed := COALESCE(v_failed, 0) + 1;

    IF v_failed >= 5 THEN
      UPDATE profiles
      SET
        pin_failed_attempts = v_failed,
        pin_locked_until = NOW() + INTERVAL '15 minutes'
      WHERE id = auth.uid();

      RETURN json_build_object(
        'success', false,
        'error', 'Too many attempts. Locked for 15 minutes.',
        'locked_until', NOW() + INTERVAL '15 minutes'
      );
    ELSE
      UPDATE profiles
      SET pin_failed_attempts = v_failed
      WHERE id = auth.uid();

      RETURN json_build_object(
        'success', false,
        'error', 'Incorrect PIN',
        'attempts_remaining', 5 - v_failed
      );
    END IF;
  END IF;
END; $$;

-- RPC: Check if user has PIN set (no sensitive data returned)
CREATE OR REPLACE FUNCTION has_parent_pin()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_has_pin BOOLEAN;
BEGIN
  SELECT pin_hash IS NOT NULL INTO v_has_pin
  FROM profiles
  WHERE id = auth.uid();

  RETURN json_build_object('has_pin', COALESCE(v_has_pin, false));
END; $$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION set_parent_pin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_parent_pin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION has_parent_pin() TO authenticated;

-- Add comment explaining the feature
COMMENT ON COLUMN profiles.pin_hash IS 'bcrypt hash of 4-digit parent PIN for dashboard access';
COMMENT ON COLUMN profiles.pin_updated_at IS 'Timestamp when PIN was last set/changed';
COMMENT ON COLUMN profiles.pin_failed_attempts IS 'Count of consecutive failed PIN attempts';
COMMENT ON COLUMN profiles.pin_locked_until IS 'Timestamp until which PIN entry is locked (rate limiting)';
