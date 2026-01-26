-- Migration: Add volume column to audio_pronunciations
-- This allows per-segment volume control for audio regeneration

ALTER TABLE audio_pronunciations
ADD COLUMN IF NOT EXISTS volume NUMERIC(3,2) DEFAULT 1.0
CHECK (volume >= 0.5 AND volume <= 2.0);

-- Add comment for documentation
COMMENT ON COLUMN audio_pronunciations.volume IS 'Audio volume multiplier (0.5-2.0, default 1.0) for Cartesia TTS generation';
