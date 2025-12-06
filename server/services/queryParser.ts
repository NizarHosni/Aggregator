import OpenAI from 'openai';
import { LRUCache } from '../utils/cache.js';

// Lazy-load OpenAI client
let openai: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

export interface ParsedQuery {
  name: {
    first: string | null;
    last: string | null;
    middle: string | null;
  } | null;
  specialty: string | null;
  location: {
    city: string | null;
    state: string | null;
    full: string | null;
  } | null;
  search_type: 'name_search' | 'specialty_search' | 'location_search' | 'combined';
  confidence: number;
}

// Cache for parsed queries
const queryCache = new LRUCache<ParsedQuery>(1000, 24 * 60 * 60 * 1000); // 24 hour TTL

export class QueryParser {
  private stats = {
    totalQueries: 0,
    cacheHits: 0,
    gpt4Calls: 0,
    errors: 0,
  };

  async parse(userQuery: string): Promise<ParsedQuery> {
    this.stats.totalQueries++;

    // Normalize query for cache key
    const normalizedQuery = userQuery.toLowerCase().trim();

    // Check cache first
    const cached = queryCache.get(normalizedQuery);
    if (cached) {
      this.stats.cacheHits++;
      return cached;
    }

    try {
      // Parse with GPT-4 Turbo
      const parsed = await this.parseWithGPT4Turbo(userQuery);

      // Cache result
      queryCache.set(normalizedQuery, parsed);

      this.stats.gpt4Calls++;
      return parsed;
    } catch (error) {
      this.stats.errors++;
      console.error('Query parsing error:', error);

      // Fallback to basic parsing
      return this.fallbackParse(userQuery);
    }
  }

  private async parseWithGPT4Turbo(userQuery: string): Promise<ParsedQuery> {
    const client = getOpenAIClient();

    const prompt = `You are a medical search specialist. Extract structured information from this doctor search query:

QUERY: "${userQuery}"

Extract:

1. Doctor Name (if present): first_name, last_name, middle_initial
   - Handle variations: "Dr. John Smith", "John A. Smith MD", "Smith, John"
   - Remove titles: Dr., Doctor, MD, DO, etc.
   - Extract middle initial if present (e.g., "John L. Smith" → middle: "L")

2. Medical Specialty: Primary medical specialty mentioned
   - Normalize to common terms: "cardiologist", "ophthalmologist", "retina surgeon", "heart doctor", etc.
   - If multiple specialties mentioned, use the most specific one
   - If no specialty, set to null

3. Location: City, State, or specific area
   - Extract city and state separately if possible
   - Include state abbreviation if known (e.g., "Miami, FL" or "Miami Florida")
   - Normalize state names to abbreviations (e.g., "California" → "CA")
   - If only city mentioned, set state to null

4. Search Type: Determine the search type based on what's provided
   - "name_search": Only name provided
   - "specialty_search": Only specialty provided
   - "location_search": Only location provided
   - "combined": Multiple parameters provided

Return JSON format:
{
  "name": {
    "first": "John",
    "last": "Smith",
    "middle": "A"
  } or null if no name,
  "specialty": "cardiologist" or null,
  "location": {
    "city": "Miami",
    "state": "FL",
    "full": "Miami, FL"
  } or null,
  "search_type": "combined",
  "confidence": 0.95
}

Rules:
- If no name, set name to null (not empty object)
- Normalize specialty to lowercase common terms
- For location, always include "full" field with formatted location string
- Confidence should be 0.0-1.0 based on how clear the query is
- Be strict: only extract what's clearly present in the query`;

    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a medical search specialist. Extract structured information from doctor search queries. Always return valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2, // Lower temperature for more consistent results
        max_tokens: 500,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from GPT-4');
      }

      const parsed = JSON.parse(content) as ParsedQuery;

      // Validate and normalize response
      return this.validateAndNormalize(parsed);
    } catch (error) {
      console.error('GPT-4 Turbo parsing error:', error);
      throw error;
    }
  }

  private validateAndNormalize(parsed: any): ParsedQuery {
    // Validate name
    let name: ParsedQuery['name'] = null;
    if (parsed.name && (parsed.name.first || parsed.name.last)) {
      name = {
        first: parsed.name.first || null,
        last: parsed.name.last || null,
        middle: parsed.name.middle || null,
      };
    }

    // Validate specialty
    const specialty = parsed.specialty
      ? parsed.specialty.toLowerCase().trim()
      : null;

    // Validate location
    let location: ParsedQuery['location'] = null;
    if (parsed.location) {
      const city = parsed.location.city || null;
      const state = parsed.location.state || null;
      const full = parsed.location.full || (city && state ? `${city}, ${state}` : city || state || null);

      if (city || state) {
        location = { city, state, full };
      }
    }

    // Validate search_type
    let search_type: ParsedQuery['search_type'] = 'specialty_search';
    if (name && specialty && location) {
      search_type = 'combined';
    } else if (name && specialty) {
      search_type = 'combined';
    } else if (name && location) {
      search_type = 'combined';
    } else if (specialty && location) {
      search_type = 'combined';
    } else if (name) {
      search_type = 'name_search';
    } else if (specialty) {
      search_type = 'specialty_search';
    } else if (location) {
      search_type = 'location_search';
    }

    // Validate confidence
    const confidence = Math.max(0, Math.min(1, parsed.confidence || 0.8));

    return {
      name,
      specialty,
      location,
      search_type,
      confidence,
    };
  }

  private fallbackParse(userQuery: string): ParsedQuery {
    // Basic fallback parsing using regex patterns
    const query = userQuery.trim();

    // Try to extract name (simple pattern: 2-3 capitalized words)
    const nameMatch = query.match(/\b([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)\b/);
    let name: ParsedQuery['name'] = null;
    if (nameMatch) {
      const nameParts = nameMatch[1].split(/\s+/);
      name = {
        first: nameParts[0] || null,
        last: nameParts[nameParts.length - 1] || null,
        middle: nameParts.length > 2 ? nameParts[1].replace('.', '') : null,
      };
    }

    // Try to extract location (city, state pattern)
    const locationMatch = query.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*,?\s*([A-Z]{2}|[A-Z][a-z]+)\b/);
    let location: ParsedQuery['location'] = null;
    if (locationMatch) {
      location = {
        city: locationMatch[1] || null,
        state: locationMatch[2] || null,
        full: locationMatch[0] || null,
      };
    }

    // Determine search type
    let search_type: ParsedQuery['search_type'] = 'specialty_search';
    if (name && location) {
      search_type = 'combined';
    } else if (name) {
      search_type = 'name_search';
    } else if (location) {
      search_type = 'location_search';
    }

    return {
      name,
      specialty: null, // Can't reliably extract without GPT
      location,
      search_type,
      confidence: 0.5, // Low confidence for fallback
    };
  }

  getStats() {
    return {
      ...this.stats,
      cacheHitRate: this.stats.totalQueries > 0 ? this.stats.cacheHits / this.stats.totalQueries : 0,
      cacheSize: queryCache.size(),
    };
  }

  clearCache() {
    queryCache.clear();
  }
}

// Singleton instance
export const queryParser = new QueryParser();

