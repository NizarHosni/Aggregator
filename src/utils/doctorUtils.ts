// Utility functions for doctor data processing

export interface DoctorSource {
  icon: string;
  label: string;
  url: string;
}

export interface PracticeInfo {
  name?: string;
  phone?: string;
  type?: string;
  verified?: boolean;
}

/**
 * Correct medical terminology typos
 */
export function correctMedicalTerminology(text: string): string {
  if (!text) return '';
  
  const typoMap: Record<string, string> = {
    'aetna': 'retina',
    'ophtalmologie': 'ophthalmology',
    'ophtalmology': 'ophthalmology',
    'opthamology': 'ophthalmology',
  };
  
  let corrected = text.toLowerCase();
  
  Object.entries(typoMap).forEach(([typo, correct]) => {
    corrected = corrected.replace(new RegExp(typo, 'gi'), correct);
  });
  
  // Capitalize first letter
  return corrected.charAt(0).toUpperCase() + corrected.slice(1);
}

/**
 * Fix practice names - replace "Aetna" with "Retina" in practice names
 */
export function fixPracticeName(name: string | undefined | null): string | undefined {
  if (!name) return undefined;
  return name.replace(/Aetna/gi, 'Retina');
}

/**
 * Generate source links for a doctor
 */
export function getDoctorSources(doctor: {
  npi?: string;
  name?: string;
  specialty?: string;
  googlePlaceId?: string;
  healthgradesId?: string;
  website?: string;
}): DoctorSource[] {
  const sources: DoctorSource[] = [];
  
  // NPPES PROFILE (OFFICIAL GOVERNMENT)
  if (doctor.npi) {
    sources.push({
      icon: '🏛️',
      label: 'Official NPPES Profile',
      url: `https://npiregistry.cms.hhs.gov/provider-view/${doctor.npi}`
    });
  }
  
  // GOOGLE BUSINESS PROFILE
  if (doctor.googlePlaceId) {
    sources.push({
      icon: '🔍',
      label: 'Google Business',
      url: `https://www.google.com/maps/place/?q=place_id:${doctor.googlePlaceId}`
    });
  }
  
  // HEALTHGRADES PROFILE
  if (doctor.healthgradesId) {
    const nameSlug = doctor.name?.toLowerCase().replace(/\s+/g, '-').replace(/dr\.?\s*/gi, '') || 'doctor';
    sources.push({
      icon: '⭐',
      label: 'Healthgrades Reviews',
      url: `https://www.healthgrades.com/physician/dr-${nameSlug}-${doctor.healthgradesId}`
    });
  }
  
  // PRACTICE WEBSITE
  if (doctor.website) {
    sources.push({
      icon: '🌐',
      label: 'Practice Website',
      url: doctor.website
    });
  }
  
  // VITALS/WELLMED PROFILE (always available)
  const searchQuery = `${doctor.name || ''} ${doctor.specialty || ''}`.trim();
  if (searchQuery) {
    sources.push({
      icon: '📊',
      label: 'Vitals Profile',
      url: `https://www.vitals.com/search?q=${encodeURIComponent(searchQuery)}`
    });
  }
  
  return sources;
}

/**
 * Extract practice information from multiple sources
 */
export function extractPracticeInfo(doctor: {
  practice?: { name?: string; phone?: string };
  googleData?: { business_name?: string };
  nppesData?: { practice_name?: string };
  healthgradesData?: { practice_name?: string };
}): PracticeInfo {
  const practiceSources = [
    doctor.practice?.name,
    doctor.googleData?.business_name,
    doctor.nppesData?.practice_name,
    doctor.healthgradesData?.practice_name
  ].filter(Boolean) as string[];
  
  // Use the most specific practice name found
  const practiceName = practiceSources.find(name => 
    name.includes('Retina') || 
    name.includes('Eye') || 
    name.includes('Vision') ||
    name.includes('Clinic') ||
    name.includes('Medical')
  ) || practiceSources[0];
  
  // Fix typo in practice name
  const fixedName = practiceName ? fixPracticeName(practiceName) : undefined;
  
  return {
    name: fixedName,
    phone: doctor.practice?.phone,
    type: classifyPracticeType(fixedName || practiceName),
    verified: practiceSources.length > 1 // Multiple sources confirm
  };
}

/**
 * Classify practice type based on name
 */
function classifyPracticeType(practiceName: string | undefined): string | undefined {
  if (!practiceName) return undefined;
  
  if (practiceName.includes('Retina')) return 'Retina Specialist';
  if (practiceName.includes('Eye') || practiceName.includes('Vision')) return 'Ophthalmology';
  if (practiceName.includes('Medical') || practiceName.includes('Clinic')) return 'Medical Practice';
  if (practiceName.includes('Hospital') || practiceName.includes('Center')) return 'Healthcare Center';
  return 'Medical Practice';
}

/**
 * Calculate credibility score for a doctor
 */
export function calculateCredibilityScore(doctor: {
  npi?: string;
  googlePlaceId?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
}): number {
  let score = 0;
  if (doctor.npi) score += 30; // Official government ID
  if (doctor.googlePlaceId) score += 25; // Google verified
  if (doctor.website) score += 20; // Has website
  if (doctor.rating && (doctor.reviewCount || 0) > 10) score += 25; // Good reviews
  return Math.min(100, score);
}

/**
 * Normalize doctor data with typo corrections
 */
export function normalizeDoctorData<T extends { specialty?: string; practice?: { name?: string } }>(doctor: T): T {
  return {
    ...doctor,
    specialty: doctor.specialty ? correctMedicalTerminology(doctor.specialty) : doctor.specialty,
    practice: doctor.practice ? {
      ...doctor.practice,
      name: doctor.practice.name ? fixPracticeName(doctor.practice.name) : doctor.practice.name
    } : doctor.practice
  };
}

