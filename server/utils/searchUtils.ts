// Advanced search utilities for 95%+ accuracy

export interface NameMatchResult {
  match: boolean;
  score: number;
  type: 'exact' | 'initials' | 'phonetic' | 'partial' | 'similar' | 'no-match';
}

export interface ConfidenceScore {
  total: number;
  nameScore: number;
  specialtyScore: number;
  locationScore: number;
  sourceBonus: number;
}

/**
 * Advanced fuzzy name matching with multiple variations
 */
export function advancedNameMatching(searchName: string, doctorName: string): NameMatchResult {
  const searchNormalized = searchName.toLowerCase().trim().replace(/[^a-z\s]/g, '');
  const doctorNormalized = doctorName.toLowerCase().trim().replace(/[^a-z\s]/g, '');

  if (!searchNormalized || !doctorNormalized) {
    return { match: false, score: 0, type: 'no-match' };
  }

  // EXACT MATCH
  if (doctorNormalized === searchNormalized) {
    return { match: true, score: 100, type: 'exact' };
  }

  // SUBSTRING MATCH
  if (doctorNormalized.includes(searchNormalized) || searchNormalized.includes(doctorNormalized)) {
    return { match: true, score: 95, type: 'exact' };
  }

  // INITIAL MATCH (Andrew Kopstein vs A. Kopstein or A Kopstein)
  const searchInitials = extractInitials(searchNormalized);
  const doctorInitials = extractInitials(doctorNormalized);
  if (searchInitials === doctorInitials && searchInitials.length >= 2) {
    return { match: true, score: 90, type: 'initials' };
  }

  // PARTIAL NAME MATCHING (check if key parts match)
  const searchParts = searchNormalized.split(/\s+/).filter(p => p.length > 1);
  const doctorParts = doctorNormalized.split(/\s+/).filter(p => p.length > 1);

  if (searchParts.length > 0 && doctorParts.length > 0) {
    // Check if last names match (most important)
    const searchLastName = searchParts[searchParts.length - 1];
    const doctorLastName = doctorParts[doctorParts.length - 1];
    
    if (searchLastName === doctorLastName && searchLastName.length >= 3) {
      // Last name matches, check first name
      const searchFirstName = searchParts[0];
      const doctorFirstName = doctorParts[0];
      
      if (searchFirstName === doctorFirstName || 
          searchFirstName[0] === doctorFirstName[0] ||
          doctorFirstName.includes(searchFirstName) ||
          searchFirstName.includes(doctorFirstName)) {
        return { match: true, score: 88, type: 'partial' };
      }
      
      // Last name matches but first name doesn't - still good match
      return { match: true, score: 75, type: 'partial' };
    }

    // Check for matching parts
    const matchingParts = searchParts.filter(part => 
      doctorParts.some(dpart => dpart.includes(part) || part.includes(dpart))
    );

    if (matchingParts.length >= Math.min(2, searchParts.length)) {
      return { match: true, score: 80, type: 'partial' };
    }
  }

  // LEVENSHTEIN DISTANCE FOR TYPO TOLERANCE
  const distance = levenshteinDistance(searchNormalized, doctorNormalized);
  const maxLength = Math.max(searchNormalized.length, doctorNormalized.length);
  const similarity = maxLength > 0 ? (1 - distance / maxLength) * 100 : 0;

  if (similarity > 85) {
    return { match: true, score: similarity, type: 'similar' };
  }

  return { match: false, score: 0, type: 'no-match' };
}

/**
 * Extract initials from a name
 */
