import { AIProvider, SpellingHintRequest, getRandomFallbackHint } from '@/types';

// Get configuration from environment
const getProvider = (): AIProvider => {
  const provider = import.meta.env.VITE_AI_PROVIDER as AIProvider;
  return provider || 'openai';
};

const getApiKey = (provider: AIProvider): string => {
  switch (provider) {
    case 'openai':
      return import.meta.env.VITE_OPENAI_API_KEY || '';
    case 'anthropic':
      return import.meta.env.VITE_ANTHROPIC_API_KEY || '';
    case 'groq':
      return import.meta.env.VITE_GROQ_API_KEY || '';
    default:
      return '';
  }
};

// System prompt for spelling hints (optimized for TTS readability)
const SPELLING_HINT_SYSTEM_PROMPT = `You are a friendly spelling tutor helping a 10-year-old learn to spell.

Goal: Give a hint that helps them discover the correct spelling themselves, without revealing the answer.

Guidelines:
- Be warm, encouraging, and patient
- Start with brief praise for their effort
- Focus on ONE specific issue with their current guess
- Use simple, age-appropriate language
- Keep responses under 50 words

TTS rules (VERY IMPORTANT):
- Do NOT write invented sound spellings like "unh", "kuh", "sss", "uh".
- Avoid IPA and slash-phonics like /sh/ (they're often spoken weirdly).
- Instead, describe sounds using REAL anchor words:
  - "It starts like the beginning of 'under'…"
  - "It ends like the end of 'fish'…"
  - "The middle sounds like 'rain'…"
- Use at most 1–2 anchor words per hint.
- Prefer short sentences and natural words; avoid heavy punctuation.

Allowed hint types (without revealing letters):
- Sound patterns using anchor words
- Spelling rules (general, not letter-by-letter)
- Word families (with example words)
- Prefix/suffix meaning (without naming specific letters)
- Silent-letter idea (without naming the letter)

NEVER:
- Reveal the correct spelling
- Give the specific letters to use`;

function buildUserPrompt(request: SpellingHintRequest): string {
  const { targetWord, guess, previousAttempts } = request;

  let prompt = `The child is trying to spell: "${targetWord}"\n`;
  prompt += `Their current guess: "${guess}"\n`;

  if (previousAttempts.length > 0) {
    prompt += `Previous attempts: ${previousAttempts.join(', ')}\n`;
  }

  prompt += '\nProvide a short, encouraging hint (max 50 words).';

  return prompt;
}

// OpenAI API call
async function callOpenAI(request: SpellingHintRequest, apiKey: string): Promise<string> {
  console.log('[AI] Calling OpenAI API...');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SPELLING_HINT_SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(request) },
      ],
      max_tokens: 100,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    console.log('[AI] OpenAI API failed:', response.status);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  console.log('[AI] OpenAI API success');
  return data.choices[0]?.message?.content || getRandomFallbackHint();
}

// Anthropic API call
async function callAnthropic(request: SpellingHintRequest, apiKey: string): Promise<string> {
  console.log('[AI] Calling Anthropic API...');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 100,
      system: SPELLING_HINT_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: buildUserPrompt(request) },
      ],
    }),
  });

  if (!response.ok) {
    console.log('[AI] Anthropic API failed:', response.status);
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  console.log('[AI] Anthropic API success');
  return data.content[0]?.text || getRandomFallbackHint();
}

