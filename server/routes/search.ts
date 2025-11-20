import express from 'express';
import OpenAI from 'openai';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { sql } from '../db/index.js';

export const searchRoutes = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// NPPES API Types
interface NPPESProvider {
  number: string;
  basic: {
    first_name: string;
    last_name: string;
    middle_name?: string;
    credential?: string;
    sole_proprietor?: string;
    gender?: string;
    enumeration_date?: string;
    last_updated?: string;
    status?: string;
  };
  addresses: Array<{
    country_code?: string;
    country_name?: string;
    address_purpose?: string;
    address_type?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    telephone_number?: string;
    fax_number?: string;
  }>;
  taxonomies: Array<{
    code?: string;
    desc?: string;
    primary?: boolean;
    state?: string;
    license?: string;
  }>;
}

interface NPPESResponse {
  result_count?: number;
  results?: NPPESProvider[];
}

// Search NPPES Database (Free, Official US Healthcare Data)
async function searchNPPES(
  firstName: string | null,
  lastName: string | null,
  specialty: string | null,
  city: string | null,
  state: string | null
): Promise<NPPESProvider[]> {
  const baseUrl = 'https://npiregistry.cms.hhs.gov/api/?version=2.1';
  const params: string[] = [];

  if (firstName) params.push(`first_name=${encodeURIComponent(firstName)}`);
  if (lastName) params.push(`last_name=${encodeURIComponent(lastName)}`);
  if (specialty) params.push(`taxonomy_description=${encodeURIComponent(specialty)}`);
  if (city) params.push(`city=${encodeURIComponent(city)}`);
  if (state) params.push(`state=${encodeURIComponent(state)}`);

  // Limit to 50 results
  params.push('limit=50');

  // URL construction - baseUrl already has ?version=2.1, so use & for additional params
  const url = params.length > 0 
    ? `${baseUrl}&${params.join('&')}` 
    : `${baseUrl}&limit=50`;
  
  // === API DEBUG LOG ===
  console.log('=== NPPES API DEBUG ===');
  console.log('NPPES Search Parameters:', { firstName, lastName, specialty, city, state });
  console.log('NPPES API Request URL:', url);
  
  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'YoDoc-PhysicianSearch/1.0',
      },
    });
    const responseTime = Date.now() - startTime;
    
    console.log('NPPES API Response Status:', response.status, response.statusText);
    console.log('NPPES API Response Time:', responseTime + 'ms');
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('NPPES API Error Response:', errorText);
      return [];
    }
    
    const data = await response.json() as NPPESResponse;
    console.log('NPPES API Response Data:', {
      result_count: data.result_count,
      results_length: data.results?.length || 0,
      first_result: data.results?.[0] ? {
        name: `${data.results[0].basic.first_name} ${data.results[0].basic.last_name}`,
        npi: data.results[0].number,
        specialty: data.results[0].taxonomies?.[0]?.desc,
        city: data.results[0].addresses?.[0]?.city,
        state: data.results[0].addresses?.[0]?.state,
      } : null,
    });
    
    return data.results || [];
  } catch (error: any) {
    console.error('=== NPPES API ERROR ===');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('Failed URL:', url);
    return [];
  }
}

