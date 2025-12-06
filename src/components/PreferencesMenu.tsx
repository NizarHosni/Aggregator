import { useState } from 'react';
import { Settings, Moon, Sun, MapPin, List, X } from 'lucide-react';
import { usePreferences } from '../hooks/usePreferences';

export function PreferencesMenu() {
  const { preferences, toggleDarkMode, setSearchRadius, setResultsPerPage } = usePreferences();
  const [isOpen, setIsOpen] = useState(false);

  const radiusOptions = [
    { value: 5000, label: '5 km' },
    { value: 10000, label: '10 km' },
    { value: 25000, label: '25 km' },
    { value: 50000, label: '50 km' },
  ];

  const resultsOptions = [
    { value: 10, label: '10 results' },
    { value: 15, label: '15 results' },
    { value: 25, label: '25 results' },
    { value: 50, label: '50 results' },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
        aria-label="Preferences"
      >
        <Settings className="w-4 h-4" />
        <span className="hidden sm:inline">Preferences</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute right-0 mt-2 w-80 glass-card-strong rounded-2xl shadow-professional-lg z-50 p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-heading text-lg flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                Preferences
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Dark Mode Toggle */}
              <div>
                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-3">
                    {preferences.darkMode ? (
                      <Moon className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Sun className="w-5 h-5 text-amber-500" />
                    )}
                    <div>
                      <p className="text-subheading text-sm">Dark Mode</p>
                      <p className="text-body text-xs">
                        {preferences.darkMode ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={preferences.darkMode}
                      onChange={toggleDarkMode}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </div>
                </label>
              </div>

              <div className="border-t border-gray-200" />

              {/* Search Radius */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <p className="text-subheading text-sm">Search Radius</p>
                </div>
                <select
                  value={preferences.searchRadius}
                  onChange={(e) => setSearchRadius(Number(e.target.value))}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm"
                >
                  {radiusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-body text-xs mt-2">
                  How far to search from the specified location
                </p>
              </div>

              <div className="border-t border-gray-200" />

              {/* Results Per Page */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <List className="w-5 h-5 text-blue-600" />
                  <p className="text-subheading text-sm">Results Per Page</p>
                </div>
                <select
                  value={preferences.resultsPerPage}
                  onChange={(e) => setResultsPerPage(Number(e.target.value))}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm"
                >
                  {resultsOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-body text-xs mt-2">
                  Number of doctors to show per page
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-body text-xs text-center">
                All preferences are saved locally in your browser
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