function extractInitials(name: string): string {
  return name.split(/\s+/).map(part => part[0] || '').join('').toLowerCase();
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Enhanced location processing with common corrections
 */
export function enhancedLocationProcessing(locationInput: string | null): string | null {
  if (!locationInput) return null;

  const locationCorrections: Record<string, string> = {
    'tukwilla': 'Tukwila, WA',
    'tukwillla': 'Tukwila, WA',
    'tukwila': 'Tukwila, WA',
    'seattle area': 'Seattle, WA',
    'seattle wa': 'Seattle, WA',
    'tacoma wa': 'Tacoma, WA',
    'tacoma washington': 'Tacoma, WA',
    'bellevue washington': 'Bellevue, WA',
    'bellevue wa': 'Bellevue, WA',
    'spokane wa': 'Spokane, WA',
    'spokane washington': 'Spokane, WA',
    'everett wa': 'Everett, WA',
    'everett washington': 'Everett, WA',
  };

  const lowerInput = locationInput.toLowerCase().trim();
  const corrected = locationCorrections[lowerInput] || locationInput;

  // Normalize common patterns
  let normalized = corrected;
  
  // Handle "City, State" format
  if (!normalized.includes(',') && !normalized.match(/\b[A-Z]{2}\b/)) {
    // Try to infer state from common patterns
    if (normalized.includes('wa') || normalized.includes('washington')) {
      normalized = normalized.replace(/\b(wa|washington)\b/gi, 'WA');
      if (!normalized.includes(',')) {
        normalized = normalized.replace(/\s+WA$/, ', WA');
      }
    }
  }

  return normalized;
}

/**
 * Expand specialty search to related specialties
 */
export function expandSpecialtySearch(specialty: string | null): string[] {
  if (!specialty) return [];

  const specialtyExpansions: Record<string, string[]> = {
    'eye surgeon': ['ophthalmology', 'retina surgery', 'cataract surgery', 'cornea specialist', 'ophthalmologist'],
    'eye doctor': ['ophthalmology', 'ophthalmologist', 'eye surgeon'],
    'ophthalmology': ['retina specialist', 'cataract surgeon', 'glaucoma specialist', 'eye surgeon', 'ophthalmologist'],
    'ophthalmologist': ['ophthalmology', 'retina specialist', 'eye surgeon'],
    'retina surgeon': ['ophthalmology', 'vitreoretinal surgery', 'retinal specialist', 'retina specialist'],
    'retina specialist': ['retina surgery', 'ophthalmology', 'vitreoretinal surgery'],
    'cardiologist': ['cardiology', 'interventional cardiology', 'cardiac electrophysiology'],
    'cardiology': ['cardiologist', 'interventional cardiology'],
    'dentist': ['general dentistry', 'cosmetic dentistry', 'orthodontics', 'dental'],
    'dermatologist': ['dermatology', 'skin doctor'],
    'dermatology': ['dermatologist', 'skin doctor'],
  };

  const normalized = normalizeSpecialty(specialty);
  const expansions = specialtyExpansions[normalized] || [normalized];

  // Include the original specialty and normalized version
  const allSpecialties = [normalized, ...expansions];
  
  // Remove duplicates
  return Array.from(new Set(allSpecialties));
}

/**
 * Normalize specialty names
 */
function normalizeSpecialty(specialty: string): string {
  const mapping: Record<string, string> = {
    'eye doctor': 'ophthalmology',
    'eye surgeon': 'ophthalmology',
    'retina specialist': 'retina surgery',
    'retina surgeon': 'retina surgery',
    'heart doctor': 'cardiology',
    'skin doctor': 'dermatology',
    'dentist': 'general dentistry',
  };

  const lower = specialty.toLowerCase().trim();
  return mapping[lower] || lower;
}

/**
 * Match specialty with fuzzy matching
 */
export function matchSpecialty(searchSpecialty: string | null, doctorSpecialty: string | null): number {
  if (!searchSpecialty || !doctorSpecialty) return 0;

  const searchNorm = searchSpecialty.toLowerCase().trim();
  const doctorNorm = doctorSpecialty.toLowerCase().trim();

  // Exact match
  if (searchNorm === doctorNorm) return 100;

  // NEW: Subspecialty mappings (Internal Medicine + Cardiovascular = Cardiology)
  const subspecialtyMappings: Record<string, string[]> = {
    'cardiology': ['internal medicine', 'cardiovascular disease', 'cardiac', 'interventional cardiology', 'cardiovascular'],
    'retina surgery': ['ophthalmology', 'retinal', 'vitreoretinal', 'retina'],
    'cardiac surgery': ['thoracic surgery', 'cardiothoracic', 'heart surgery', 'cardiovascular surgery'],
    'interventional cardiology': ['cardiology', 'internal medicine', 'cardiovascular'],
  };

  // Check if search specialty matches doctor's subspecialty
  for (const [mainSpecialty, relatedSpecialties] of Object.entries(subspecialtyMappings)) {
    if (searchNorm.includes(mainSpecialty) || mainSpecialty.includes(searchNorm)) {
      // If doctor has any related subspecialty, give high score
      if (relatedSpecialties.some(sub => doctorNorm.includes(sub))) {
        return 90; // High match for subspecialty
      }
    }
  }

  // Contains match
  if (doctorNorm.includes(searchNorm) || searchNorm.includes(doctorNorm)) return 90;

  // Check expanded specialties
  const expanded = expandSpecialtySearch(searchSpecialty);
  if (expanded.some(s => doctorNorm.includes(s.toLowerCase()) || s.toLowerCase().includes(doctorNorm))) {
    return 85;
  }

  // Word overlap
  const searchWords = searchNorm.split(/\s+/);
  const doctorWords = doctorNorm.split(/\s+/);
  const matchingWords = searchWords.filter(word => 
    doctorWords.some(dword => dword.includes(word) || word.includes(dword))
  );

  if (matchingWords.length > 0) {
    return (matchingWords.length / Math.max(searchWords.length, doctorWords.length)) * 100;
  }

  return 0;
}

/**
 * Match location with fuzzy matching
 */
export function matchLocation(searchLocation: string | null, doctorCity: string | null, doctorState: string | null): number {
  if (!searchLocation) return 50; // Neutral score if no location specified

  const searchNorm = enhancedLocationProcessing(searchLocation)?.toLowerCase() || '';
  const doctorCityNorm = doctorCity?.toLowerCase() || '';
  const doctorStateNorm = doctorState?.toLowerCase() || '';

  if (!searchNorm) return 50;

  // Extract city and state from search location
  const searchParts = searchNorm.split(',').map(p => p.trim());
  const searchCity = searchParts[0] || '';
  const searchState = searchParts[1]?.replace(/\b(wa|washington)\b/gi, 'wa') || '';

  let score = 0;

  // City match
  if (searchCity && doctorCityNorm) {
    if (searchCity === doctorCityNorm) {
      score += 50;
    } else if (doctorCityNorm.includes(searchCity) || searchCity.includes(doctorCityNorm)) {
      score += 40;
    } else {
      // Check for common misspellings
      const distance = levenshteinDistance(searchCity, doctorCityNorm);
      const maxLen = Math.max(searchCity.length, doctorCityNorm.length);
      if (maxLen > 0 && (1 - distance / maxLen) > 0.8) {
        score += 35;
      }
    }
  }

  // State match
  if (searchState && doctorStateNorm) {
    const searchStateNorm = searchState.replace(/\b(wa|washington)\b/gi, 'wa');
    const doctorStateNorm2 = doctorStateNorm.replace(/\b(wa|washington)\b/gi, 'wa');
    
    if (searchStateNorm === doctorStateNorm2 || 
        searchStateNorm.includes(doctorStateNorm2) || 
        doctorStateNorm2.includes(searchStateNorm)) {
      score += 30;
    }
  }

  return Math.min(100, score);
}

/**
 * Calculate confidence score for a doctor match
 */
export function calculateConfidenceScore(
  doctor: {
    name: string;
    specialty: string;
    city?: string | null;
    state?: string | null;
    npi?: string;
    sourceCount?: number;
  },
  query: {
    name?: string | null;
    specialty?: string | null;
    location?: string | null;
  }
): ConfidenceScore {
  let nameScore = 0;
  let specialtyScore = 0;
  let locationScore = 0;
  let sourceBonus = 0;

  // PRECISE PRIORITY: Equal weight for all provided parameters (33.3% each)
  // Count how many parameters are provided
  const providedParams = [query.name, query.specialty, query.location].filter(Boolean).length;
  const paramWeight = providedParams > 0 ? 1 / providedParams : 0;

  // NAME MATCHING - Equal weight when provided
  if (query.name) {
    const nameMatch = advancedNameMatching(query.name, doctor.name);
    nameScore = nameMatch.score * paramWeight;
    
    // If name doesn't match at all, set score to 0
    if (!nameMatch.match || nameMatch.score < 60) {
      nameScore = 0;
    }
  } else {
    nameScore = providedParams === 0 ? 33.3 : 0; // Neutral only if no params provided
  }

  // SPECIALTY MATCHING - Equal weight when provided
  if (query.specialty) {
    specialtyScore = matchSpecialty(query.specialty, doctor.specialty) * paramWeight;
  } else {
    specialtyScore = providedParams === 0 ? 33.3 : 0; // Neutral only if no params provided
  }

  // LOCATION MATCHING - Equal weight when provided
  if (query.location) {
    locationScore = matchLocation(query.location, doctor.city || null, doctor.state || null) * paramWeight;
  } else {
    locationScore = providedParams === 0 ? 33.3 : 0; // Neutral only if no params provided
  }

  // BONUS: MULTIPLE SOURCE VERIFICATION
  if (doctor.sourceCount && doctor.sourceCount > 1) {
    sourceBonus += 10;
  }
  
  // NEW: Google Places specialty confirmation bonus
  if (doctor.sourceCount && doctor.sourceCount > 1 && query.specialty) {
    // If we have Google Places data AND specialty matches, big bonus
    const specialtyMatch = matchSpecialty(query.specialty, doctor.specialty);
    if (specialtyMatch >= 85) {
      sourceBonus += 20; // Big bonus for Google Places + specialty match
    }
  }
  
  // BONUS: OFFICIAL NPI
  if (doctor.npi) {
    sourceBonus += 5;
  }

  const total = Math.min(100, nameScore + specialtyScore + locationScore + sourceBonus);

  return {
    total,
    nameScore,
    specialtyScore,
    locationScore,
    sourceBonus,
  };
}

/**
 * Rank search results by confidence score
 */
export function rankSearchResults<T extends {
  name: string;
  specialty: string;
  city?: string | null;
  state?: string | null;
  npi?: string;
  sourceCount?: number;
}>(
  doctors: T[],
  query: {
    name?: string | null;
    specialty?: string | null;
    location?: string | null;
  },
  minConfidence: number = 70
): Array<T & { confidence: ConfidenceScore }> {
  return doctors
    .map(doctor => ({
      ...doctor,
      confidence: calculateConfidenceScore(doctor, query),
    }))
    .filter(doctor => doctor.confidence.total >= minConfidence)
    .sort((a, b) => b.confidence.total - a.confidence.total);
}

/**
 * Extract name from query string
 */
export function extractNameFromQuery(query: string): string | null {
  // Remove common prefixes
  let cleaned = query.replace(/^(dr\.?|doctor)\s+/i, '').trim();
  
  // Remove location patterns
  cleaned = cleaned.replace(/\b(in|near|at)\s+[^,]+(?:,\s*[A-Z]{2})?/gi, '').trim();
  
  // Remove specialty keywords
  const specialtyKeywords = [
    'surgeon', 'doctor', 'specialist', 'physician', 'ophthalmologist',
    'cardiologist', 'dentist', 'dermatologist', 'eye', 'retina'
  ];
  
  for (const keyword of specialtyKeywords) {
    cleaned = cleaned.replace(new RegExp(`\\b${keyword}\\b`, 'gi'), '').trim();
  }
  
  // Extract potential name (2+ capitalized words)
  const nameMatch = cleaned.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/);
  if (nameMatch) {
    return nameMatch[0].trim();
  }
  
  // Fallback: take first 2-3 words as potential name
  const words = cleaned.split(/\s+/).filter(w => w.length > 1);
  if (words.length >= 2) {
    return words.slice(0, Math.min(3, words.length)).join(' ');
  }
  
  return null;
}