// Enhance NPPES data with Google Places info
async function enhanceWithGooglePlaces(
  nppesDoctor: NPPESProvider,
  googleApiKey: string
): Promise<{
  name: string;
  specialty: string;
  location: string;
  phone: string;
  rating: number;
  years_experience: number;
  npi?: string;
} | null> {
  try {
    const firstName = nppesDoctor.basic.first_name || '';
    const lastName = nppesDoctor.basic.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    
    if (!fullName) return null;

    // Get primary address
    const primaryAddress = nppesDoctor.addresses.find(addr => addr.address_purpose === 'LOCATION') || nppesDoctor.addresses[0];
    if (!primaryAddress) return null;

    const city = primaryAddress.city || '';
    const state = primaryAddress.state || '';
    const addressLine = primaryAddress.address_1 || '';
    const fullAddress = `${addressLine}, ${city}, ${state} ${primaryAddress.postal_code || ''}`.trim();

    // Get primary specialty
    const primaryTaxonomy = nppesDoctor.taxonomies.find(tax => tax.primary) || nppesDoctor.taxonomies[0];
    const specialty = primaryTaxonomy?.desc || 'General Practice';

    // Try to find doctor in Google Places
    let phone = primaryAddress.telephone_number || 'Not available';
    let rating = 0;
    let googleAddress = fullAddress;

    if (googleApiKey && city && state) {
      try {
        // Search for doctor by name and location
        const searchQuery = `${fullName} ${specialty} ${city} ${state}`;
        const placesSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${googleApiKey}`;
        
        // === GOOGLE PLACES API DEBUG ===
        console.log('=== GOOGLE PLACES TEXT SEARCH DEBUG ===');
        console.log('Doctor Name:', fullName);
        console.log('Search Query:', searchQuery);
        console.log('Google Places Search URL:', placesSearchUrl.replace(googleApiKey, 'API_KEY_HIDDEN'));
        console.log('Google API Key Present:', !!googleApiKey);
        console.log('Google API Key Length:', googleApiKey?.length || 0);
        
        const startTime = Date.now();
        const placesResponse = await fetch(placesSearchUrl);
        const responseTime = Date.now() - startTime;
        
        console.log('Google Places Response Status:', placesResponse.status, placesResponse.statusText);
        console.log('Google Places Response Time:', responseTime + 'ms');
        
        if (!placesResponse.ok) {
          const errorText = await placesResponse.text();
          console.error('Google Places API Error Response:', errorText);
          throw new Error(`Google Places API returned ${placesResponse.status}: ${errorText}`);
        }
        
        const placesData = await placesResponse.json() as {
          results?: Array<{
            place_id?: string;
            formatted_address?: string;
            rating?: number;
            name?: string;
          }>;
          status?: string;
          error_message?: string;
        };

        console.log('Google Places Search Response:', {
          status: placesData.status,
          results_count: placesData.results?.length || 0,
          error_message: placesData.error_message,
          first_result: placesData.results?.[0] ? {
            name: placesData.results[0].name,
            place_id: placesData.results[0].place_id,
            address: placesData.results[0].formatted_address,
          } : null,
        });

        if (placesData.status === 'REQUEST_DENIED' || placesData.status === 'INVALID_REQUEST') {
          console.error('Google Places API Error:', placesData.error_message || placesData.status);
          throw new Error(`Google Places API error: ${placesData.error_message || placesData.status}`);
        }

        if (placesData.results && placesData.results.length > 0) {
          const place = placesData.results[0];
          if (place.place_id) {
            // Get detailed info
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,rating&key=${googleApiKey}`;
            
            console.log('=== GOOGLE PLACES DETAILS DEBUG ===');
            console.log('Place ID:', place.place_id);
            console.log('Details URL:', detailsUrl.replace(googleApiKey, 'API_KEY_HIDDEN'));
            
            const detailsStartTime = Date.now();
            const detailsResponse = await fetch(detailsUrl);
            const detailsResponseTime = Date.now() - detailsStartTime;
            
            console.log('Google Places Details Response Status:', detailsResponse.status);
            console.log('Google Places Details Response Time:', detailsResponseTime + 'ms');
            
            if (!detailsResponse.ok) {
              const errorText = await detailsResponse.text();
              console.error('Google Places Details API Error:', errorText);
              throw new Error(`Google Places Details API returned ${detailsResponse.status}`);
            }
            
            const detailsData = await detailsResponse.json() as {
              result?: {
                formatted_phone_number?: string;
                rating?: number;
              };
              status?: string;
              error_message?: string;
            };

            console.log('Google Places Details Response:', {
              status: detailsData.status,
              has_phone: !!detailsData.result?.formatted_phone_number,
              has_rating: !!detailsData.result?.rating,
              error_message: detailsData.error_message,
            });

            if (detailsData.result) {
              if (detailsData.result.formatted_phone_number) {
                phone = detailsData.result.formatted_phone_number;
                console.log('Updated phone from Google Places:', phone);
              }
              if (detailsData.result.rating) {
                rating = detailsData.result.rating;
                console.log('Updated rating from Google Places:', rating);
              }
            }

            if (place.formatted_address) {
              googleAddress = place.formatted_address;
              console.log('Updated address from Google Places:', googleAddress);
            }
          }
        } else {
          console.warn('Google Places returned no results for:', searchQuery);
        }
      } catch (error: any) {
        console.error('=== GOOGLE PLACES API ERROR ===');
        console.error('Error Type:', error.constructor.name);
        console.error('Error Message:', error.message);
        console.error('Error Stack:', error.stack);
        console.error('Doctor Name:', fullName);
        console.warn(`Could not enhance with Google Places for ${fullName}:`, error.message);
        // Continue with NPPES data only
      }
    } else {
      console.log('Google Places enhancement skipped:', {
        has_api_key: !!googleApiKey,
        has_city: !!city,
        has_state: !!state,
      });
    }

    // Calculate years of experience from enumeration date (approximate)
    let yearsExperience = 10; // Default
    if (nppesDoctor.basic.enumeration_date) {
      const enumDate = new Date(nppesDoctor.basic.enumeration_date);
      const yearsSinceEnum = new Date().getFullYear() - enumDate.getFullYear();
      yearsExperience = Math.max(5, Math.min(40, yearsSinceEnum + 5)); // Add 5 years for pre-enumeration experience
    }

    return {
      name: fullName,
      specialty: specialty,
      location: googleAddress || fullAddress,
      phone: phone,
      rating: rating,
      years_experience: yearsExperience,
      npi: nppesDoctor.number,
    };
  } catch (error) {
    console.error(`Error enhancing NPPES doctor ${nppesDoctor.number}:`, error);
    return null;
  }
}

