import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, Star, Clock, ShieldCheck, Video, Building2, GraduationCap, Award, Languages, Accessibility, ExternalLink } from 'lucide-react';
import { AppointmentBookingCard } from './AppointmentBooking';
import { ReviewScorecard } from './ReviewScorecard';
import { normalizeDoctorData, getDoctorSources, extractPracticeInfo } from '../utils/doctorUtils';

interface DoctorProfileData {
  name: string;
  specialty: string;
  location: string;
  phone: string;
  rating: number;
  years_experience: number;
  npi?: string;
  acceptedInsurances?: string[];
  telehealth?: boolean;
  inPerson?: boolean;
  afterHours?: boolean;
  education?: string[];
  certifications?: string[];
  hospitalAffiliations?: string[];
  languagesSpoken?: string[];
  accessibility?: string[];
  procedureExpertise?: string[];
}

export function DoctorProfile() {
  const { npi } = useParams<{ npi: string }>();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState<DoctorProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!npi) {
      setError('Invalid doctor identifier');
      setLoading(false);
      return;
    }

    // In a real app, you'd have a dedicated /doctors/:npi endpoint
    // For now, we'll simulate fetching from search results
    const fetchDoctorProfile = async () => {
      try {
        // Mock enhanced profile data - in production, fetch from dedicated endpoint
        const mockProfile: DoctorProfileData = {
          name: 'Dr. Mark L. Nelson',
          specialty: 'Retina Surgery',
          location: 'Seattle, WA',
          phone: '(206) 555-0123',
          rating: 4.8,
          years_experience: 15,
          npi: npi,
          acceptedInsurances: ['Aetna', 'Blue Shield', 'Medicare', 'United Healthcare'], // Aetna is correct here (insurance company)
          telehealth: true,
          inPerson: true,
          afterHours: false,
          education: [
            'Johns Hopkins School of Medicine, MD',
            'Stanford University Residency Program',
            'Harvard Medical School Vitreoretinal Fellowship',
          ],
          certifications: [
            'American Board of Ophthalmology',
            'Vitreoretinal Surgery Board Certified',
            'Fellowship in Retinal Diseases',
          ],
          hospitalAffiliations: [
            'Seattle Eye Institute',
            'University of Washington Medical Center',
            'Swedish Medical Center',
          ],
          languagesSpoken: ['English', 'Spanish', 'Mandarin'],
          accessibility: ['Wheelchair accessible', 'Sign language interpreter available'],
          procedureExpertise: [
            'Retinal Detachment Repair',
            'Macular Degeneration Treatment',
            'Diabetic Retinopathy Management',
            'Vitrectomy Surgery',
          ],
        };

        // Normalize doctor data (fix typos)
        const normalizedProfile = normalizeDoctorData(mockProfile);
        setDoctor(normalizedProfile);
      } catch (err) {
        console.error('Failed to load doctor profile:', err);
        setError('Failed to load doctor profile. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void fetchDoctorProfile();
  }, [npi]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <div className="text-center glass-card rounded-3xl p-12 shadow-professional-lg">
          <div className="spinner-professional mx-auto mb-6" />
          <p className="text-body font-semibold">Loading doctor profile...</p>
        </div>
      </div>
    );
  }

  if (error || !doctor) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <div className="text-center glass-card rounded-3xl p-12 shadow-professional-lg max-w-md">
          <p className="text-body font-semibold text-red-600 mb-4">{error || 'Doctor not found'}</p>
          <button onClick={() => navigate(-1)} className="btn-primary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle pb-12">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-body hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Search
        </button>

        {/* Hero Section */}
        <div className="glass-card-strong rounded-3xl p-8 mb-6 shadow-professional-lg">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <h1 className="text-heading text-3xl mb-2">{doctor.name}</h1>
              <p className="text-subheading text-xl mb-4">{doctor.specialty}</p>
              
              {/* Practice Information */}
              {(() => {
                const practiceInfo = extractPracticeInfo({
                  practice: { name: 'Sound Retina', phone: doctor.phone },
                });
                return practiceInfo.name ? (
                  <div className="practice-info mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🏥</span>
                      <strong className="text-heading">{practiceInfo.name}</strong>
                    </div>
                    {practiceInfo.type && (
                      <p className="text-body text-sm text-gray-600">{practiceInfo.type}</p>
                    )}
                  </div>
                ) : null;
              })()}
              
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex items-center gap-2 text-body">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span>{doctor.location}</span>
                </div>
                <div className="flex items-center gap-2 text-body">
                  <Phone className="w-4 h-4 text-blue-600" />
                  <a href={`tel:${doctor.phone}`} className="hover:text-blue-600">
                    {doctor.phone}
                  </a>
                </div>
                {doctor.rating > 0 && (
                  <div className="flex items-center gap-1 badge-rating">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span className="font-semibold">{doctor.rating.toFixed(1)}</span>
                  </div>
                )}
                <div className="badge-experience">
                  <Clock className="w-3 h-3 inline mr-1" />
                  <span>{doctor.years_experience}+ years</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {doctor.inPerson && (
                  <span className="badge flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> In-Person
                  </span>
                )}
                {doctor.telehealth && (
                  <span className="badge flex items-center gap-1">
                    <Video className="w-3 h-3" /> Telehealth
                  </span>
                )}
                {doctor.afterHours && (
                  <span className="badge bg-purple-50 text-purple-700 border-purple-200">
                    After Hours
                  </span>
                )}
              </div>

              {doctor.acceptedInsurances && doctor.acceptedInsurances.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {doctor.acceptedInsurances.map((insurance) => (
                    <span key={insurance} className="badge bg-green-50 text-green-700 border-green-200">
                      <ShieldCheck className="w-3 h-3 inline mr-1" />
                      {insurance}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Education & Certifications */}
            {doctor.education && doctor.education.length > 0 && (
              <div className="glass-card rounded-2xl p-6">
                <h2 className="text-heading text-xl mb-4 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-blue-600" />
                  Education
                </h2>
                <ul className="space-y-2">
                  {doctor.education.map((edu, idx) => (
                    <li key={idx} className="text-body flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>{edu}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {doctor.certifications && doctor.certifications.length > 0 && (
              <div className="glass-card rounded-2xl p-6">
                <h2 className="text-heading text-xl mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-blue-600" />
                  Certifications
                </h2>
                <ul className="space-y-2">
                  {doctor.certifications.map((cert, idx) => (
                    <li key={idx} className="text-body flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>{cert}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Hospital Affiliations */}
            {doctor.hospitalAffiliations && doctor.hospitalAffiliations.length > 0 && (
              <div className="glass-card rounded-2xl p-6">
                <h2 className="text-heading text-xl mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Hospital Affiliations
                </h2>
                <ul className="space-y-2">
                  {doctor.hospitalAffiliations.map((hospital, idx) => (
                    <li key={idx} className="text-body flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>{hospital}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Procedure Expertise */}
            {doctor.procedureExpertise && doctor.procedureExpertise.length > 0 && (
              <div className="glass-card rounded-2xl p-6">
                <h2 className="text-heading text-xl mb-4">Procedure Expertise</h2>
                <div className="flex flex-wrap gap-2">
                  {doctor.procedureExpertise.map((procedure, idx) => (
                    <span key={idx} className="badge bg-blue-50 text-blue-700 border-blue-200">
                      {procedure}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Languages & Accessibility */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {doctor.languagesSpoken && doctor.languagesSpoken.length > 0 && (
                <div className="glass-card rounded-2xl p-6">
                  <h2 className="text-heading text-lg mb-4 flex items-center gap-2">
                    <Languages className="w-5 h-5 text-blue-600" />
                    Languages
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {doctor.languagesSpoken.map((lang, idx) => (
                      <span key={idx} className="badge">{lang}</span>
                    ))}
                  </div>
                </div>
              )}

              {doctor.accessibility && doctor.accessibility.length > 0 && (
                <div className="glass-card rounded-2xl p-6">
                  <h2 className="text-heading text-lg mb-4 flex items-center gap-2">
                    <Accessibility className="w-5 h-5 text-blue-600" />
                    Accessibility
                  </h2>
                  <ul className="space-y-2">
                    {doctor.accessibility.map((item, idx) => (
                      <li key={idx} className="text-body text-sm">✓ {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Reviews */}
            {doctor.npi && <ReviewScorecard doctorNpi={doctor.npi} />}

            {/* Source Links */}
            {(() => {
              const sources = getDoctorSources({
                npi: doctor.npi,
                name: doctor.name,
                specialty: doctor.specialty,
              });
              return sources.length > 0 ? (
                <div className="glass-card rounded-2xl p-6">
                  <h2 className="text-heading text-xl mb-4 flex items-center gap-2">
                    <ExternalLink className="w-5 h-5 text-blue-600" />
                    Verified Sources
                  </h2>
                  <div className="source-links">
                    <div className="links-grid">
                      {sources.map((source, index) => (
                        <a 
                          key={index}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="source-link"
                        >
                          <span>{source.icon}</span>
                          <span className="truncate">{source.label}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null;
            })()}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              {doctor.npi && <AppointmentBookingCard doctor={doctor} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

