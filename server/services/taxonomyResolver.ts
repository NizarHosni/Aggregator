import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { join } from 'path';
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

export interface TaxonomyMapping {
  primary: string;
  secondary: string | null;
  confidence: number;
  description: string;
  usedGPT4?: boolean;
}

// Load local taxonomy mapping
let localTaxonomyMap: Record<string, TaxonomyMapping> = {};
try {
  const taxonomyMapPath = join(process.cwd(), 'server', 'data', 'taxonomyMap.json');
  const taxonomyMapData = readFileSync(taxonomyMapPath, 'utf-8');
  localTaxonomyMap = JSON.parse(taxonomyMapData);
  console.log(`✅ Loaded ${Object.keys(localTaxonomyMap).length} local taxonomy mappings`);
} catch (error) {
  console.warn('⚠️ Could not load taxonomy map, will use GPT-4 for all mappings:', error);
}

// Cache for GPT-4 taxonomy resolutions
const taxonomyCache = new LRUCache<TaxonomyMapping>(500, 7 * 24 * 60 * 60 * 1000); // 7 day TTL

export class TaxonomyResolver {
  private stats = {
    totalResolutions: 0,
    localMappings: 0,
    gpt4Calls: 0,
    cacheHits: 0,
    errors: 0,
    specialtiesNeedingGPT4: new Set<string>(),
  };

  async resolve(specialty: string | null): Promise<TaxonomyMapping | null> {
    if (!specialty) {
      return null;
    }

    this.stats.totalResolutions++;

    const normalizedSpecialty = specialty.toLowerCase().trim();

    // Check cache first
    const cached = taxonomyCache.get(normalizedSpecialty);
    if (cached) {
      this.stats.cacheHits++;
      return cached;
    }

    // Try local mapping first (fast, free)
    const localMapping = this.tryLocalMapping(normalizedSpecialty);
    if (localMapping) {
      this.stats.localMappings++;
      taxonomyCache.set(normalizedSpecialty, localMapping);
      return localMapping;
    }

    // Use GPT-4 for complex/unknown specialties
    try {
      const gptMapping = await this.resolveWithGPT4(specialty);
      this.stats.gpt4Calls++;
      this.stats.specialtiesNeedingGPT4.add(normalizedSpecialty);
      taxonomyCache.set(normalizedSpecialty, gptMapping);
      return gptMapping;
    } catch (error) {
      this.stats.errors++;
      console.error('Taxonomy resolution error:', error);
      // Return a generic mapping as fallback
      return {
        primary: '208D00000X', // Family Medicine as generic fallback
        secondary: null,
        confidence: 0.5,
        description: specialty,
        usedGPT4: false,
      };
    }
  }

  private tryLocalMapping(normalizedSpecialty: string): TaxonomyMapping | null {
    // Direct match
    if (localTaxonomyMap[normalizedSpecialty]) {
      return {
        ...localTaxonomyMap[normalizedSpecialty],
        usedGPT4: false,
      };
    }

    // Fuzzy match - check if specialty contains any key
    for (const [key, mapping] of Object.entries(localTaxonomyMap)) {
      if (normalizedSpecialty.includes(key) || key.includes(normalizedSpecialty)) {
        return {
          ...mapping,
          usedGPT4: false,
        };
      }
    }

    return null;
  }

  private async resolveWithGPT4(specialty: string): Promise<TaxonomyMapping> {
    const client = getOpenAIClient();

    const prompt = `Analyze this medical specialty and determine the correct NPPES taxonomy codes:

Specialty: "${specialty}"

I need:

1. Primary Taxonomy Code (the broad category)
   - This is the main specialty category (e.g., "207R00000X" for Internal Medicine)

2. Secondary Taxonomy Code (if it's a sub-specialty)
   - This is the specific sub-specialty code (e.g., "207RC0000X" for Cardiovascular Disease)
   - Set to null if it's not a sub-specialty

3. Confidence (0-1)
   - How confident you are in this mapping

4. Description
   - A brief description of what this specialty is

Examples:
- "cardiovascular disease specialist" → Primary: 207R00000X (Internal Medicine), Secondary: 207RC0000X (Cardiovascular Disease)
- "retina surgeon" → Primary: 207W00000X (Ophthalmology), Secondary: 207WX0200X (Retina Specialist)
- "general practitioner" → Primary: 208D00000X (Family Medicine), Secondary: null

Common NPPES Taxonomy Codes:
- Internal Medicine: 207R00000X
- Cardiology: 207RC0000X
- Ophthalmology: 207W00000X
- Retina Specialist: 207WX0200X
- Dermatology: 207N00000X
- Orthopedic Surgery: 207X00000X
- Neurology: 2084N0400X
- Pediatrics: 208000000X
- Family Medicine: 208D00000X
- Surgery: 208600000X

Return JSON:
{
  "primary": "207R00000X",
  "secondary": "207RC0000X" or null,
  "confidence": 0.9,
  "description": "Internal Medicine - Cardiovascular Disease"
}`;

    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content:
              'You are a medical taxonomy specialist. Analyze medical specialties and determine correct NPPES taxonomy codes. Always return valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1, // Very low temperature for accuracy
        max_tokens: 300,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from GPT-4');
      }

      const parsed = JSON.parse(content) as TaxonomyMapping;

      // Validate response
      if (!parsed.primary || !parsed.confidence) {
        throw new Error('Invalid taxonomy mapping response');
      }

      return {
        primary: parsed.primary,
        secondary: parsed.secondary || null,
        confidence: Math.max(0, Math.min(1, parsed.confidence)),
        description: parsed.description || specialty,
        usedGPT4: true,
      };
    } catch (error) {
      console.error('GPT-4 taxonomy resolution error:', error);
      throw error;
    }
  }

  getStats() {
    return {
      ...this.stats,
      localMappingRate:
        this.stats.totalResolutions > 0
          ? this.stats.localMappings / this.stats.totalResolutions
          : 0,
      gpt4CallRate:
        this.stats.totalResolutions > 0 ? this.stats.gpt4Calls / this.stats.totalResolutions : 0,
      cacheHitRate:
        this.stats.totalResolutions > 0
          ? this.stats.cacheHits / this.stats.totalResolutions
          : 0,
      specialtiesNeedingGPT4: Array.from(this.stats.specialtiesNeedingGPT4),
      cacheSize: taxonomyCache.size(),
    };
  }

  clearCache() {
    taxonomyCache.clear();
  }
}

// Singleton instance
export const taxonomyResolver = new TaxonomyResolver();