// State name to abbreviation mapping
const STATE_MAP: { [key: string]: string } = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'district of columbia': 'DC'
};

// Specialty mapping for common terms
const SPECIALTY_MAP: { [key: string]: string } = {
  'retina': 'Retina Surgery',
  'retina surgeon': 'Retina Surgery',
  'retina specialist': 'Retina Surgery',
  'ophthalmolog': 'Ophthalmology',
  'eye doctor': 'Ophthalmology',
  'cardiolog': 'Cardiology',
  'heart doctor': 'Cardiology',
  'orthopedic': 'Orthopedic Surgery',
  'orthoped': 'Orthopedic Surgery',
  'dermatolog': 'Dermatology',
  'neurolog': 'Neurology',
  'pediatric': 'Pediatrics',
  'primary care': 'Primary Care',
  'general practice': 'General Practice',
  'family medicine': 'Family Medicine',
  'internal medicine': 'Internal Medicine',
};

// Alternative specialty terms for fallback searches
const SPECIALTY_ALTERNATIVES: { [key: string]: string[] } = {
  'Retina Surgery': ['Ophthalmology', 'Retina'],
  'Ophthalmology': ['Retina Surgery', 'Eye'],
  'Cardiology': ['Cardiovascular Disease'],
  'Orthopedic Surgery': ['Orthopedic', 'Orthopedics'],
};

// Parse name from query string (handles middle initials)
function parseName(query: string): { firstName: string | null; lastName: string | null } {
  // Remove common prefixes
  const cleaned = query.replace(/^(dr\.?|doctor)\s+/i, '').trim();
  
  // Split into words
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length < 2) {
    return { firstName: null, lastName: null };
  }

  // Pattern 1: "First M. Last" or "First M Last" (middle initial)
  // Matches: "Mark L. Nelson", "Mark L Nelson", "John M. Smith"
  if (words.length >= 3) {
    const middle = words[1];
    // Check if middle is a single letter (with or without period)
    if (middle.length <= 2 && /^[A-Z]\.?$/i.test(middle)) {
      return {
        firstName: words[0],
        lastName: words.slice(2).join(' '),
      };
    }
  }

  // Pattern 2: "First Last" or "First Middle Last" (no middle initial)
  // For 2 words: "Mark Nelson" -> firstName: Mark, lastName: Nelson
  // For 3+ words: "John Michael Smith" -> firstName: John, lastName: Michael Smith
  if (words.length >= 2) {
    // If we have 2 words, it's likely First Last
    if (words.length === 2) {
      return {
        firstName: words[0],
        lastName: words[1],
      };
    }
    
    // For 3+ words, take first as first name, rest as last name
    // This handles cases like "Mark L Nelson" where L might not be detected as initial
    return {
      firstName: words[0],
      lastName: words.slice(1).join(' '),
    };
  }

  return { firstName: null, lastName: null };
}

