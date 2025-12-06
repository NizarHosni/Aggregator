// Search accuracy utilities: fuzzy matching, typo tolerance, abbreviations

// Levenshtein distance for typo tolerance
export function levenshteinDistance(a: string, b: string): number {
  // Handle edge cases
  if (!a && !b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  
  // Limit string length to prevent memory issues
  const maxLength = 1000;
  if (a.length > maxLength || b.length > maxLength) {
    // For very long strings, use simple comparison
    return a === b ? 0 : Math.max(a.length, b.length);
  }

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) { // Fixed: was i <= a.length, should be j <= a.length
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Check if two strings are similar enough (fuzzy match)
export function isFuzzyMatch(str1: string, str2: string, threshold: number = 0.8): boolean {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return true;
  if (s1.includes(s2) || s2.includes(s1)) return true;
  
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  const similarity = 1 - distance / maxLength;
  
  return similarity >= threshold;
}

// Common medical specialty misspellings and variations
export const specialtyMappings: Record<string, string[]> = {
  'Cardiology': ['cardioligy', 'cardiologist', 'heart doctor', 'heart specialist'],
  'Dermatology': ['dermatologist', 'skin doctor', 'skin specialist'],
  'Orthopedic Surgery': ['orthopedic', 'orthopaedic', 'orthopedist', 'bone doctor', 'sports medicine'],
  'Ophthalmology': ['eye doctor', 'eye specialist', 'opthamology', 'opthalmology'],
  'Otolaryngology': ['ENT', 'ear nose throat', 'otolaryngologist', 'ear doctor'],
  'Obstetrics & Gynecology': ['OBGYN', 'OB-GYN', 'OB/GYN', 'womens health', 'gynecologist', 'obstetrician'],
  'Pediatrics': ['pediatrician', 'kids doctor', 'children doctor', 'child doctor'],
  'Psychiatry': ['psychiatrist', 'mental health', 'therapist'],
  'Internal Medicine': ['internist', 'primary care', 'general practice', 'family medicine'],
  'Neurology': ['neurologist', 'brain doctor', 'nerve doctor'],
  'Oncology': ['oncologist', 'cancer doctor', 'cancer specialist'],
  'Urology': ['urologist', 'urinary doctor'],
  'Radiology': ['radiologist', 'imaging specialist'],
  'Anesthesiology': ['anesthesiologist', 'anesthetist'],
  'Endocrinology': ['endocrinologist', 'diabetes doctor', 'hormone doctor'],
  'Gastroenterology': ['gastroenterologist', 'GI doctor', 'stomach doctor', 'digestive doctor'],
  'Nephrology': ['nephrologist', 'kidney doctor'],
  'Pulmonology': ['pulmonologist', 'lung doctor', 'respiratory doctor'],
  'Rheumatology': ['rheumatologist', 'arthritis doctor', 'joint doctor'],
  'Hematology': ['hematologist', 'blood doctor'],
  'Infectious Disease': ['infectious disease doctor', 'ID doctor'],
  'Physical Medicine & Rehabilitation': ['physiatrist', 'rehab doctor', 'PM&R'],
  'Allergy & Immunology': ['allergist', 'allergy doctor', 'immunologist'],
  'Cardiac Surgery': ['heart surgeon', 'heart surgery', 'cardiovascular surgeon', 'cardiothoracic surgery', 'cardiac surgeon', 'cardiac surgery', 'heart surgeon in texas', 'heart surgeon texas'],
  'Retina Specialist': ['retina surgeon', 'retina surgery', 'retinal specialist', 'vitreoretinal surgeon', 'retina doctor', 'retinal surgeon'],
  'Thoracic Surgery': ['thoracic surgeon', 'chest surgeon', 'lung surgeon'],
  'Vascular Surgery': ['vascular surgeon', 'vein surgeon', 'artery surgeon'],
  'Plastic Surgery': ['plastic surgeon', 'cosmetic surgeon', 'reconstructive surgeon'],
  'General Surgery': ['general surgeon', 'surgeon'],
};

// Normalize specialty input to standard name
export function normalizeSpecialty(input: string): string {
  const normalized = input.toLowerCase().trim();
  
  // Check direct match
  for (const [standard, variations] of Object.entries(specialtyMappings)) {
    if (standard.toLowerCase() === normalized) {
      return standard;
    }
    
    // Check variations
    for (const variation of variations) {
      if (variation === normalized || isFuzzyMatch(variation, normalized, 0.85)) {
        return standard;
      }
    }
  }
  
  // Return original if no match found
  return input;
}

// Extract and normalize specialty from query
export function extractSpecialty(query: string): string | null {
  const queryLower = query.toLowerCase();
  
  // Check for specialty keywords
  for (const [standard, variations] of Object.entries(specialtyMappings)) {
    if (queryLower.includes(standard.toLowerCase())) {
      return standard;
    }
    
    for (const variation of variations) {
      if (queryLower.includes(variation)) {
        return standard;
      }
    }
  }
  
  return null;
}

// Common location misspellings
const locationCorrections: Record<string, string> = {
  'seatle': 'Seattle',
  'new yourk': 'New York',
  'los angles': 'Los Angeles',
  'san fransisco': 'San Francisco',
  'chigago': 'Chicago',
  'philidelphia': 'Philadelphia',
  'phenix': 'Phoenix',
  'huston': 'Houston',
  'miama': 'Miami',
  'atlants': 'Atlanta',
  'racoma': 'Tacoma',
  'tacoma': 'Tacoma', // Normalize to proper case
  'tukwilla': 'Tukwila',
  'tukwila': 'Tukwila',
};

// State abbreviation to full name mapping
const stateAbbreviations: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia',
};

// Normalize state abbreviation to full name
export function normalizeState(state: string): string {
  const normalized = state.trim().toUpperCase();
  return stateAbbreviations[normalized] || state;
}

// Fix common location typos
export function correctLocationTypo(location: string): string {
  const normalized = location.toLowerCase().trim();
  
  // Direct match
  for (const [typo, correct] of Object.entries(locationCorrections)) {
    if (normalized === typo) {
      return correct;
    }
  }
  
  // Fuzzy match for common typos (e.g., "racoma" -> "Tacoma")
  for (const [typo, correct] of Object.entries(locationCorrections)) {
    if (isFuzzyMatch(normalized, typo, 0.75)) {
      return correct;
    }
  }
  
  // Check if it's a state abbreviation
  const upperLocation = location.trim().toUpperCase();
  if (stateAbbreviations[upperLocation]) {
    return stateAbbreviations[upperLocation];
  }
  
  return location;
}

// Suggest alternative search terms
export function suggestAlternativeSearches(query: string, specialty?: string, location?: string): string[] {
  const suggestions: string[] = [];
  
  // If specialty found, suggest related specialists
  if (specialty && specialtyMappings[specialty]) {
    const variations = specialtyMappings[specialty].slice(0, 3);
    variations.forEach(variation => {
      if (location) {
        suggestions.push(`${variation} in ${location}`);
      } else {
        suggestions.push(variation);
      }
    });
  }
  
  // Suggest nearby cities if location is known
  const nearbyCities: Record<string, string[]> = {
    'Seattle': ['Tacoma', 'Bellevue', 'Everett', 'Redmond'],
    'Los Angeles': ['Santa Monica', 'Pasadena', 'Long Beach', 'Burbank'],
    'San Francisco': ['Oakland', 'San Jose', 'Berkeley', 'Palo Alto'],
    'New York': ['Brooklyn', 'Queens', 'Manhattan', 'Bronx'],
    'Chicago': ['Evanston', 'Oak Park', 'Naperville', 'Schaumburg'],
  };
  
  if (location) {
    const nearby = nearbyCities[location];
    if (nearby && specialty) {
      nearby.slice(0, 2).forEach(city => {
        suggestions.push(`${specialty} in ${city}`);
      });
    }
  }
  
  return suggestions;
}

