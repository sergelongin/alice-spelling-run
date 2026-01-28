-- Migration: Add birth date and pending grade import columns to children table
-- This supports the enhanced "Add Child" flow with birth date collection and
-- deferred grade-level word import.

-- Add birth month (1-12, optional)
ALTER TABLE children
ADD COLUMN IF NOT EXISTS birth_month INTEGER CHECK (birth_month >= 1 AND birth_month <= 12);

-- Add birth year (2010-2025, optional)
ALTER TABLE children
ADD COLUMN IF NOT EXISTS birth_year INTEGER CHECK (birth_year >= 2010 AND birth_year <= 2025);

-- Add pending grade import flag (3-6, null when no import pending)
-- When set, GameProvider will import words for this grade on mount and clear the flag
ALTER TABLE children
ADD COLUMN IF NOT EXISTS pending_grade_import INTEGER CHECK (pending_grade_import >= 3 AND pending_grade_import <= 6);