// Enhanced location parsing (handles "tacoma washington", "City, State", etc.)
function parseLocation(locationStr: string | null): { city: string | null; state: string | null } {
  if (!locationStr) return { city: null, state: null };

  const trimmed = locationStr.trim();

  // Try to parse "City, State" or "City, ST" format
  const cityStateMatch = trimmed.match(/^([^,]+),\s*([A-Z]{2}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$/i);
  if (cityStateMatch) {
    const city = cityStateMatch[1].trim();
    const statePart = cityStateMatch[2].trim();
    const state = statePart.length === 2 
      ? statePart.toUpperCase() 
      : STATE_MAP[statePart.toLowerCase()] || statePart;
    return { city, state: state.toUpperCase() };
  }

  // Try to parse "City State" format (e.g., "tacoma washington")
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    // Check if last word is a state
    const lastWord = words[words.length - 1].toLowerCase();
    const state = STATE_MAP[lastWord] || (lastWord.length === 2 ? lastWord.toUpperCase() : null);
    
    if (state) {
      const city = words.slice(0, -1).join(' ');
      return { city, state: state.toUpperCase() };
    }
    
    // Check if last two words form a state name
    if (words.length >= 3) {
      const lastTwoWords = words.slice(-2).join(' ').toLowerCase();
      const state = STATE_MAP[lastTwoWords];
      if (state) {
        const city = words.slice(0, -2).join(' ');
        return { city, state: state.toUpperCase() };
      }
    }
  }

  // If it's just a state abbreviation
  if (/^[A-Z]{2}$/i.test(trimmed)) {
    return { city: null, state: trimmed.toUpperCase() };
  }

  // Check if it's a full state name
  const stateName = STATE_MAP[trimmed.toLowerCase()];
  if (stateName) {
    return { city: null, state: stateName };
  }

  // Otherwise treat as city
  return { city: trimmed, state: null };
}

// Enhanced query parsing function
function parseSearchQuery(query: string): {
  firstName: string | null;
  lastName: string | null;
  specialty: string | null;
  location: string | null;
  originalQuery: string;
} {
  const originalQuery = query;
  let location: string | null = null;
  let specialty: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;

  // Extract location using multiple patterns
  const locationPatterns = [
    /\b(in|near|at)\s+([^,]+(?:,\s*[A-Z]{2})?|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new\s+hampshire|new\s+jersey|new\s+mexico|new\s+york|north\s+carolina|north\s+dakota|ohio|oklahoma|oregon|pennsylvania|rhode\s+island|south\s+carolina|south\s+dakota|tennessee|texas|utah|vermont|virginia|washington|west\s+virginia|wisconsin|wyoming)\b/i,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+([A-Z]{2})\b/,
  ];

  for (const pattern of locationPatterns) {
    const match = query.match(pattern);
    if (match) {
      location = match[2] || match[1];
      // Remove location from query for further processing
      query = query.replace(match[0], '').trim();
      break;
    }
  }

  // Extract specialty keywords
  const queryLower = query.toLowerCase();
  for (const [keyword, spec] of Object.entries(SPECIALTY_MAP)) {
    if (queryLower.includes(keyword)) {
      specialty = spec;
      // Remove specialty from query
      query = query.replace(new RegExp(keyword, 'gi'), '').trim();
      break;
    }
  }

  // Extract potential doctor names (2+ consecutive capitalized words, handling middle initials)
  const nameResult = parseName(query);
  if (nameResult.firstName || nameResult.lastName) {
    firstName = nameResult.firstName;
    lastName = nameResult.lastName;
  }

  return { firstName, lastName, specialty, location, originalQuery };
}

