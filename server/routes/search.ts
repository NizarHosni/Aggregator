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

  const url = `${baseUrl}&${params.join('&')}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json() as NPPESResponse;
    return data.results || [];
  } catch (error) {
    console.error('NPPES API error:', error);
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
        const placesResponse = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${googleApiKey}`
        );
        const placesData = await placesResponse.json() as {
          results?: Array<{
            place_id?: string;
            formatted_address?: string;
            rating?: number;
          }>;
          status?: string;
        };

        if (placesData.results && placesData.results.length > 0) {
          const place = placesData.results[0];
          if (place.place_id) {
            // Get detailed info
            const detailsResponse = await fetch(
              `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,rating&key=${googleApiKey}`
            );
            const detailsData = await detailsResponse.json() as {
              result?: {
                formatted_phone_number?: string;
                rating?: number;
              };
            };

            if (detailsData.result) {
              if (detailsData.result.formatted_phone_number) {
                phone = detailsData.result.formatted_phone_number;
              }
              if (detailsData.result.rating) {
                rating = detailsData.result.rating;
              }
            }

            if (place.formatted_address) {
              googleAddress = place.formatted_address;
            }
          }
        }
      } catch (error) {
        console.warn(`Could not enhance with Google Places for ${fullName}:`, error);
        // Continue with NPPES data only
      }
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

// Parse name from query string
function parseName(query: string): { firstName: string | null; lastName: string | null } {
  // Try to extract name patterns like "Dr. John Smith" or "John Smith"
  const namePatterns = [
    /(?:dr\.?\s+)?([A-Z][a-z]+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /^([A-Z][a-z]+)\s+([A-Z][a-z]+)/,
  ];

  for (const pattern of namePatterns) {
    const match = query.match(pattern);
    if (match) {
      const parts = match[0].replace(/^dr\.?\s+/i, '').trim().split(/\s+/);
      if (parts.length >= 2) {
        return {
          firstName: parts[0],
          lastName: parts.slice(1).join(' '),
        };
      }
    }
  }

  return { firstName: null, lastName: null };
}

// Parse location from query (city, state)
function parseLocation(locationStr: string | null): { city: string | null; state: string | null } {
  if (!locationStr) return { city: null, state: null };

  // Try to parse "City, State" format
  const cityStateMatch = locationStr.match(/^([^,]+),\s*([A-Z]{2})$/i);
  if (cityStateMatch) {
    return {
      city: cityStateMatch[1].trim(),
      state: cityStateMatch[2].trim().toUpperCase(),
    };
  }

  // If it's just a state abbreviation
  if (/^[A-Z]{2}$/i.test(locationStr.trim())) {
    return { city: null, state: locationStr.trim().toUpperCase() };
  }

  // Otherwise treat as city
  return { city: locationStr.trim(), state: null };
}

// Validate segmented search requirements
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

  // Need at least 2 of 3 fields
  const fieldCount = [hasName, hasSpecialty, hasLocation].filter(Boolean).length;
  
  if (fieldCount < 2) {
    return {
      valid: false,
      error: 'Please provide at least 2 of the following: name, specialty, or location. Name alone is also acceptable.',
    };
  }

  // Specialty alone = NOT ALLOWED
  if (!hasName && hasSpecialty && !hasLocation) {
    return {
      valid: false,
      error: 'Specialty alone is not allowed. Please also provide a name or location.',
    };
  }

  // Location alone = NOT ALLOWED
  if (!hasName && !hasSpecialty && hasLocation) {
    return {
      valid: false,
      error: 'Location alone is not allowed. Please also provide a name or specialty.',
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

    // Use ChatGPT to extract search parameters
    let specialty: string | null = null;
    let location: string | null = null;
    let extractedName: { firstName: string | null; lastName: string | null } = { firstName: null, lastName: null };

    try {
      const extractionPrompt = `You are a medical search assistant. Extract the following information from this search query: "${query}"

Return a JSON object with:
- firstName: First name if a person's name is mentioned (e.g., "John" from "Dr. John Smith"). If not specified, return null
- lastName: Last name if a person's name is mentioned (e.g., "Smith" from "Dr. John Smith"). If not specified, return null
- specialty: The medical specialty mentioned (e.g., "Cardiology", "Orthopedic Surgery", "Primary Care"). If not specified, return null
- location: The location mentioned (city, state, or "City, State" format). If not specified, return null

Only return valid JSON, no other text.`;

      const extractionResponse = await openai.chat.completions.create({
        model: 'o4-mini-deep-research',
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
      });

      const extractedData = JSON.parse(extractionResponse.choices[0].message.content || '{}');
      extractedName = {
        firstName: extractedData.firstName || null,
        lastName: extractedData.lastName || null,
      };
      specialty = extractedData.specialty || null;
      location = extractedData.location || null;

      // Fallback: Try to parse name if not extracted
      if (!extractedName.firstName && !extractedName.lastName) {
        extractedName = parseName(query);
      }
    } catch (openaiError: any) {
      console.warn('OpenAI extraction failed, using fallback parsing:', openaiError.message);
      
      // Fallback: Simple regex-based extraction
      extractedName = parseName(query);
      
      const locationMatch = query.match(/\b(in|near|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s*,\s*[A-Z]{2})?)/i);
      if (locationMatch) {
        location = locationMatch[2];
      }
      
      // Try to detect common specialties
      const specialtyKeywords: { [key: string]: string } = {
        'cardiolog': 'Cardiology',
        'orthopedic': 'Orthopedic Surgery',
        'orthoped': 'Orthopedic Surgery',
        'dermatolog': 'Dermatology',
        'neurolog': 'Neurology',
        'pediatric': 'Pediatrics',
        'retina': 'Retina Surgery',
        'ophthalmolog': 'Ophthalmology',
        'primary care': 'Primary Care',
        'general practice': 'General Practice',
      };
      
      const queryLower = query.toLowerCase();
      for (const [keyword, spec] of Object.entries(specialtyKeywords)) {
        if (queryLower.includes(keyword)) {
          specialty = spec;
          break;
        }
      }
    }

    // Parse location into city and state
    const { city, state } = parseLocation(location);

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

    // Search NPPES database
    const nppesResults = await searchNPPES(
      extractedName.firstName,
      extractedName.lastName,
      specialty,
      city,
      state
    );

    console.log(`NPPES returned ${nppesResults.length} results`);

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

    // Handle no results
    if (physicians.length === 0) {
      const suggestions: string[] = [];
      
      if (!extractedName.firstName && !extractedName.lastName && !specialty && !city && !state) {
        suggestions.push('Try including a doctor name, specialty, or location in your search');
      } else {
        if (!extractedName.firstName && !extractedName.lastName) {
          suggestions.push('Try adding a doctor name to your search');
        }
        if (!specialty) {
          suggestions.push('Try specifying a medical specialty');
        }
        if (!city && !state) {
          suggestions.push('Try adding a location (city and state)');
        }
        suggestions.push('Try a different city or location');
        suggestions.push('Try a more general specialty term');
        if (city || state) {
          suggestions.push(`Expand your search radius (currently ${searchRadius / 1000}km)`);
        }
      }

      return res.status(200).json({
        query,
        specialty: specialty || 'Not specified',
        location: location,
        results: [],
        resultsCount: 0,
        error: null,
        suggestions: suggestions.length > 0 ? suggestions : null,
        searchRadius: (city || state) ? searchRadius : null,
      });
    }

    const resultsCount = physicians.length;

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