/**
 * Extract specialty from query string
 */
export function extractSpecialtyFromQuery(query: string): string | null {
  const specialtyKeywords: Record<string, string> = {
    'eye surgeon': 'ophthalmology',
    'eye doctor': 'ophthalmology',
    'ophthalmologist': 'ophthalmology',
    'ophthalmology': 'ophthalmology',
    'retina surgeon': 'retina surgery',
    'retina specialist': 'retina surgery',
    'cardiologist': 'cardiology',
    'cardiology': 'cardiology',
    'dentist': 'general dentistry',
    'dermatologist': 'dermatology',
    'dermatology': 'dermatology',
  };

  const lowerQuery = query.toLowerCase();
  
  for (const [keyword, specialty] of Object.entries(specialtyKeywords)) {
    if (lowerQuery.includes(keyword)) {
      return specialty;
    }
  }
  
  return null;
}

/**
 * Extract location from query string
 */
export function extractLocationFromQuery(query: string): string | null {
  // Pattern 1: "in City, State" or "near City, State"
  const pattern1 = /\b(in|near|at)\s+([^,]+(?:,\s*[A-Z]{2})?)/i;
  const match1 = query.match(pattern1);
  if (match1) {
    return match1[2].trim();
  }

  // Pattern 2: "City State" at the end
  const pattern2 = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new\s+hampshire|new\s+jersey|new\s+mexico|new\s+york|north\s+carolina|north\s+dakota|ohio|oklahoma|oregon|pennsylvania|rhode\s+island|south\s+carolina|south\s+dakota|tennessee|texas|utah|vermont|virginia|washington|west\s+virginia|wisconsin|wyoming)\b/i;
  const match2 = query.match(pattern2);
  if (match2) {
    return `${match2[1]} ${match2[2]}`;
  }

  // Pattern 3: "City, ST" format
  const pattern3 = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})\b/;
  const match3 = query.match(pattern3);
  if (match3) {
    return `${match3[1]}, ${match3[2]}`;
  }

  return null;
}