// Groq API call
async function callGroq(request: SpellingHintRequest, apiKey: string): Promise<string> {
  const systemPrompt = SPELLING_HINT_SYSTEM_PROMPT;
  const userPrompt = buildUserPrompt(request);

  console.log('[AI] ========== GROQ API CALL ==========');
  console.log('[AI] SYSTEM PROMPT:\n' + systemPrompt);
  console.log('[AI] USER PROMPT:\n' + userPrompt);
  console.log('[AI] =====================================');

  try {
    console.log('[AI] Making fetch request to Groq...');
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1024,  // Reasoning models need more tokens for thinking + response
        temperature: 0.7,
      }),
    });

    console.log('[AI] Fetch completed, status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.log('[AI] Groq API failed:', response.status, errorBody);
      throw new Error(`Groq API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    console.log('[AI] Groq API full response:', JSON.stringify(data, null, 2));

    const hint = data.choices?.[0]?.message?.content;
    console.log('[AI] Extracted hint:', hint);

    if (!hint) {
      console.log('[AI] No hint in response, using fallback');
      return getRandomFallbackHint();
    }

    return hint;
  } catch (err) {
    console.error('[AI] Groq fetch error:', err);
    throw err;
  }
}

// Simple in-memory cache for hints
const hintCache = new Map<string, string>();

function getCacheKey(request: SpellingHintRequest): string {
  return `${request.targetWord}:${request.guess}`;
}

/**
 * Generate a spelling hint using the configured AI provider
 */
export async function generateSpellingHint(request: SpellingHintRequest): Promise<string> {
  // Check cache first
  const cacheKey = getCacheKey(request);
  const cachedHint = hintCache.get(cacheKey);
  if (cachedHint) {
    return cachedHint;
  }

  const provider = getProvider();
  const apiKey = getApiKey(provider);

  // If no API key configured, return fallback
  if (!apiKey) {
    console.warn(`No API key configured for provider: ${provider}`);
    return getRandomFallbackHint();
  }

  try {
    let hint: string;

    switch (provider) {
      case 'openai':
        hint = await callOpenAI(request, apiKey);
        break;
      case 'anthropic':
        hint = await callAnthropic(request, apiKey);
        break;
      case 'groq':
        hint = await callGroq(request, apiKey);
        break;
      default:
        hint = getRandomFallbackHint();
    }

    // Cache the result
    hintCache.set(cacheKey, hint);

    return hint;
  } catch (error) {
    console.error('Error generating spelling hint:', error);
    return getRandomFallbackHint();
  }
}

/**
 * Check if AI hints are available (API key is configured)
 */
export function isAIAvailable(): boolean {
  const provider = getProvider();
  const apiKey = getApiKey(provider);
  return !!apiKey;
}

/**
 * Get the current AI provider name for display
 */
export function getCurrentProvider(): AIProvider {
  return getProvider();
}

// =============================================================================
// Word Definition Generation
// =============================================================================

interface WordDefinitionResult {
  definition: string;
  sentence: string;
  gradeLevel: 3 | 4 | 5 | 6;
}

const WORD_DEFINITION_SYSTEM_PROMPT = `You are a vocabulary assistant for a children's spelling app (ages 8-12).

Given a word, provide:
1. A clear, child-friendly definition (1-2 sentences)
2. An example sentence using the word naturally
3. The appropriate grade level (3-6) based on word complexity

Respond ONLY with valid JSON in this exact format:
{
  "definition": "...",
  "sentence": "...",
  "gradeLevel": 4
}

Guidelines:
- Definitions should be simple and accurate
- Sentences should be relatable to children
- Grade 3: Common words, simple patterns
- Grade 4: More complex patterns, common academic words
- Grade 5: Academic vocabulary, Latin/Greek roots
- Grade 6: Advanced vocabulary, abstract concepts

Do not include any text outside the JSON object.`;

/**
 * Generate a definition, example sentence, and grade level for a word using AI
 */
export async function generateWordDefinition(word: string): Promise<WordDefinitionResult | null> {
  const provider = getProvider();
  const apiKey = getApiKey(provider);

  if (!apiKey) {
    console.warn(`No API key configured for provider: ${provider}`);
    return null;
  }

  const userPrompt = `Word: ${word}`;

  try {
    let responseText: string;

    switch (provider) {
      case 'openai': {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: WORD_DEFINITION_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: 200,
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        responseText = data.choices[0]?.message?.content || '';
        break;
      }

      case 'anthropic': {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 200,
            system: WORD_DEFINITION_SYSTEM_PROMPT,
            messages: [
              { role: 'user', content: userPrompt },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`Anthropic API error: ${response.status}`);
        }

        const data = await response.json();
        responseText = data.content[0]?.text || '';
        break;
      }

      case 'groq': {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
              { role: 'system', content: WORD_DEFINITION_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: 200,
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          throw new Error(`Groq API error: ${response.status}`);
        }

        const data = await response.json();
        responseText = data.choices?.[0]?.message?.content || '';
        break;
      }

      default:
        return null;
    }

    // Parse the JSON response
    const parsed = JSON.parse(responseText.trim()) as WordDefinitionResult;

    // Validate the response structure
    if (
      typeof parsed.definition !== 'string' ||
      typeof parsed.sentence !== 'string' ||
      ![3, 4, 5, 6].includes(parsed.gradeLevel)
    ) {
      console.error('Invalid AI response structure:', parsed);
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Error generating word definition:', error);
    return null;
  }
}