// Validate segmented search requirements (more lenient for fallback searches)
function validateSearchParams(
  firstName: string | null,
  lastName: string | null,
  specialty: string | null,
  city: string | null,
  state: string | null
): { valid: boolean; error?: string } {
  const hasName = !!(firstName || lastName);
  const hasSpecialty = !!specialty && specialty !== 'General Practice';
  const hasLocation = !!(city || state);

  // Name alone = valid
  if (hasName && !hasSpecialty && !hasLocation) {
    return { valid: true };
  }

  // Specialty + Location = valid (common case like "retina surgeon in tacoma")
  if (!hasName && hasSpecialty && hasLocation) {
    return { valid: true };
  }

  // Name + Location = valid
  if (hasName && !hasSpecialty && hasLocation) {
    return { valid: true };
  }

  // Name + Specialty = valid
  if (hasName && hasSpecialty && !hasLocation) {
    return { valid: true };
  }

  // All three = valid
  if (hasName && hasSpecialty && hasLocation) {
    return { valid: true };
  }

  // Need at least 2 of 3 fields
  const fieldCount = [hasName, hasSpecialty, hasLocation].filter(Boolean).length;
  
  if (fieldCount < 2) {
    return {
      valid: false,
      error: 'Please provide at least 2 of the following: name, specialty, or location. Name alone is also acceptable.',
    };
  }

  return { valid: true };
}

