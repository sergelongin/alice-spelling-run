# Audio Generation Parallelization

## Overview

The admin audio generation system now processes segments in parallel with controlled concurrency, reducing batch generation time from ~10 minutes to ~3.5 minutes for 100 words (3x speedup).

## Implementation

### Key Changes

1. **Concurrency Control** (`src/hooks/useAdminAudioGenerator.ts`)
   - `getConcurrencyLimit()`: Reads `VITE_AUDIO_GENERATION_CONCURRENCY` env var (default: 3)
   - `processConcurrently()`: Generic parallel task processor with pool size limit
   - Processes multiple segments simultaneously while respecting Cartesia API limits

2. **Retry Logic**
   - Automatic retry with exponential backoff (1s → 2s → 4s) for rate limit errors (429)
   - Max 3 retries per segment
   - Rate limit detection via HTTP 429 status or "rate limit" in error message

3. **Batch Processing**
   - Flattens word definitions into segment tasks (word, definition, sentence)
   - Processes all segments in parallel with concurrency limit
   - Reduces artificial delays (500ms → 100ms between segments)

### Configuration

Add to your `.env`:

```bash
# Audio generation concurrency limit (1-20)
# Cartesia plan limits:
#   Free tier:     2 concurrent requests max
#   Pro (current): 3 concurrent requests max
#   Startup:       5 concurrent requests max
#   Scale:         10-15 concurrent requests max
VITE_AUDIO_GENERATION_CONCURRENCY=3
```

**Default:** 3 (optimized for Pro plan)

## Performance

### Before (Sequential)
- 100 words × 3 segments = 300 segments
- ~2 seconds per segment
- **Total: ~600 seconds (10 minutes)**

### After (Parallel, Pro Plan)
- 300 segments / 3 concurrent = 100 batches
- ~2 seconds per batch
- **Total: ~200-220 seconds (3.5 minutes)**
- **Speedup: 3x faster**

### Higher Tier Plans
- **Startup** (5 concurrent): ~2 minutes (5x faster)
- **Scale** (10 concurrent): ~1 minute (10x faster)

## Testing

### Manual Test (5-10 words)
1. Start dev server: `npm run dev`
2. Sign in as super_admin
3. Navigate to admin audio page
4. Filter to a grade with few words
5. Click "Generate All Missing"
6. Observe multiple segments showing "generating" status simultaneously
7. Verify all complete successfully

### Rate Limit Test
1. Set `VITE_AUDIO_GENERATION_CONCURRENCY=5` (exceeds Pro limit)
2. Restart server
3. Generate batch
4. Check console for "Rate limited, retry X/3" messages
5. Verify retries succeed
6. Set back to `VITE_AUDIO_GENERATION_CONCURRENCY=3`

### Cancellation Test
1. Start large batch (50+ words)
2. Click cancel after 5 seconds
3. Verify clean abort (no hung requests)

## Architecture Notes

- **Error Isolation**: One failed segment doesn't block others
- **Atomic State Updates**: React batches concurrent setState calls correctly
- **Memory Safe**: Uploads audio immediately (~500KB peak for 3 concurrent)
- **Backward Compatible**: Single-segment generation unchanged

## Troubleshooting

### "Rate limited" warnings in console
- **Cause**: Concurrency setting exceeds your Cartesia plan limit
- **Fix**: Lower `VITE_AUDIO_GENERATION_CONCURRENCY` to match your plan (see table above)

### Segments stuck in "generating" status
- **Cause**: Network timeout or API error
- **Fix**: Click cancel, check console for errors, retry batch

### Slower than expected
- **Cause**: Network latency or Supabase region distance
- **Fix**: Performance depends on network speed; 3x speedup is typical for US-based connections

## Files Modified

- `src/hooks/useAdminAudioGenerator.ts` - Core parallelization logic
- `.env.example` - Documentation for new env var
