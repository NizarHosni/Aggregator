import express from 'express';
import OpenAI from 'openai';
import {
  advancedNameMatching,
  enhancedLocationProcessing,
  expandSpecialtySearch,
  rankSearchResults,
  extractNameFromQuery,
  extractLocationFromQuery,
  matchSpecialty,
} from '../utils/searchUtils.js';
import {
  normalizeSpecialty,
  extractSpecialty,
  correctLocationTypo,
  suggestAlternativeSearches,
  isFuzzyMatch,
  normalizeState,
} from '../utils/searchAccuracy.js';
import { queryParser } from '../services/queryParser.js';
import { taxonomyResolver } from '../services/taxonomyResolver.js';
import { costMonitor } from '../services/costMonitor.js';
import { canPerformSearch, incrementSearchCount } from '../services/usageTracker.js';

export const searchRoutes = express.Router();

// Lazy-load OpenAI client to ensure env vars are loaded first
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
  state: string | null,
  taxonomyCode?: string | null
): Promise<NPPESProvider[]> {
  const baseUrl = 'https://npiregistry.cms.hhs.gov/api/?version=2.1';
  const params: string[] = [];

  if (firstName) params.push(`first_name=${encodeURIComponent(firstName)}`);
  if (lastName) params.push(`last_name=${encodeURIComponent(lastName)}`);
  
  // Use taxonomy code if provided, otherwise fallback to description
  if (taxonomyCode) {
    params.push(`taxonomy_code=${encodeURIComponent(taxonomyCode)}`);
  } else if (specialty) {
    params.push(`taxonomy_description=${encodeURIComponent(specialty)}`);
  }
  
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

// Get best specialty match from all NPPES taxonomies (not just primary)
function getBestSpecialtyMatch(nppesDoctor: NPPESProvider, querySpecialty: string | null): string {
  // If no query specialty, return primary
  if (!querySpecialty) {
    return nppesDoctor.taxonomies.find(tax => tax.primary)?.desc || 
           nppesDoctor.taxonomies[0]?.desc || 'General Practice';
  }
  
  const queryLower = querySpecialty.toLowerCase();
  
  // Check all taxonomies for direct matches
  for (const tax of nppesDoctor.taxonomies) {
    const taxDesc = tax.desc?.toLowerCase() || '';
    if (taxDesc.includes(queryLower) || queryLower.includes(taxDesc)) {
      return tax.desc || 'General Practice';
    }
  }
  
  // Check for subspecialty combinations
  const hasInternalMedicine = nppesDoctor.taxonomies.some(t => 
    t.desc?.toLowerCase().includes('internal medicine')
  );
  const hasCardiovascular = nppesDoctor.taxonomies.some(t => {
    const desc = t.desc?.toLowerCase() || '';
    return desc.includes('cardiovascular') || desc.includes('cardiac') || desc.includes('cardiology');
  });
  
  if (hasInternalMedicine && hasCardiovascular && queryLower.includes('cardio')) {
    return 'Cardiology'; // Override with better specialty
  }
  
  // Return primary as fallback
  return nppesDoctor.taxonomies.find(tax => tax.primary)?.desc || 
         nppesDoctor.taxonomies[0]?.desc || 'General Practice';
}

// Extract specialty from Google Places place name
function extractSpecialtyFromPlaceName(placeName: string): string | null {
  const specialtyPatterns = [
    { keywords: ['interventional cardiology', 'cardiology', 'cardiologist'], specialty: 'Cardiology' },
    { keywords: ['retina', 'retinal', 'vitreoretinal'], specialty: 'Retina Specialist' },
    { keywords: ['cardiac surgery', 'cardiothoracic', 'heart surgeon'], specialty: 'Cardiac Surgery' },
    { keywords: ['ophthalmology', 'ophthalmologist'], specialty: 'Ophthalmology' },
    { keywords: ['dermatology', 'dermatologist'], specialty: 'Dermatology' },
    { keywords: ['orthopedic', 'orthopaedic'], specialty: 'Orthopedic Surgery' },
    { keywords: ['neurology', 'neurologist'], specialty: 'Neurology' },
    { keywords: ['oncology', 'oncologist'], specialty: 'Oncology' },
  ];
  
  const nameLower = placeName.toLowerCase();
  for (const pattern of specialtyPatterns) {
    if (pattern.keywords.some(keyword => nameLower.includes(keyword))) {
      return pattern.specialty;
    }
  }
  return null;
}

// Enhance NPPES data with Google Places info
async function enhanceWithGooglePlaces(
  nppesDoctor: NPPESProvider,
  googleApiKey: string,
  querySpecialty: string | null = null
): Promise<{
  name: string;
  specialty: string;
  location: string;
  phone: string;
  rating: number;
  years_experience: number;
  npi?: string;
  google_place_id?: string | null;
  healthgrades_id?: string | null;
  website?: string | null;
  photo_url?: string | null;
  photo_verified?: boolean;
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

    // Get best specialty match from all taxonomies
    let specialty = getBestSpecialtyMatch(nppesDoctor, querySpecialty);

    // Try to find doctor in Google Places
    let phone = primaryAddress.telephone_number || 'Not available';
    let rating = 0;
    let googleAddress = fullAddress;
    let photoUrl: string | null = null;
    let website: string | null = null;
    let googlePlaceId: string | null = null;

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
          
          // Extract specialty from Google Places place name
          let googleSpecialty: string | null = null;
          if (place.name) {
            googleSpecialty = extractSpecialtyFromPlaceName(place.name);
            if (googleSpecialty) {
              console.log('Extracted specialty from Google Places:', googleSpecialty);
            }
          }
          
          if (place.place_id) {
            // Get detailed info including photos
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,rating,photos,website&key=${googleApiKey}`;
            
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
                photos?: Array<{
                  photo_reference: string;
                  height?: number;
                  width?: number;
                }>;
                website?: string;
              };
              status?: string;
              error_message?: string;
            };

            console.log('Google Places Details Response:', {
              status: detailsData.status,
              has_phone: !!detailsData.result?.formatted_phone_number,
              has_rating: !!detailsData.result?.rating,
              has_photos: !!detailsData.result?.photos?.length,
              has_website: !!detailsData.result?.website,
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
              // Extract photo URL
              if (detailsData.result.photos && detailsData.result.photos.length > 0) {
                const photoReference = detailsData.result.photos[0].photo_reference;
                photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${googleApiKey}`;
                console.log('Extracted photo URL from Google Places');
              }
              // Extract website
              if (detailsData.result.website) {
                website = detailsData.result.website;
                console.log('Extracted website from Google Places:', website);
              }
            }

            if (place.formatted_address) {
              googleAddress = place.formatted_address;
              console.log('Updated address from Google Places:', googleAddress);
            }
            // Store place ID for later use
            googlePlaceId = place.place_id;
          }
          
          // Use Google Places specialty when it matches query better than NPPES
          if (googleSpecialty) {
            const nppesSpecialty = getBestSpecialtyMatch(nppesDoctor, querySpecialty);
            const googleMatch = matchSpecialty(googleSpecialty, googleSpecialty); // Self-match = 100
            const nppesMatch = matchSpecialty(googleSpecialty, nppesSpecialty);
            
            if (googleMatch > nppesMatch || nppesSpecialty.toLowerCase().includes('internal medicine')) {
              specialty = googleSpecialty; // Use Google Places specialty
              console.log('Using Google Places specialty:', specialty, 'instead of NPPES:', nppesSpecialty);
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
      specialty: specialty, // This now uses Google Places specialty if better
      location: googleAddress || fullAddress,
      phone: phone,
      rating: rating,
      years_experience: yearsExperience,
      npi: nppesDoctor.number,
      google_place_id: googlePlaceId,
      healthgrades_id: null, // Not currently extracted from Google Places
      website: website,
      photo_url: photoUrl,
      photo_verified: false, // Google Places photos are not "verified" by us
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

// Comprehensive specialty mapping with all variations
const SPECIALTY_MAP: { [key: string]: string } = {
  // OPHTHALMOLOGY VARIATIONS
  'ophthalmology': 'Ophthalmology',
  'ophthalmologie': 'Ophthalmology',
  'ophthalmologist': 'Ophthalmology',
  'ophthalmologists': 'Ophthalmology',
  'eye doctor': 'Ophthalmology',
  'eye doctors': 'Ophthalmology',
  'eye specialist': 'Ophthalmology',
  'eye specialists': 'Ophthalmology',
  'ocular': 'Ophthalmology',
  'ocular specialist': 'Ophthalmology',
  
  // RETINA SURGERY VARIATIONS
  'retina': 'Retina Surgery',
  'retina surgeon': 'Retina Surgery',
  'retina surgeons': 'Retina Surgery',
  'retina specialist': 'Retina Surgery',
  'retina specialists': 'Retina Surgery',
  'retinal': 'Retina Surgery',
  'retinal surgeon': 'Retina Surgery',
  'retinal surgeons': 'Retina Surgery',
  'retinal specialist': 'Retina Surgery',
  'vitreoretinal': 'Retina Surgery',
  'vitreoretinal surgeon': 'Retina Surgery',
  'vitreoretinal surgeons': 'Retina Surgery',
  'macula specialist': 'Retina Surgery',
  'macular specialist': 'Retina Surgery',
  
  // CARDIOLOGY VARIATIONS
  'cardiology': 'Cardiology',
  'cardiologist': 'Cardiology',
  'cardiologists': 'Cardiology',
  'heart doctor': 'Cardiology',
  'heart doctors': 'Cardiology',
  'cardiac specialist': 'Cardiology',
  'cardiac specialists': 'Cardiology',
  'heart specialist': 'Cardiology',
  'heart specialists': 'Cardiology',
  'cardiovascular': 'Cardiology',
  'cardiovascular disease': 'Cardiology',
  
  // DERMATOLOGY VARIATIONS
  'dermatology': 'Dermatology',
  'dermatologist': 'Dermatology',
  'dermatologists': 'Dermatology',
  'skin doctor': 'Dermatology',
  'skin doctors': 'Dermatology',
  'skin specialist': 'Dermatology',
  'skin specialists': 'Dermatology',
  'dermatologic': 'Dermatology',
  'dermatologic surgery': 'Dermatology',
  'mohs surgery': 'Dermatology',
  'cosmetic dermatology': 'Dermatology',
  
  // ORTHOPEDICS VARIATIONS
  'orthopedics': 'Orthopedic Surgery',
  'orthopedic': 'Orthopedic Surgery',
  'orthoped': 'Orthopedic Surgery',
  'orthopaedic': 'Orthopedic Surgery',
  'orthopedic surgeon': 'Orthopedic Surgery',
  'orthopedic surgeons': 'Orthopedic Surgery',
  'orthopaedic surgeon': 'Orthopedic Surgery',
  'bone doctor': 'Orthopedic Surgery',
  'bone doctors': 'Orthopedic Surgery',
  'ortho': 'Orthopedic Surgery',
  
  // PEDIATRICS VARIATIONS
  'pediatrics': 'Pediatrics',
  'pediatric': 'Pediatrics',
  'pediatrician': 'Pediatrics',
  'pediatricians': 'Pediatrics',
  'children doctor': 'Pediatrics',
  'children doctors': 'Pediatrics',
  'kid doctor': 'Pediatrics',
  'kid doctors': 'Pediatrics',
  'pediatric specialist': 'Pediatrics',
  
  // NEUROLOGY VARIATIONS
  'neurology': 'Neurology',
  'neurologist': 'Neurology',
  'neurologists': 'Neurology',
  'brain doctor': 'Neurology',
  'brain doctors': 'Neurology',
  'nerve specialist': 'Neurology',
  'nerve specialists': 'Neurology',
  'neurological': 'Neurology',
  
  // PRIMARY CARE VARIATIONS
  'primary care': 'Primary Care',
  'primary care physician': 'Primary Care',
  'primary care physicians': 'Primary Care',
  'pcm': 'Primary Care',
  'pcp': 'Primary Care',
  
  // FAMILY MEDICINE VARIATIONS
  'family medicine': 'Family Medicine',
  'family doctor': 'Family Medicine',
  'family doctors': 'Family Medicine',
  'family physician': 'Family Medicine',
  'family physicians': 'Family Medicine',
  'family practitioner': 'Family Medicine',
  'family practitioners': 'Family Medicine',
  
  // GENERAL PRACTICE VARIATIONS
  'general practice': 'General Practice',
  'general practitioner': 'General Practice',
  'general practitioners': 'General Practice',
  'gp': 'General Practice',
  'gps': 'General Practice',
  
  // INTERNAL MEDICINE VARIATIONS
  'internal medicine': 'Internal Medicine',
  'internist': 'Internal Medicine',
  'internists': 'Internal Medicine',
  
  // ADDITIONAL SPECIALTIES
  'urology': 'Urology',
  'urologist': 'Urology',
  'urologists': 'Urology',
  'gastroenterology': 'Gastroenterology',
  'gastroenterologist': 'Gastroenterology',
  'gastroenterologists': 'Gastroenterology',
  'gi doctor': 'Gastroenterology',
  'gi specialist': 'Gastroenterology',
  'oncology': 'Oncology',
  'oncologist': 'Oncology',
  'oncologists': 'Oncology',
  'cancer doctor': 'Oncology',
  'cancer specialist': 'Oncology',
  'psychiatry': 'Psychiatry',
  'psychiatrist': 'Psychiatry',
  'psychiatrists': 'Psychiatry',
  'psychology': 'Psychiatry',
  'psychologist': 'Psychiatry',
  'psychologists': 'Psychiatry',
  'psychiatric': 'Psychiatry',
  'anesthesiology': 'Anesthesiology',
  'anesthesiologist': 'Anesthesiology',
  'anesthesiologists': 'Anesthesiology',
  'anesthesia': 'Anesthesiology',
  'radiology': 'Radiology',
  'radiologist': 'Radiology',
  'radiologists': 'Radiology',
  'pathology': 'Pathology',
  'pathologist': 'Pathology',
  'pathologists': 'Pathology',
  'emergency medicine': 'Emergency Medicine',
  'er doctor': 'Emergency Medicine',
  'emergency physician': 'Emergency Medicine',
  'emergency physicians': 'Emergency Medicine',
  'obstetrics': 'Obstetrics and Gynecology',
  'obgyn': 'Obstetrics and Gynecology',
  'ob-gyn': 'Obstetrics and Gynecology',
  'gynecology': 'Obstetrics and Gynecology',
  'gynecologist': 'Obstetrics and Gynecology',
  'gynecologists': 'Obstetrics and Gynecology',
  'obstetrician': 'Obstetrics and Gynecology',
  'obstetricians': 'Obstetrics and Gynecology',
  'endocrinology': 'Endocrinology',
  'endocrinologist': 'Endocrinology',
  'endocrinologists': 'Endocrinology',
  'diabetes doctor': 'Endocrinology',
  'diabetes specialist': 'Endocrinology',
  'pulmonology': 'Pulmonology',
  'pulmonologist': 'Pulmonology',
  'pulmonologists': 'Pulmonology',
  'lung doctor': 'Pulmonology',
  'lung specialist': 'Pulmonology',
  'rheumatology': 'Rheumatology',
  'rheumatologist': 'Rheumatology',
  'rheumatologists': 'Rheumatology',
  'nephrology': 'Nephrology',
  'nephrologist': 'Nephrology',
  'nephrologists': 'Nephrology',
  'kidney doctor': 'Nephrology',
  'kidney specialist': 'Nephrology',
};

// Reverse mapping for quick lookup (variation -> canonical)
const SPECIALTY_SYNONYMS: { [key: string]: string } = {};
Object.entries(SPECIALTY_MAP).forEach(([variation, canonical]) => {
  SPECIALTY_SYNONYMS[variation.toLowerCase()] = canonical;
  // Also add canonical itself
  SPECIALTY_SYNONYMS[canonical.toLowerCase()] = canonical;
});

// Broader specialty categories for fallback searches
const BROADER_SPECIALTY_MAP: { [key: string]: string } = {
  'Retina Surgery': 'Ophthalmology',
  'Vitreoretinal Surgery': 'Ophthalmology',
  'Cataract Surgery': 'Ophthalmology',
  'Cornea Specialist': 'Ophthalmology',
  'Glaucoma Specialist': 'Ophthalmology',
  'Interventional Cardiology': 'Cardiology',
  'Electrophysiology': 'Cardiology',
  'Cardiac Surgery': 'Cardiology',
  'Cosmetic Dermatology': 'Dermatology',
  'Dermatologic Surgery': 'Dermatology',
  'Mohs Surgery': 'Dermatology',
};

// Related specialties for search expansion
const RELATED_SPECIALTIES: { [key: string]: string[] } = {
  'Ophthalmology': ['Retina Surgery', 'Cataract Surgery', 'Cornea Specialist', 'Glaucoma Specialist', 'Vitreoretinal Surgery'],
  'Retina Surgery': ['Ophthalmology', 'Vitreoretinal Surgery'],
  'Cardiology': ['Interventional Cardiology', 'Electrophysiology', 'Cardiac Surgery', 'Cardiovascular Disease'],
  'Dermatology': ['Cosmetic Dermatology', 'Dermatologic Surgery', 'Mohs Surgery'],
  'Orthopedic Surgery': ['Sports Medicine', 'Orthopedic Trauma', 'Joint Replacement'],
  'Primary Care': ['Family Medicine', 'General Practice', 'Internal Medicine'],
  'Family Medicine': ['Primary Care', 'General Practice'],
  'General Practice': ['Primary Care', 'Family Medicine'],
};

// Alternative specialty terms for fallback searches (legacy support)
const SPECIALTY_ALTERNATIVES: { [key: string]: string[] } = {
  'Retina Surgery': ['Ophthalmology', 'Retina', 'Vitreoretinal Surgery'],
  'Ophthalmology': ['Retina Surgery', 'Eye', 'Ocular'],
  'Cardiology': ['Cardiovascular Disease', 'Interventional Cardiology'],
  'Orthopedic Surgery': ['Orthopedic', 'Orthopedics', 'Sports Medicine'],
  'Dermatology': ['Cosmetic Dermatology', 'Dermatologic Surgery'],
  'Primary Care': ['Family Medicine', 'General Practice', 'Internal Medicine'],
  'Family Medicine': ['Primary Care', 'General Practice'],
  'General Practice': ['Primary Care', 'Family Medicine'],
};

// Location name fixes / normalization rules
const LOCATION_FIXES: Record<string, string> = {
  'tukwilla': 'Tukwila, WA',
  'tukwillla': 'Tukwila, WA',
  'tukwila': 'Tukwila, WA',
  'seattle area': 'Seattle, WA',
  'tacoma wa': 'Tacoma, WA',
  'kopstein tukwilla': 'Tukwila, WA',
  'los angeles ca': 'Los Angeles, CA',
  'san fran': 'San Francisco, CA',
  'nyc': 'New York, NY',
};

// Common city/state aliases for strict matching
const LOCATION_ALIAS_MAP: Record<string, string> = {
  'tukwila': 'tukwila',
  'tukwilla': 'tukwila',
  'seattle area': 'seattle',
  'los angeles': 'los angeles',
  'la': 'los angeles',
  'nyc': 'new york',
  'new york city': 'new york',
};

// String similarity function for fuzzy matching
function stringSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  return (longerLength - editDistance(longer, shorter)) / longerLength;
}

// Edit distance (Levenshtein distance) calculation
function editDistance(s1: string, s2: string): number {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

// Extract specialty from query with fuzzy matching
function extractSpecialtyFromQuery(query: string): string | null {
  const queryLower = query.toLowerCase();
  
  // First, try direct match (exact or substring)
  for (const [variation, canonical] of Object.entries(SPECIALTY_SYNONYMS)) {
    if (queryLower.includes(variation)) {
      return canonical;
    }
  }
  
  // If no direct match, try fuzzy matching on individual words
  const words = queryLower.split(/\s+/).filter(w => w.length > 2); // Filter out short words
  for (const word of words) {
    for (const [variation, canonical] of Object.entries(SPECIALTY_SYNONYMS)) {
      const similarity = stringSimilarity(word, variation);
      if (similarity > 0.75) { // 75% similarity threshold
        return canonical;
      }
    }
  }
  
  // Try multi-word combinations (e.g., "retina surgeon")
  for (let i = 0; i < words.length - 1; i++) {
    const twoWord = `${words[i]} ${words[i + 1]}`;
    for (const [variation, canonical] of Object.entries(SPECIALTY_SYNONYMS)) {
      if (variation.includes(twoWord) || twoWord.includes(variation)) {
        return canonical;
      }
      const similarity = stringSimilarity(twoWord, variation);
      if (similarity > 0.7) {
        return canonical;
      }
    }
  }
  
  return null;
}

// Get broader specialty category
function getBroaderSpecialty(specialty: string): string | null {
  return BROADER_SPECIALTY_MAP[specialty] || null;
}

// Get related specialties for search expansion
function getRelatedSpecialties(specialty: string): string[] {
  return RELATED_SPECIALTIES[specialty] || [];
}

function normalizeLocationString(location: string | null): string | null {
  if (!location) return null;
  const trimmed = location.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (LOCATION_FIXES[lower]) {
    return LOCATION_FIXES[lower];
  }
  return trimmed.replace(/\s{2,}/g, ' ');
}

function canonicalizeLocationTerm(value: string | null): string | null {
  if (!value) return null;
  const lower = value.toLowerCase().trim();
  if (!lower) return null;
  if (LOCATION_ALIAS_MAP[lower]) {
    return LOCATION_ALIAS_MAP[lower];
  }
  return lower;
}

function extractCityStateFromAddress(address: string | null): { city: string | null; state: string | null } {
  if (!address) return { city: null, state: null };
  const cityStateMatch = address.match(/([A-Za-z\s]+),\s*([A-Z]{2})/);
  if (cityStateMatch) {
    return {
      city: cityStateMatch[1].trim(),
      state: cityStateMatch[2].trim(),
    };
  }
  const parts = address.split(',');
  if (parts.length >= 2) {
    return {
      city: parts[parts.length - 2]?.trim() || null,
      state: parts[parts.length - 1]?.trim().split(' ')[0] || null,
    };
  }
  return { city: null, state: null };
}

// Strict function to check if doctor is actively licensed
function isActiveLicensedDoctor(provider: NPPESProvider): boolean {
  // Check enumeration status - must be 'A' (Active)
  if (provider.basic?.status !== 'A') {
    return false;
  }
  
  // Check if deactivated (no recent updates in 5+ years is suspicious)
  const lastUpdated = provider.basic?.last_updated;
  if (lastUpdated) {
    const yearsOld = (Date.now() - new Date(lastUpdated).getTime()) / (365 * 24 * 60 * 60 * 1000);
    if (yearsOld > 5) {
      return false; // No updates in 5+ years suggests inactive
    }
  }
  
  // Must have valid practice address (LOCATION purpose)
  const practiceAddress = provider.addresses?.find(a => a.address_purpose === 'LOCATION');
  if (!practiceAddress?.address_1) {
    return false; // No practice address means not actively practicing
  }
  
  // Must have basic name info
  if (!provider.basic?.first_name || !provider.basic?.last_name) {
    return false;
  }
  
  return true;
}

function filterActiveNppesResults(doctors: NPPESProvider[]): NPPESProvider[] {
  return doctors.filter(isActiveLicensedDoctor);
}

function filterPhysiciansByLocation(
  physicians: Array<{
    name: string;
    specialty: string;
    location: string;
    phone: string;
    rating: number;
    years_experience: number;
    npi?: string;
  }>,
  searchCity: string | null,
  searchState: string | null,
  searchLocation: string | null
) {
  if (!searchCity && !searchState && !searchLocation) {
    return physicians;
  }

  const canonicalSearchCity = canonicalizeLocationTerm(searchCity);
  const canonicalSearchLocation = canonicalizeLocationTerm(searchLocation);
  const targetState = searchState?.toLowerCase();

  return physicians.filter((doctor) => {
    const { city: doctorCity, state: doctorState } = extractCityStateFromAddress(doctor.location);
    const doctorCityCanonical = canonicalizeLocationTerm(doctorCity);
    const doctorStateLower = doctorState?.toLowerCase();

    if (targetState && doctorStateLower && targetState !== doctorStateLower.toLowerCase()) {
      return false;
    }

    if (canonicalSearchCity && doctorCityCanonical) {
      if (doctorCityCanonical.includes(canonicalSearchCity) || canonicalSearchCity.includes(doctorCityCanonical)) {
        return true;
      }
    }

    if (canonicalSearchLocation) {
      const doctorLocationLower = doctor.location.toLowerCase();
      if (
        doctorLocationLower.includes(canonicalSearchLocation) ||
        (doctorCityCanonical && canonicalSearchLocation.includes(doctorCityCanonical))
      ) {
        return true;
      }
    }

    return !searchCity && !searchLocation;
  });
}

// Parse name from query string (handles middle initials)
function parseName(query: string): { firstName: string | null; lastName: string | null } {
  // Remove common prefixes
  let cleaned = query.replace(/^(dr\.?|doctor)\s+/i, '').trim();
  
  // CRITICAL FIX: Remove specialty keywords BEFORE parsing name
  // This prevents "Mark Nelson surgeon" from being parsed as lastName="Nelson surgeon"
  const specialtyStopWords = [
    'surgeon', 'surgery', 'specialist', 'doctor', 'physician', 'md', 'do', 'dds', 'dpm',
    'ophthalmologist', 'ophthalmology', 'cardiologist', 'cardiology', 'dermatologist', 
    'dermatology', 'neurologist', 'neurology', 'oncologist', 'oncology',
    'orthopedic', 'orthopedics', 'pediatrician', 'pediatrics',
    'retina', 'retinal', 'vitreoretinal', 'cataract', 'glaucoma',
    'eye', 'heart', 'skin', 'bone', 'brain', 'cancer'
  ];
  
  // Find the first occurrence of a specialty keyword and truncate there
  const lowerCleaned = cleaned.toLowerCase();
  let cutoffIndex = -1;
  
  for (const stopWord of specialtyStopWords) {
    const index = lowerCleaned.indexOf(stopWord);
    if (index !== -1) {
      if (cutoffIndex === -1 || index < cutoffIndex) {
        cutoffIndex = index;
      }
    }
  }
  
  if (cutoffIndex !== -1) {
    cleaned = cleaned.substring(0, cutoffIndex).trim();
  }
  
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
        lastName: words[2], // Just the next word after middle initial
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
    
    // For 3+ words, take first as first name, second as last name
    // This prevents specialty words from being included in the name
    return {
      firstName: words[0],
      lastName: words[1], // Just take the second word to be safe
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
    // Normalize state using our utility function
    const normalizedState = normalizeState(statePart);
    const state = normalizedState.length === 2 
      ? normalizedState.toUpperCase() 
      : STATE_MAP[normalizedState.toLowerCase()] || normalizedState;
    return { city, state: state.toUpperCase() };
  }

  // Try to parse "City State" format (e.g., "tacoma washington")
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    // Check if last word is a state
    const lastWord = words[words.length - 1];
    const normalizedState = normalizeState(lastWord);
    const state = STATE_MAP[normalizedState.toLowerCase()] || (normalizedState.length === 2 ? normalizedState.toUpperCase() : null);
    
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

  // Extract specialty using improved matching (direct + fuzzy)
  const extractedSpecialty = extractSpecialtyFromQuery(query);
  if (extractedSpecialty) {
    specialty = extractedSpecialty;
    // Remove specialty keywords from query to help with name extraction
    const specialtyKeywords = Object.keys(SPECIALTY_MAP).filter(
      key => SPECIALTY_MAP[key] === extractedSpecialty
    );
    for (const keyword of specialtyKeywords) {
      query = query.replace(new RegExp(`\\b${keyword}\\b`, 'gi'), '').trim();
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

// AI-powered physician search with NPPES integration (NO AUTH REQUIRED)
searchRoutes.post('/physicians', async (req, res) => {
  try {
    const { query, radius, page = 1, pageSize = 15 } = req.body;
    
    // Default radius is 5km (5000 meters), max 50km
    const searchRadius = radius && typeof radius === 'number' && radius > 0 && radius <= 50000 
      ? radius 
      : 5000;
    
    // Pagination parameters
    const currentPage = Math.max(1, parseInt(String(page)) || 1);
    const resultsPerPage = Math.min(50, Math.max(5, parseInt(String(pageSize)) || 15));
    const offset = (currentPage - 1) * resultsPerPage;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Check subscription limits (for logged-in users)
    const userId = req.user?.id || null;
    const searchCheck = await canPerformSearch(userId);
    
    if (!searchCheck.allowed) {
      return res.status(403).json({
        error: searchCheck.reason || 'Search limit reached',
        usage: searchCheck.usage,
        upgradeRequired: true,
      });
    }

    // OpenAI API key is optional - will use fallback parsing if not available
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

    // === API DEBUG LOG ===
    console.log('=== SEARCH REQUEST DEBUG ===');
    console.log('Original Query:', query);
    console.log('Search Radius:', searchRadius, 'meters');

    // === INTELLIGENT QUERY PARSING ===
    console.log('=== INTELLIGENT QUERY PARSING ===');
    const parseStartTime = Date.now();
    
    let parsedQuery;
    if (hasOpenAIKey) {
      try {
        parsedQuery = await queryParser.parse(query);
        const parseTime = Date.now() - parseStartTime;
        console.log(`Query parsing completed in ${parseTime}ms`);
        console.log('Parsed Query:', JSON.stringify(parsedQuery, null, 2));
        
        // Record cost for query parsing (check cache stats)
        const parserStats = queryParser.getStats();
        const wasCached = parserStats.cacheHits > 0;
        costMonitor.recordQueryParsing(true, wasCached);
      } catch (error) {
        console.error('Query parsing error, using fallback:', error);
        // Fallback to basic parsing if GPT fails
        parsedQuery = {
          name: null,
          specialty: extractSpecialty(query) || extractSpecialtyFromQuery(query) || null,
          location: null,
          search_type: 'specialty_search' as const,
          confidence: 0.5,
        };
        costMonitor.recordQueryParsing(false, false);
      }
    } else {
      console.log('OpenAI API key not configured, using fallback parsing');
      // Fallback to regex-based parsing
      const parsed = parseSearchQuery(query);
      parsedQuery = {
        name: parsed.firstName || parsed.lastName ? {
          first: parsed.firstName,
          last: parsed.lastName,
          middle: null,
        } : null,
        specialty: parsed.specialty || extractSpecialty(query) || extractSpecialtyFromQuery(query) || null,
        location: parsed.location ? {
          city: null,
          state: null,
          full: parsed.location,
        } : null,
        search_type: 'combined' as const,
        confidence: 0.6,
      };
      costMonitor.recordQueryParsing(false, false);
    }

    // Extract parsed data
    let extractedName: { firstName: string | null; lastName: string | null } = {
      firstName: parsedQuery.name?.first || null,
      lastName: parsedQuery.name?.last || null,
    };
    
    let specialty: string | null = parsedQuery.specialty;
    let location: string | null = parsedQuery.location?.full || null;
    let city: string | null = parsedQuery.location?.city || null;
    let state: string | null = parsedQuery.location?.state || null;

    // Resolve taxonomy codes for specialty
    let taxonomyMapping = null;
    if (specialty) {
      console.log('=== TAXONOMY RESOLUTION ===');
      const taxonomyStartTime = Date.now();
      
      try {
        taxonomyMapping = await taxonomyResolver.resolve(specialty);
        const taxonomyTime = Date.now() - taxonomyStartTime;
        console.log(`Taxonomy resolution completed in ${taxonomyTime}ms`);
        console.log('Taxonomy Mapping:', JSON.stringify(taxonomyMapping, null, 2));
        
        // Record cost for taxonomy resolution (check cache stats)
        const resolverStats = taxonomyResolver.getStats();
        const wasCached = resolverStats.cacheHits > 0;
        costMonitor.recordTaxonomyResolution(taxonomyMapping?.usedGPT4 || false, wasCached);
      } catch (error) {
        console.error('Taxonomy resolution error:', error);
        // Continue without taxonomy mapping - will use description search
        costMonitor.recordTaxonomyResolution(false, false);
      }
    }

    // Apply location corrections
    if (location) {
      location = correctLocationTypo(location);
      location = enhancedLocationProcessing(location);
    }
    if (city) {
      city = correctLocationTypo(city);
    }

    console.log('=== PARSED QUERY PARAMETERS ===');
    console.log('Parsed Name:', extractedName);
    console.log('Parsed Specialty:', specialty);
    console.log('Taxonomy Codes:', taxonomyMapping ? {
      primary: taxonomyMapping.primary,
      secondary: taxonomyMapping.secondary,
      confidence: taxonomyMapping.confidence,
    } : 'None');
    console.log('Parsed Location:', location);
    console.log('City:', city, 'State:', state);

    // GPT-FIRST STRATEGY DISABLED: Prevents AI hallucinations - use NPPES database only!
    // GPT should ONLY parse queries, NEVER suggest doctor names
    let gptSuggestedDoctors: Array<{
      firstName: string;
      lastName: string;
      specialty?: string;
      location?: string;
      confidence: number;
    }> = [];
    
    if (false && process.env.OPENAI_API_KEY) { // DISABLED to prevent fake doctors
      try {
        console.log('=== GPT-FIRST DOCTOR SEARCH ===');
        console.log('Query:', query);
        
        const gptSearchPrompt = `You are a medical search assistant. Based on this search query: "${query}"

Analyze the query and suggest potential doctors that might match. Return a JSON array of doctor candidates with:
- firstName: First name (required)
- lastName: Last name (required)  
- specialty: Medical specialty if mentioned (e.g., "Ophthalmology", "Retina Surgery", "Cardiology")
- location: Location if mentioned (city, state format like "Tukwila, WA" or "Seattle, Washington")
- confidence: Your confidence level 0-100 that this doctor exists and matches the query

IMPORTANT:
1. If a specific doctor name is mentioned (e.g., "Andrew Kopstein"), include that exact name
2. If only specialty + location is mentioned, suggest 2-3 potential doctor names that might exist in that area
3. Normalize location names (e.g., "Tukwilla" → "Tukwila, WA")
4. Normalize specialty terms (e.g., "eye surgeon" → "Ophthalmology")
5. Return an array even if only one doctor is found

Example response:
[
  {
    "firstName": "Andrew",
    "lastName": "Kopstein",
    "specialty": "Ophthalmology",
    "location": "Tukwila, WA",
    "confidence": 95
  }
]

Return ONLY valid JSON array, no other text.`;

        const startTime = Date.now();
        const openaiClient = getOpenAIClient();
        const gptResponse = await openaiClient.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a medical search assistant. Always return valid JSON arrays only. Help users find doctors by suggesting potential matches based on their search queries.',
            },
            {
              role: 'user',
              content: gptSearchPrompt,
            },
          ],
          temperature: 0.2, // Lower temperature for more consistent results
          max_tokens: 500,
        });
        const responseTime = Date.now() - startTime;
        
        console.log('GPT Search Response Time:', responseTime + 'ms');
        console.log('GPT Model Used:', gptResponse.model);
        
        const rawContent = gptResponse.choices[0].message.content || '[]';
        console.log('GPT Raw Response:', rawContent);
        
        // Parse GPT response
        let parsedContent: any;
        try {
          parsedContent = JSON.parse(rawContent);
        } catch (parseError) {
          // Try to extract JSON from markdown code blocks
          const jsonMatch = rawContent.match(/```(?:json)?\s*(\[.*?\])\s*```/s);
          const matchedJson = jsonMatch?.[1];
          if (matchedJson) {
            try {
              parsedContent = JSON.parse(matchedJson as string);
            } catch {
              throw new Error('Failed to parse GPT response as JSON');
            }
          } else {
            throw new Error('Failed to parse GPT response as JSON');
          }
        }
        
        // Ensure it's an array
        if (Array.isArray(parsedContent)) {
          gptSuggestedDoctors = parsedContent.filter((doc: any) => 
            doc.firstName && doc.lastName && doc.confidence >= 50
          );
          console.log(`GPT suggested ${gptSuggestedDoctors.length} potential doctors:`, gptSuggestedDoctors);
        } else if (parsedContent?.firstName && parsedContent?.lastName) {
          // Single doctor object instead of array
          gptSuggestedDoctors = [parsedContent];
          console.log('GPT suggested 1 potential doctor:', gptSuggestedDoctors);
        }
        
        // Also extract structured data for fallback NPPES search
        if (gptSuggestedDoctors.length > 0) {
          const topSuggestion = gptSuggestedDoctors[0];
          extractedName = {
            firstName: topSuggestion.firstName || extractedName.firstName,
            lastName: topSuggestion.lastName || extractedName.lastName,
          };
          const specialtyStr = topSuggestion.specialty;
          if (specialtyStr && typeof specialtyStr === 'string') {
            const normalizedSpecialty = extractSpecialtyFromQuery(specialtyStr as string);
            specialty = normalizedSpecialty || (specialtyStr as string);
          }
          const locationStr = topSuggestion.location;
          if (locationStr && typeof locationStr === 'string') {
            const processed = enhancedLocationProcessing(locationStr as string);
            if (processed) location = processed;
          }
          console.log('Updated search params from GPT:', { extractedName, specialty, location });
        }
      } catch (gptError: any) {
        console.error('=== GPT SEARCH ERROR ===');
        console.error('Error Type:', gptError.constructor.name);
        console.error('Error Message:', gptError.message);
        console.error('Error Stack:', gptError.stack);
        console.warn('GPT search failed, falling back to regex parsing:', gptError.message);
        // Continue with regex-based parsing results
      }
    } else {
      console.log('OpenAI API key not configured, skipping GPT-first search');
    }

    // City and state are already extracted from parsedQuery above
    // No need to parse again

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

    // GPT-FIRST VERIFICATION DISABLED: Skip GPT suggestions, use NPPES directly
    let nppesResults: NPPESProvider[] = [];
    let verifiedDoctors: NPPESProvider[] = [];
    
    if (false && gptSuggestedDoctors.length > 0) { // DISABLED - go straight to NPPES
      console.log('=== VERIFYING GPT SUGGESTIONS IN NPPES ===');
      
      // Verify each GPT-suggested doctor in NPPES
      for (const gptDoctor of gptSuggestedDoctors) {
        console.log(`Verifying: ${gptDoctor.firstName} ${gptDoctor.lastName}...`);
        
        // Parse location from GPT suggestion
        const doctorLoc = gptDoctor.location;
        const gptLocation = (doctorLoc && typeof doctorLoc === 'string') 
          ? (enhancedLocationProcessing(doctorLoc as string) || location)
          : location;
        const { city: gptCity, state: gptState } = parseLocation(gptLocation);
        
        // Try multiple search strategies for this doctor
        let doctorResults: NPPESProvider[] = [];
        
        // Strategy 1: Exact match with all parameters
        doctorResults = await searchNPPES(
          gptDoctor.firstName,
          gptDoctor.lastName,
          gptDoctor.specialty || specialty,
          gptCity || city,
          gptState || state
        );
        doctorResults = filterActiveNppesResults(doctorResults);
        
        // Strategy 2: Last name only (handles "A. Kopstein" variations)
        if (doctorResults.length === 0) {
          doctorResults = await searchNPPES(
            null,
            gptDoctor.lastName,
            gptDoctor.specialty || specialty,
            gptCity || city,
            gptState || state
          );
          doctorResults = filterActiveNppesResults(doctorResults);
          
          // Filter by fuzzy name matching
          if (doctorResults.length > 0) {
            const searchFullName = `${gptDoctor.firstName} ${gptDoctor.lastName}`;
            doctorResults = doctorResults.filter(doctor => {
              const doctorFullName = `${doctor.basic.first_name || ''} ${doctor.basic.last_name || ''}`.trim();
              const match = advancedNameMatching(searchFullName, doctorFullName);
              return match.match && match.score >= 70;
            });
          }
        }
        
        // Strategy 3: Without location constraint
        if (doctorResults.length === 0) {
          doctorResults = await searchNPPES(
            gptDoctor.firstName,
            gptDoctor.lastName,
            gptDoctor.specialty || specialty,
            null,
            null
          );
          doctorResults = filterActiveNppesResults(doctorResults);
          
          // Filter by location and name matching
          if (doctorResults.length > 0 && (gptCity || gptState || city || state)) {
            const searchFullName = `${gptDoctor.firstName} ${gptDoctor.lastName}`;
            doctorResults = doctorResults.filter(doctor => {
              const doctorFullName = `${doctor.basic.first_name || ''} ${doctor.basic.last_name || ''}`.trim();
              const nameMatch = advancedNameMatching(searchFullName, doctorFullName);
              
              if (!nameMatch.match || nameMatch.score < 70) return false;
              
              // Check location match
              const primaryAddress = doctor.addresses.find(addr => addr.address_purpose === 'LOCATION') || doctor.addresses[0];
              const doctorCity = primaryAddress?.city?.toLowerCase() || '';
              const doctorState = primaryAddress?.state?.toLowerCase() || '';
              const searchCity = (gptCity || city)?.toLowerCase() || '';
              const searchState = (gptState || state)?.toLowerCase() || '';
              
              const cityMatch = !searchCity || doctorCity.includes(searchCity) || searchCity.includes(doctorCity);
              const stateMatch = !searchState || doctorState === searchState;
              
              return cityMatch && stateMatch;
            });
          }
        }
        
        if (doctorResults.length > 0) {
          console.log(`✓ Verified ${gptDoctor.firstName} ${gptDoctor.lastName}: Found ${doctorResults.length} matches in NPPES`);
          verifiedDoctors.push(...doctorResults);
        } else {
          console.log(`✗ Could not verify ${gptDoctor.firstName} ${gptDoctor.lastName} in NPPES`);
        }
      }
      
      // Remove duplicates from verified doctors
      const seenNpis = new Set<string>();
      verifiedDoctors = verifiedDoctors.filter(doctor => {
        if (seenNpis.has(doctor.number)) return false;
        seenNpis.add(doctor.number);
        return true;
      });
      
      nppesResults = verifiedDoctors;
      console.log(`=== GPT VERIFICATION COMPLETE ===`);
      console.log(`Total verified doctors: ${nppesResults.length}`);
    }
    
    // PRIMARY SEARCH: Use NPPES database directly (NO GPT suggestions to prevent AI hallucinations)
    if (nppesResults.length === 0) {
      console.log('=== NPPES DATABASE SEARCH (100% Real Doctors Only) ===');
      
      // PRECISE SEARCH: Determine search strategy based on provided parameters
      const hasName = extractedName.firstName || extractedName.lastName;
      const hasSpecialty = !!specialty;
      const hasLocation = !!(city || state);
      
      console.log('=== PRECISE SEARCH STRATEGY ===');
      console.log('Has name:', hasName);
      console.log('Has specialty:', hasSpecialty);
      console.log('Has location:', hasLocation);
      
      // Strategy 1: Name only - search by name, return all matches (any specialty, any location)
      if (hasName && !hasSpecialty && !hasLocation) {
        console.log('Strategy: NAME ONLY - returning all doctors with matching name');
        const rawResults1 = await searchNPPES(
          extractedName.firstName,
          extractedName.lastName,
          null, // No specialty filter
          null, // No location filter
          null,
          null // No taxonomy code
        );
        console.log(`NPPES raw results: ${rawResults1.length}`);
        nppesResults = rawResults1.filter(provider => {
          if (!provider.basic?.first_name || !provider.basic?.last_name) return false;
          if (!provider.addresses || provider.addresses.length === 0) return false;
          return true;
        });
        console.log(`After basic filter: ${nppesResults.length} results`);
      }
      // Strategy 2: Name + Location - require both to match
      else if (hasName && hasLocation && !hasSpecialty) {
        console.log('Strategy: NAME + LOCATION - requiring both to match');
        const rawResults1 = await searchNPPES(
          extractedName.firstName,
          extractedName.lastName,
          null, // No specialty filter
          city,
          state,
          null // No taxonomy code
        );
        console.log(`NPPES raw results: ${rawResults1.length}`);
        nppesResults = rawResults1.filter(provider => {
          if (!provider.basic?.first_name || !provider.basic?.last_name) return false;
          if (!provider.addresses || provider.addresses.length === 0) return false;
          return true;
        });
        console.log(`After basic filter: ${nppesResults.length} results`);
      }
      // Strategy 3: Location + Specialty - require both to match
      else if (hasLocation && hasSpecialty && !hasName) {
        console.log('Strategy: LOCATION + SPECIALTY - requiring both to match');
        const rawResults1 = await searchNPPES(
          null, // No name filter
          null,
          specialty,
          city,
          state,
          taxonomyMapping?.primary || null // Use taxonomy code if available
        );
        console.log(`NPPES raw results: ${rawResults1.length}`);
        nppesResults = filterActiveNppesResults(rawResults1);
        console.log(`After active filter: ${nppesResults.length} results`);
      }
      // Strategy 4: All three - require all to match
      else if (hasName && hasSpecialty && hasLocation) {
        console.log('Strategy: NAME + LOCATION + SPECIALTY - requiring all to match');
        const rawResults1 = await searchNPPES(
          extractedName.firstName,
          extractedName.lastName,
          specialty,
          city,
          state,
          taxonomyMapping?.primary || null // Use taxonomy code if available
        );
        console.log(`NPPES raw results: ${rawResults1.length}`);
        nppesResults = rawResults1.filter(provider => {
          if (!provider.basic?.first_name || !provider.basic?.last_name) return false;
          if (!provider.addresses || provider.addresses.length === 0) return false;
          return true;
        });
        console.log(`After basic filter: ${nppesResults.length} results`);
      }
      // Strategy 5: Name + Specialty (no location) - require both to match
      else if (hasName && hasSpecialty && !hasLocation) {
        console.log('Strategy: NAME + SPECIALTY - requiring both to match');
        const rawResults1 = await searchNPPES(
          extractedName.firstName,
          extractedName.lastName,
          specialty,
          null,
          null,
          taxonomyMapping?.primary || null // Use taxonomy code if available
        );
        console.log(`NPPES raw results: ${rawResults1.length}`);
        nppesResults = rawResults1.filter(provider => {
          if (!provider.basic?.first_name || !provider.basic?.last_name) return false;
          if (!provider.addresses || provider.addresses.length === 0) return false;
          return true;
        });
        console.log(`After basic filter: ${nppesResults.length} results`);
      }
      // Strategy 6: Specialty only (no name, no location) - return all with specialty
      else if (hasSpecialty && !hasName && !hasLocation) {
        console.log('Strategy: SPECIALTY ONLY - returning all doctors with matching specialty');
        const rawResults1 = await searchNPPES(
          null,
          null,
          specialty,
          null,
          null,
          taxonomyMapping?.primary || null // Use taxonomy code if available
        );
        console.log(`NPPES raw results: ${rawResults1.length}`);
        nppesResults = filterActiveNppesResults(rawResults1);
        console.log(`After active filter: ${nppesResults.length} results`);
      }
      // Fallback: Try with all parameters
      else {
        console.log('Strategy: FALLBACK - trying with all provided parameters');
        const rawResults1 = await searchNPPES(
          extractedName.firstName,
          extractedName.lastName,
          specialty,
          city,
          state
        );
        console.log(`NPPES raw results: ${rawResults1.length}`);
        nppesResults = rawResults1.filter(provider => {
          if (!provider.basic?.first_name || !provider.basic?.last_name) return false;
          if (!provider.addresses || provider.addresses.length === 0) return false;
          return true;
        });
        console.log(`After basic filter: ${nppesResults.length} results`);
      }
      
      // Expand specialty search if no results and we have specialty
      const expandedSpecialties = specialty ? expandSpecialtySearch(specialty) : [];
      if (nppesResults.length === 0 && expandedSpecialties.length > 1) {
        console.log('=== TRYING EXPANDED SPECIALTIES ===');
        for (const expandedSpecialty of expandedSpecialties.slice(1)) {
          const expandedResults = await searchNPPES(
            extractedName.firstName,
            extractedName.lastName,
            expandedSpecialty,
            city,
            state
          );
          if (expandedResults.length > 0) {
            nppesResults = expandedResults.filter(provider => {
              if (!provider.basic?.first_name || !provider.basic?.last_name) return false;
              if (!provider.addresses || provider.addresses.length === 0) return false;
              return true;
            });
            specialty = expandedSpecialty;
            console.log(`Found ${nppesResults.length} results with expanded specialty: ${expandedSpecialty}`);
            break;
          }
        }
      }
      
      // If no results and we have expanded specialties, try them
      if (nppesResults.length === 0 && expandedSpecialties.length > 1) {
        for (const expandedSpecialty of expandedSpecialties.slice(1)) {
          const expandedResults = await searchNPPES(
            extractedName.firstName,
            extractedName.lastName,
            expandedSpecialty,
            city,
            state
          );
          console.log(`Expanded specialty "${expandedSpecialty}": NPPES raw results: ${expandedResults.length}`);
          if (expandedResults.length > 0) {
            // Use lenient filter for name queries
            const hasName = extractedName.firstName || extractedName.lastName;
            if (hasName) {
              nppesResults = expandedResults.filter(provider => {
                if (!provider.basic?.first_name || !provider.basic?.last_name) return false;
                if (!provider.addresses || provider.addresses.length === 0) return false;
                return true;
              });
              console.log(`After lenient name filter: ${nppesResults.length} results (filtered ${expandedResults.length - nppesResults.length})`);
            } else {
              nppesResults = filterActiveNppesResults(expandedResults);
              console.log(`After active filter: ${nppesResults.length} results (filtered ${expandedResults.length - nppesResults.length})`);
            }
            specialty = expandedSpecialty; // Update specialty for display
            console.log(`Found ${nppesResults.length} results with expanded specialty: ${expandedSpecialty}`);
            break;
          }
        }
      }

      // Attempt 2: Try last name only (handles "A. Kopstein", "Andrew M. Kopstein", etc.)
      // Only if we didn't use a precise strategy above
      if (nppesResults.length === 0 && extractedName.lastName && !hasName && !hasSpecialty && !hasLocation) {
        let searchAttempt = 2;
        const rawResults2 = await searchNPPES(
          null, // Remove first name constraint
          extractedName.lastName,
          specialty,
          city,
          state
        );
        console.log(`Search attempt ${searchAttempt}: NPPES raw results: ${rawResults2.length} (last name only)`);
        
        // Use lenient filter for name queries
        if (extractedName.firstName || extractedName.lastName) {
          nppesResults = rawResults2.filter(provider => {
            if (!provider.basic?.first_name || !provider.basic?.last_name) return false;
            if (!provider.addresses || provider.addresses.length === 0) return false;
            return true;
          });
          console.log(`After lenient name filter: ${nppesResults.length} results (filtered ${rawResults2.length - nppesResults.length})`);
        } else {
          nppesResults = filterActiveNppesResults(rawResults2);
          console.log(`After active filter: ${nppesResults.length} results (filtered ${rawResults2.length - nppesResults.length})`);
        }
        
        // If we got results, filter by advanced name matching
        if (nppesResults.length > 0 && extractedName.firstName) {
          const searchFullName = `${extractedName.firstName} ${extractedName.lastName}`;
          nppesResults = nppesResults.filter(doctor => {
            const doctorFullName = `${doctor.basic.first_name || ''} ${doctor.basic.last_name || ''}`.trim();
            const match = advancedNameMatching(searchFullName, doctorFullName);
            return match.match && match.score >= 70; // Require 70%+ confidence
          });
          console.log(`After name matching filter: ${nppesResults.length} results`);
        }
      }

      // Attempt 3: Remove location constraint if no results
      // Only if we didn't use a precise strategy above
      if (nppesResults.length === 0 && (city || state) && !hasName && !hasSpecialty && !hasLocation) {
        let searchAttempt = 3;
        const rawResults3 = await searchNPPES(
          extractedName.firstName,
          extractedName.lastName,
          specialty,
          null,
          null
        );
        console.log(`Search attempt ${searchAttempt}: NPPES raw results: ${rawResults3.length} (without location)`);
        
        // Use lenient filter for name queries
        if (extractedName.firstName || extractedName.lastName) {
          nppesResults = rawResults3.filter(provider => {
            if (!provider.basic?.first_name || !provider.basic?.last_name) return false;
            if (!provider.addresses || provider.addresses.length === 0) return false;
            return true;
          });
          console.log(`After lenient name filter: ${nppesResults.length} results (filtered ${rawResults3.length - nppesResults.length})`);
        } else {
          nppesResults = filterActiveNppesResults(rawResults3);
          console.log(`After active filter: ${nppesResults.length} results (filtered ${rawResults3.length - nppesResults.length})`);
        }
        
        // Apply name matching if we have a name
        if (nppesResults.length > 0 && extractedName.firstName && extractedName.lastName) {
          const searchFullName = `${extractedName.firstName} ${extractedName.lastName}`;
          nppesResults = nppesResults.filter(doctor => {
            const doctorFullName = `${doctor.basic.first_name || ''} ${doctor.basic.last_name || ''}`.trim();
            const match = advancedNameMatching(searchFullName, doctorFullName);
            return match.match && match.score >= 70;
          });
          console.log(`After name matching filter: ${nppesResults.length} results`);
        }
      }
      // Attempt 3.5: Last name only, no location, no specialty
      // Only if we didn't use a precise strategy above
      if (nppesResults.length === 0 && extractedName.lastName && !hasName && !hasSpecialty && !hasLocation) {
        let searchAttempt = 3.5;
        const rawResults35 = await searchNPPES(
          null,
          extractedName.lastName,
          null, // Remove specialty constraint
          city,
          state
        );
        console.log(`Search attempt ${searchAttempt}: NPPES raw results: ${rawResults35.length} (last name + location, no specialty)`);
        
        // Use lenient filter for name queries
        if (extractedName.firstName || extractedName.lastName) {
          nppesResults = rawResults35.filter(provider => {
            if (!provider.basic?.first_name || !provider.basic?.last_name) return false;
            if (!provider.addresses || provider.addresses.length === 0) return false;
            return true;
          });
          console.log(`After lenient name filter: ${nppesResults.length} results (filtered ${rawResults35.length - nppesResults.length})`);
        } else {
          nppesResults = filterActiveNppesResults(rawResults35);
          console.log(`After active filter: ${nppesResults.length} results (filtered ${rawResults35.length - nppesResults.length})`);
        }
        
        // Filter by name and specialty matching
        if (nppesResults.length > 0 && extractedName.lastName) {
          const searchFullName = extractedName.firstName && extractedName.lastName 
            ? `${extractedName.firstName} ${extractedName.lastName}` 
            : extractedName.lastName;
          
          nppesResults = nppesResults.filter(doctor => {
            const doctorFullName = `${doctor.basic.first_name || ''} ${doctor.basic.last_name || ''}`.trim();
            
            // Name matching
            let nameMatch = true;
            if (extractedName.firstName) {
              const match = advancedNameMatching(searchFullName, doctorFullName);
              nameMatch = match.match && match.score >= 70;
            } else if (extractedName.lastName) {
              // Just check last name
              nameMatch = doctor.basic.last_name?.toLowerCase() === extractedName.lastName.toLowerCase();
            } else {
              nameMatch = false;
            }
            
            // Specialty matching if we have a specialty
            let specialtyMatch = true;
            if (specialty) {
              const primaryTaxonomy = doctor.taxonomies.find(tax => tax.primary) || doctor.taxonomies[0];
              const doctorSpecialty = primaryTaxonomy?.desc || '';
              specialtyMatch = matchSpecialty(specialty, doctorSpecialty) >= 50;
            }
            
            return nameMatch && specialtyMatch;
          });
          console.log(`After name + specialty matching filter: ${nppesResults.length} results`);
        }
      }

      // Attempt 4: Try specialty-only search if we have specialty but no name
      // Only if we didn't use a precise strategy above
      if (nppesResults.length === 0 && specialty && (!extractedName.firstName && !extractedName.lastName) && !hasName && !hasSpecialty && !hasLocation) {
        let searchAttempt = 4;
        if (city || state) {
          const rawResults4 = await searchNPPES(
            null,
            null,
            specialty,
            city,
            state
          );
          console.log(`Search attempt ${searchAttempt}: NPPES raw results: ${rawResults4.length} (specialty + location)`);
          nppesResults = filterActiveNppesResults(rawResults4);
          console.log(`After active filter: ${nppesResults.length} results (filtered ${rawResults4.length - nppesResults.length})`);
        }
      }

      // Attempt 5: Try with alternative specialty terms, broader categories, or related specialties
      // Only if we didn't use a precise strategy above
      if (nppesResults.length === 0 && !hasName && !hasSpecialty && !hasLocation) {
        let searchAttempt = 5;
        
        // Try broader specialty category first
        if (specialty) {
          const broaderSpecialty = getBroaderSpecialty(specialty);
          if (broaderSpecialty) {
            const rawResults5a = await searchNPPES(
              extractedName.firstName,
              extractedName.lastName,
              broaderSpecialty,
              city,
              state
            );
            if (rawResults5a.length > 0) {
              console.log(`Search attempt ${searchAttempt}: NPPES raw results: ${rawResults5a.length} (broader specialty: ${broaderSpecialty})`);
              specialty = broaderSpecialty; // Update specialty for result display
              
              // Use lenient filter for name queries
              const hasName = extractedName.firstName || extractedName.lastName;
              if (hasName) {
                nppesResults = rawResults5a.filter(provider => {
                  if (!provider.basic?.first_name || !provider.basic?.last_name) return false;
                  if (!provider.addresses || provider.addresses.length === 0) return false;
                  return true;
                });
                console.log(`After lenient name filter: ${nppesResults.length} results (filtered ${rawResults5a.length - nppesResults.length})`);
              } else {
                nppesResults = filterActiveNppesResults(rawResults5a);
                console.log(`After active filter: ${nppesResults.length} results (filtered ${rawResults5a.length - nppesResults.length})`);
              }
            }
          }
        }
        
        // Try related specialties if broader didn't work
        if (nppesResults.length === 0 && specialty) {
        const relatedSpecialties = getRelatedSpecialties(specialty);
        for (const relatedSpecialty of relatedSpecialties) {
          const rawResults5b = await searchNPPES(
            extractedName.firstName,
            extractedName.lastName,
            relatedSpecialty,
            city,
            state
          );
          if (rawResults5b.length > 0) {
            console.log(`Search attempt ${searchAttempt}: NPPES raw results: ${rawResults5b.length} (related specialty: ${relatedSpecialty})`);
            specialty = relatedSpecialty; // Update specialty for result display
            
            // Use lenient filter for name queries
            const hasName = extractedName.firstName || extractedName.lastName;
            if (hasName) {
              nppesResults = rawResults5b.filter(provider => {
                if (!provider.basic?.first_name || !provider.basic?.last_name) return false;
                if (!provider.addresses || provider.addresses.length === 0) return false;
                return true;
              });
              console.log(`After lenient name filter: ${nppesResults.length} results (filtered ${rawResults5b.length - nppesResults.length})`);
            } else {
              nppesResults = filterActiveNppesResults(rawResults5b);
              console.log(`After active filter: ${nppesResults.length} results (filtered ${rawResults5b.length - nppesResults.length})`);
            }
            break;
          }
        }
        }
        
        // Try alternative specialty terms if available (legacy support)
        if (nppesResults.length === 0 && specialty && SPECIALTY_ALTERNATIVES[specialty]) {
        for (const altSpecialty of SPECIALTY_ALTERNATIVES[specialty]) {
          if (city || state) {
            const altResults = await searchNPPES(
              extractedName.firstName,
              extractedName.lastName,
              altSpecialty,
              city,
              state
            );
            if (altResults.length > 0) {
              console.log(`Search attempt ${searchAttempt}: NPPES returned ${altResults.length} results (using alternative specialty: ${altSpecialty})`);
              specialty = altSpecialty; // Update specialty for result display
              
              // Use lenient filter for name queries
              const hasName = extractedName.firstName || extractedName.lastName;
              if (hasName) {
                nppesResults = altResults.filter(provider => {
                  if (!provider.basic?.first_name || !provider.basic?.last_name) return false;
                  if (!provider.addresses || provider.addresses.length === 0) return false;
                  return true;
                });
                console.log(`After lenient name filter: ${nppesResults.length} results (filtered ${altResults.length - nppesResults.length})`);
              } else {
                nppesResults = filterActiveNppesResults(altResults);
                console.log(`After active filter: ${nppesResults.length} results (filtered ${altResults.length - nppesResults.length})`);
              }
              break;
            }
          }
        }
        }
        
        // If still no results and we have a specialty, try searching with just location and specialty
        // BUT ONLY if no name was provided (name queries should prioritize name matches)
        if (nppesResults.length === 0 && specialty && (city || state) && !extractedName.firstName && !extractedName.lastName) {
        const rawResults5c = await searchNPPES(
          null,
          null,
          specialty,
          city,
          state
        );
        console.log(`Search attempt ${searchAttempt}: NPPES raw results: ${rawResults5c.length} (specialty + location, no name)`);
        nppesResults = filterActiveNppesResults(rawResults5c);
        console.log(`After active filter: ${nppesResults.length} results (filtered ${rawResults5c.length - nppesResults.length})`);
        }
        
        // If still no results and we have name, try name + location only
        if (nppesResults.length === 0 && (extractedName.firstName || extractedName.lastName) && (city || state)) {
        const rawResults5d = await searchNPPES(
          extractedName.firstName,
          extractedName.lastName,
          null,
          city,
          state
        );
        console.log(`Search attempt ${searchAttempt}: NPPES raw results: ${rawResults5d.length} (name + location, no specialty)`);
        nppesResults = filterActiveNppesResults(rawResults5d);
        console.log(`After active filter: ${nppesResults.length} results (filtered ${rawResults5d.length - nppesResults.length})`);
        }
      }
      
      // FINAL ATTEMPT: Search without active filter if everything else failed
      // BUT ONLY if no name was provided (don't do broad specialty search when name is provided)
      if (nppesResults.length === 0 && !extractedName.firstName && !extractedName.lastName) {
        console.log('=== FINAL ATTEMPT: Searching without active filter ===');
        console.log('Trying very broad search with minimal constraints...');
        
        const unfilteredResults = await searchNPPES(
          null, // No name filter
          null,
          specialty, // Keep specialty if available
          city,
          state
        );
        
        console.log(`Unfiltered search found ${unfilteredResults.length} raw results`);
        
        if (unfilteredResults.length > 0) {
          // Apply MINIMAL filter - only remove completely invalid entries
          nppesResults = unfilteredResults.filter(doc => {
            const hasBasicInfo = doc.basic.first_name && doc.basic.last_name;
            const hasAddress = doc.addresses && doc.addresses.length > 0;
            const status = doc.basic.status?.toLowerCase() || '';
            const notDeactivated = status !== 'deactivated';
            
            return hasBasicInfo && hasAddress && notDeactivated;
          });
          console.log(`After minimal validation: ${nppesResults.length} results`);
          
          // If still have results, limit to top 50 for performance
          if (nppesResults.length > 50) {
            console.log(`Limiting to first 50 results (had ${nppesResults.length})`);
            nppesResults = nppesResults.slice(0, 50);
          }
        }
      }
    } // End of fallback NPPES search

    // CRITICAL: Filter by name if a name was provided in the query
    // This ensures name matches are prioritized over specialty-only results
    if ((extractedName.firstName || extractedName.lastName) && nppesResults.length > 0) {
      const searchFullName = extractedName.firstName && extractedName.lastName
        ? `${extractedName.firstName} ${extractedName.lastName}`
        : extractedName.lastName || extractedName.firstName || '';
      
      console.log('=== NAME-BASED FILTERING ===');
      console.log('Search name:', searchFullName);
      console.log('Results before name filter:', nppesResults.length);
      
      const nameFilteredResults = nppesResults.filter(doctor => {
        const doctorFullName = `${doctor.basic.first_name || ''} ${doctor.basic.last_name || ''}`.trim();
        const match = advancedNameMatching(searchFullName, doctorFullName);
        
        // Require at least 60% name match when a name is provided
        if (match.match && match.score >= 60) {
          return true;
        }
        return false;
      });
      
      console.log('Results after name filter:', nameFilteredResults.length);
      
      // Only use name-filtered results if we found any matches
      // If no name matches found, we'll still show specialty results but with lower confidence
      if (nameFilteredResults.length > 0) {
        nppesResults = nameFilteredResults;
        console.log('Using name-filtered results only');
      } else {
        console.log('No name matches found - will show specialty results with low name scores');
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
      google_place_id?: string | null;
      healthgrades_id?: string | null;
      website?: string | null;
      photo_url?: string | null;
      photo_verified?: boolean;
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
          enhanceWithGooglePlaces(doctor, process.env.GOOGLE_PLACES_API_KEY!, specialty)
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
        const doctorSpecialty = getBestSpecialtyMatch(doctor, specialty);
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
          specialty: doctorSpecialty,
          location: address,
          phone: primaryAddress?.telephone_number || 'Not available',
          rating: 0,
          years_experience: yearsExperience,
          npi: doctor.number,
          google_place_id: null,
          healthgrades_id: null,
          website: null,
          photo_url: null,
          photo_verified: false,
        };
      });
    }

    // PRECISE LOCATION FILTERING: Equal priority for all provided parameters
    // If location is provided, require location match (regardless of name/specialty)
    if (physicians.length > 0 && (city || state || location)) {
      const hasName = extractedName.firstName || extractedName.lastName;
      const hasSpecialty = !!specialty;
      
      console.log('=== PRECISE LOCATION FILTERING ===');
      console.log('Has name:', hasName);
      console.log('Has specialty:', hasSpecialty);
      console.log('Has location:', !!(city || state || location));
      console.log('Results before location filter:', physicians.length);
      
      // When location is provided, require location match (equal priority)
      // This applies whether name/specialty are also provided or not
      physicians = filterPhysiciansByLocation(physicians, city, state, location);
      
      console.log('Results after location filter:', physicians.length);
    }
    
    // Apply confidence-based ranking with advanced name matching
    const queryForRanking = {
      name: extractedName.firstName && extractedName.lastName 
        ? `${extractedName.firstName} ${extractedName.lastName}` 
        : extractNameFromQuery(query),
      specialty: specialty,
      location: location,
    };
    
    // Add source count and city/state for confidence scoring
    const physiciansWithMetadata = physicians.map(doctor => {
      const locationParts = doctor.location.split(',').map(p => p.trim());
      const doctorCity = locationParts[0] || null;
      const doctorState = locationParts[1]?.match(/\b([A-Z]{2})\b/)?.[1] || null;
      
      return {
        ...doctor,
        city: doctorCity,
        state: doctorState,
        sourceCount: (doctor.google_place_id ? 2 : 1), // 2 if Google Places data is present
      };
    });
    
    // PRE-RANKING NAME FILTER: If name is provided, filter out non-matching names
    let physiciansToRank = physiciansWithMetadata;
    if (queryForRanking.name) {
      console.log('=== PRE-RANKING NAME FILTER ===');
      console.log('Filtering by name:', queryForRanking.name);
      console.log('Results before name filter:', physiciansToRank.length);
      
      physiciansToRank = physiciansWithMetadata.filter(doctor => {
        const nameMatch = advancedNameMatching(queryForRanking.name!, doctor.name);
        // Only keep results with at least 60% name match
        const keep = nameMatch.match && nameMatch.score >= 60;
        if (!keep) {
          console.log(`Filtered out: ${doctor.name} (match score: ${nameMatch.score})`);
        }
        return keep;
      });
      
      console.log('Results after name filter:', physiciansToRank.length);
      
      // If no name matches found, show a message but still return specialty results
      if (physiciansToRank.length === 0 && physiciansWithMetadata.length > 0) {
        console.log('⚠️  No exact name matches found - showing specialty results with low confidence');
        // Keep specialty results but they'll have low name scores
        physiciansToRank = physiciansWithMetadata;
      }
    }
    
    // Calculate dynamic confidence threshold
    let confidenceThreshold = 60; // Default
    
    // If name is provided, use higher threshold to filter out weak matches
    if (queryForRanking.name) {
      confidenceThreshold = 50; // Higher threshold for name queries
      console.log('Using higher confidence threshold (50) for name query:', queryForRanking.name);
    } else {
      // If no name in query, lower threshold (specialty+location queries are less strict)
      confidenceThreshold = 40; // Much lower for specialty+location
      console.log('Lowered confidence threshold to 40 (no name in query)');
    }
    
    // If we have Google Places data, lower threshold even more (but only if no name)
    const hasGooglePlaces = physiciansWithMetadata.some(d => d.sourceCount && d.sourceCount > 1);
    if (hasGooglePlaces && !queryForRanking.name) {
      confidenceThreshold = 30; // Very low when Google Places confirms
      console.log('Lowered confidence threshold to 30 (Google Places confirmed)');
    }
    
    // Rank by confidence score (using filtered results)
    const rankedPhysicians = rankSearchResults(physiciansToRank, queryForRanking, confidenceThreshold);
    
    // Convert back to original format
    physicians = rankedPhysicians.map(({ confidence, city: _city, state: _state, sourceCount: _sourceCount, ...doctor }) => doctor);
    
    console.log('=== CONFIDENCE RANKING ===');
    console.log(`Ranked ${physicians.length} physicians by confidence`);
    if (rankedPhysicians.length > 0) {
      console.log('Top 3 confidence scores:', rankedPhysicians.slice(0, 3).map(d => ({
        name: d.name,
        confidence: d.confidence.total,
        breakdown: {
          name: d.confidence.nameScore,
          specialty: d.confidence.specialtyScore,
          location: d.confidence.locationScore,
          bonus: d.confidence.sourceBonus,
        }
      })));
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
        
        // Suggest related specialties if we have a specialty
        if (specialty) {
          const related = getRelatedSpecialties(specialty);
          const broader = getBroaderSpecialty(specialty);
          if (broader) {
            suggestions.push(`• Trying a broader specialty: "${broader}"`);
          }
          if (related.length > 0) {
            suggestions.push(`• Trying related specialties: ${related.slice(0, 2).join(', ')}`);
          }
        } else {
          // If no specialty detected, suggest common specialties
          suggestions.push('• Adding a specialty: "retina surgeon", "cardiologist", "dermatologist", etc.');
        }
        
        if (city || state) {
          suggestions.push(`• Expanding your search radius (currently ${searchRadius / 1000}km)`);
        }
        if (extractedName.firstName || extractedName.lastName) {
          suggestions.push('• Trying a partial name match (e.g., just last name)');
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
    const totalPages = Math.ceil(resultsCount / resultsPerPage);
    const paginatedResults = physicians.slice(offset, offset + resultsPerPage);
    const hasMore = offset + resultsPerPage < resultsCount;

    // === FINAL RESULTS DEBUG ===
    console.log('=== SEARCH RESULTS SUMMARY ===');
    console.log('Total Physicians Found:', resultsCount);
    console.log('Pagination:', { currentPage, resultsPerPage, offset, hasMore, totalPages });
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

    // Track search usage (for logged-in users)
    if (userId) {
      await incrementSearchCount(userId, query, resultsCount);
    }

    // Search history removed - now handled client-side with localStorage

    res.json({
      query,
      specialty: specialty || 'Not specified',
      location: location,
      results: paginatedResults,
      resultsCount,
      searchRadius: (city || state) ? searchRadius : null,
      usage: searchCheck?.usage, // Include usage info in response
      pagination: {
        currentPage,
        resultsPerPage,
        totalPages,
        hasMore,
        totalResults: resultsCount,
      },
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

// Stats endpoint for monitoring
searchRoutes.get('/stats', (req, res) => {
  try {
    const queryParserStats = queryParser.getStats();
    const taxonomyResolverStats = taxonomyResolver.getStats();
    const costStats = costMonitor.getStats();
    const costBreakdown = costMonitor.getCostBreakdown();

    res.json({
      queryParser: queryParserStats,
      taxonomyResolver: taxonomyResolverStats,
      cost: costStats,
      costBreakdown,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