// AI-powered physician search with NPPES integration
searchRoutes.post('/physicians', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { query, radius } = req.body;
    const userId = req.userId!;
    
    // Default radius is 5km (5000 meters), max 50km
    const searchRadius = radius && typeof radius === 'number' && radius > 0 && radius <= 50000 
      ? radius 
      : 5000;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // === API DEBUG LOG ===
    console.log('=== SEARCH REQUEST DEBUG ===');
    console.log('Original Query:', query);
    console.log('User ID:', userId);
    console.log('Search Radius:', searchRadius, 'meters');

    // Enhanced query parsing with fallback
    let specialty: string | null = null;
    let location: string | null = null;
    let extractedName: { firstName: string | null; lastName: string | null } = { firstName: null, lastName: null };

    // First, try improved regex-based parsing
    const parsed = parseSearchQuery(query);
    extractedName = {
      firstName: parsed.firstName,
      lastName: parsed.lastName,
    };
    specialty = parsed.specialty;
    location = parsed.location;

    console.log('=== PARSED QUERY PARAMETERS ===');
    console.log('Parsed Name:', extractedName);
    console.log('Parsed Specialty:', specialty);
    console.log('Parsed Location:', location);

    // Try OpenAI extraction as enhancement (not required)
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log('=== OPENAI API DEBUG ===');
        console.log('OpenAI API Key Present:', !!process.env.OPENAI_API_KEY);
        console.log('OpenAI API Key Length:', process.env.OPENAI_API_KEY?.length || 0);
        
        const extractionPrompt = `You are a medical search assistant. Extract the following information from this search query: "${query}"

Return a JSON object with:
- firstName: First name if a person's name is mentioned (e.g., "John" from "Dr. John Smith" or "Mark" from "Mark L Nelson"). If not specified, return null
- lastName: Last name if a person's name is mentioned (e.g., "Smith" from "Dr. John Smith" or "Nelson" from "Mark L Nelson"). If not specified, return null
- specialty: The medical specialty mentioned (e.g., "Cardiology", "Retina Surgery", "Ophthalmology", "Primary Care"). If not specified, return null
- location: The location mentioned (city, state, or "City, State" format, e.g., "Tacoma, Washington" or "Tacoma Washington"). If not specified, return null

Only return valid JSON, no other text.`;

        console.log('OpenAI Extraction Prompt:', extractionPrompt);
        
        const startTime = Date.now();
        const extractionResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that extracts structured data from search queries. Always return valid JSON only.',
            },
            {
              role: 'user',
              content: extractionPrompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 200,
        });
        const responseTime = Date.now() - startTime;
        
        console.log('OpenAI API Response Time:', responseTime + 'ms');
        console.log('OpenAI Model Used:', extractionResponse.model);
        console.log('OpenAI Usage:', extractionResponse.usage);
        
        const rawContent = extractionResponse.choices[0].message.content || '{}';
        console.log('OpenAI Raw Response:', rawContent);
        
        const extractedData = JSON.parse(rawContent);
        console.log('OpenAI Parsed Data:', extractedData);
        
        // Use OpenAI results if they're better (non-null values)
        if (extractedData.firstName || extractedData.lastName) {
          extractedName = {
            firstName: extractedData.firstName || extractedName.firstName,
            lastName: extractedData.lastName || extractedName.lastName,
          };
          console.log('Updated name from OpenAI:', extractedName);
        }
        if (extractedData.specialty) {
          specialty = extractedData.specialty;
          console.log('Updated specialty from OpenAI:', specialty);
        }
        if (extractedData.location) {
          location = extractedData.location;
          console.log('Updated location from OpenAI:', location);
        }
      } catch (openaiError: any) {
        console.error('=== OPENAI API ERROR ===');
        console.error('Error Type:', openaiError.constructor.name);
        console.error('Error Message:', openaiError.message);
        console.error('Error Code:', (openaiError as any).code);
        console.error('Error Status:', (openaiError as any).status);
        console.error('Error Stack:', openaiError.stack);
        console.warn('OpenAI extraction failed, using regex parsing:', openaiError.message);
        // Continue with regex-based parsing results
      }
    } else {
      console.log('OpenAI API key not configured, skipping OpenAI extraction');
    }

    // Parse location into city and state
    const { city, state } = parseLocation(location);
    
    console.log('=== PARSED LOCATION ===');
    console.log('Original Location String:', location);
    console.log('Parsed City:', city);
    console.log('Parsed State:', state);

    // Validate segmented search requirements
    const validation = validateSearchParams(
      extractedName.firstName,
      extractedName.lastName,
      specialty,
      city,
      state
    );

    if (!validation.valid) {
      return res.status(400).json({
        query,
        specialty: specialty || 'Not specified',
        location: location,
        results: [],
        resultsCount: 0,
        error: validation.error,
        suggestions: [
          'Provide at least 2 of: name, specialty, or location',
          'Name alone is acceptable (e.g., "Dr. John Smith")',
          'Name + Specialty (e.g., "Dr. Smith Cardiologist")',
          'Name + Location (e.g., "Dr. Smith in Houston, TX")',
          'Specialty + Location (e.g., "Cardiologists in Houston, TX")',
        ],
      });
    }

    // Multi-stage fallback search strategy
    let nppesResults: NPPESProvider[] = [];
    let searchAttempt = 0;
    const maxAttempts = 4;

    // Attempt 1: Exact match with all parameters
    searchAttempt = 1;
    nppesResults = await searchNPPES(
      extractedName.firstName,
      extractedName.lastName,
      specialty,
      city,
      state
    );
    console.log(`Search attempt ${searchAttempt}: NPPES returned ${nppesResults.length} results`);

    // Attempt 2: Remove location constraint if no results
    if (nppesResults.length === 0 && (city || state)) {
      searchAttempt = 2;
      nppesResults = await searchNPPES(
        extractedName.firstName,
        extractedName.lastName,
        specialty,
        null,
        null
      );
      console.log(`Search attempt ${searchAttempt}: NPPES returned ${nppesResults.length} results (without location)`);
    }

    // Attempt 3: Try specialty-only search if we have specialty but no name
    if (nppesResults.length === 0 && specialty && (!extractedName.firstName && !extractedName.lastName)) {
      searchAttempt = 3;
      if (city || state) {
        nppesResults = await searchNPPES(
          null,
          null,
          specialty,
          city,
          state
        );
        console.log(`Search attempt ${searchAttempt}: NPPES returned ${nppesResults.length} results (specialty + location)`);
      }
    }

    // Attempt 4: Try with alternative specialty terms or broader searches
    if (nppesResults.length === 0) {
      searchAttempt = 4;
      
      // Try alternative specialty terms if available
      if (specialty && SPECIALTY_ALTERNATIVES[specialty]) {
        for (const altSpecialty of SPECIALTY_ALTERNATIVES[specialty]) {
          if (city || state) {
            nppesResults = await searchNPPES(
              extractedName.firstName,
              extractedName.lastName,
              altSpecialty,
              city,
              state
            );
            if (nppesResults.length > 0) {
              console.log(`Search attempt ${searchAttempt}: NPPES returned ${nppesResults.length} results (using alternative specialty: ${altSpecialty})`);
              break;
            }
          }
        }
      }
      
      // If still no results and we have a specialty, try searching with just location and specialty
      if (nppesResults.length === 0 && specialty && (city || state)) {
        nppesResults = await searchNPPES(
          null,
          null,
          specialty,
          city,
          state
        );
        console.log(`Search attempt ${searchAttempt}: NPPES returned ${nppesResults.length} results (specialty + location, no name)`);
      }
      
      // If still no results and we have name, try name + location only
      if (nppesResults.length === 0 && (extractedName.firstName || extractedName.lastName) && (city || state)) {
        nppesResults = await searchNPPES(
          extractedName.firstName,
          extractedName.lastName,
          null,
          city,
          state
        );
        console.log(`Search attempt ${searchAttempt}: NPPES returned ${nppesResults.length} results (name + location, no specialty)`);
      }
    }

    // Enhance with Google Places data
    let physicians: Array<{
      name: string;
      specialty: string;
      location: string;
      phone: string;
      rating: number;
      years_experience: number;
      npi?: string;
    }> = [];

    console.log('=== GOOGLE PLACES CONFIGURATION ===');
    console.log('Google Places API Key Present:', !!process.env.GOOGLE_PLACES_API_KEY);
    console.log('NPPES Results Count:', nppesResults.length);
    console.log('Will Enhance with Google Places:', nppesResults.length > 0 && !!process.env.GOOGLE_PLACES_API_KEY);

    if (nppesResults.length > 0 && process.env.GOOGLE_PLACES_API_KEY) {
      // Enhance up to 50 results with Google Places
      const doctorsToEnhance = nppesResults.slice(0, 50);
      const enhancedDoctors = await Promise.all(
        doctorsToEnhance.map(doctor => 
          enhanceWithGooglePlaces(doctor, process.env.GOOGLE_PLACES_API_KEY!)
        )
      );
      physicians = enhancedDoctors.filter((doc): doc is NonNullable<typeof doc> => doc !== null);
    } else if (nppesResults.length > 0) {
      // Use NPPES data only if Google Places is not available
      physicians = nppesResults.slice(0, 50).map(doctor => {
        const firstName = doctor.basic.first_name || '';
        const lastName = doctor.basic.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        const primaryAddress = doctor.addresses.find(addr => addr.address_purpose === 'LOCATION') || doctor.addresses[0];
        const primaryTaxonomy = doctor.taxonomies.find(tax => tax.primary) || doctor.taxonomies[0];
        const specialty = primaryTaxonomy?.desc || 'General Practice';
        const address = primaryAddress 
          ? `${primaryAddress.address_1 || ''}, ${primaryAddress.city || ''}, ${primaryAddress.state || ''} ${primaryAddress.postal_code || ''}`.trim()
          : 'Address not available';

        let yearsExperience = 10;
        if (doctor.basic.enumeration_date) {
          const enumDate = new Date(doctor.basic.enumeration_date);
          const yearsSinceEnum = new Date().getFullYear() - enumDate.getFullYear();
          yearsExperience = Math.max(5, Math.min(40, yearsSinceEnum + 5));
        }

        return {
          name: fullName,
          specialty: specialty,
          location: address,
          phone: primaryAddress?.telephone_number || 'Not available',
          rating: 0,
          years_experience: yearsExperience,
          npi: doctor.number,
        };
      });
    }

    // Handle no results with better error messages
    if (physicians.length === 0) {
      const suggestions: string[] = [];
      let errorMessage: string | null = null;
      
      // Provide specific error messages based on what was searched
      if (!extractedName.firstName && !extractedName.lastName && !specialty && !city && !state) {
        errorMessage = 'Please include a location (city, state, or zip code) for better results.';
        suggestions.push('Try including a doctor name, specialty, or location in your search');
        suggestions.push('Example: "retina surgeon in Tacoma, Washington"');
        suggestions.push('Example: "Dr. Mark Nelson retina surgeon"');
      } else if (!city && !state) {
        errorMessage = 'Please include a location (city, state, or zip code) for better results.';
        suggestions.push('Try adding a location to your search (e.g., "in Tacoma, Washington")');
        suggestions.push('Example: "' + (specialty || 'doctor') + ' in [your city], [your state]"');
      } else if (!specialty && !extractedName.firstName && !extractedName.lastName) {
        errorMessage = 'Try searching with a specialty (like "retina surgeon" or "cardiologist") or doctor name.';
        suggestions.push('Try adding a specialty to your search');
        suggestions.push('Example: "retina surgeon in ' + (city || state || 'your location') + '"');
        suggestions.push('Example: "Dr. [name] in ' + (city || state || 'your location') + '"');
      } else {
        // We have some parameters but still no results
        errorMessage = `No doctors found for "${query}". Try:`;
        suggestions.push('• Checking your spelling');
        suggestions.push('• Using a nearby city or different location');
        suggestions.push('• Searching for a related specialty');
        if (city || state) {
          suggestions.push(`• Expanding your search radius (currently ${searchRadius / 1000}km)`);
        }
        if (extractedName.firstName || extractedName.lastName) {
          suggestions.push('• Trying a partial name match (e.g., just last name)');
        }
        if (specialty) {
          suggestions.push('• Trying a broader specialty term');
        }
      }

      return res.status(200).json({
        query,
        specialty: specialty || 'Not specified',
        location: location,
        results: [],
        resultsCount: 0,
        error: errorMessage,
        suggestions: suggestions.length > 0 ? suggestions : null,
        searchRadius: (city || state) ? searchRadius : null,
      });
    }

    const resultsCount = physicians.length;

    // === FINAL RESULTS DEBUG ===
    console.log('=== SEARCH RESULTS SUMMARY ===');
    console.log('Total Physicians Found:', resultsCount);
    console.log('Final Parameters Used:', {
      firstName: extractedName.firstName,
      lastName: extractedName.lastName,
      specialty,
      city,
      state,
    });
    if (resultsCount > 0) {
      console.log('Sample Results:', physicians.slice(0, 3).map(p => ({
        name: p.name,
        specialty: p.specialty,
        location: p.location,
        phone: p.phone,
        rating: p.rating,
      })));
    } else {
      console.log('No results found - check API logs above for issues');
    }

    // Save to search history
    await sql`
      INSERT INTO search_history (user_id, query, specialty, location, results_count)
      VALUES (${userId}, ${query}, ${specialty || 'Not specified'}, ${location}, ${resultsCount})
    `;

    res.json({
      query,
      specialty: specialty || 'Not specified',
      location: location,
      results: physicians,
      resultsCount,
      searchRadius: (city || state) ? searchRadius : null,
    });
  } catch (error: any) {
    console.error('Search error:', error);
    
    // Provide more specific error messages
    if (error.status === 429 || error.code === 'insufficient_quota') {
      res.status(503).json({ 
        error: 'OpenAI API quota exceeded. Please check your OpenAI account billing or try again later.',
        details: 'The search service is temporarily unavailable due to API quota limits.'
      });
    } else if (error.message?.includes('API key')) {
      res.status(500).json({ 
        error: 'OpenAI API key is invalid or missing. Please check your server configuration.',
      });
    } else {
      res.status(500).json({ 
        error: 'Search failed. Please try again.',
        details: error.message || 'Unknown error occurred'
      });
    }
  }
});
