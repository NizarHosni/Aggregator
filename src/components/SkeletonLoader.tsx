export function DoctorCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div 
      className="doctor-card animate-pulse"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-gray-200" />
        <div className="flex-1">
          <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <div className="w-4 h-4 bg-gray-200 rounded mt-0.5" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-full mb-1" />
            <div className="h-4 bg-gray-200 rounded w-2/3" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-1/3" />
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          <div className="h-6 bg-gray-200 rounded-full w-16" />
          <div className="h-6 bg-gray-200 rounded-full w-24" />
        </div>

        <div className="h-10 bg-gray-200 rounded-xl w-full mt-4" />
      </div>
    </div>
  );
}

export function SearchResultsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
      {[...Array(6)].map((_, index) => (
        <DoctorCardSkeleton key={index} index={index} />
      ))}
    </div>
  );
}

export function SearchHistorySkeleton() {
  return (
    <div className="glass-card-strong rounded-3xl shadow-professional-lg overflow-hidden animate-pulse">
      <div className="p-6 border-b border-gray-200/50 bg-white/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-200" />
          <div>
            <div className="h-5 bg-gray-200 rounded w-32 mb-1" />
            <div className="h-4 bg-gray-200 rounded w-24" />
          </div>
        </div>
      </div>
      <div className="divide-y divide-gray-100/50">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-gray-200" />
              <div className="flex-1">
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="flex gap-3">
                  <div className="h-4 bg-gray-200 rounded w-20" />
                  <div className="h-4 bg-gray-200 rounded w-24" />
                  <div className="h-4 bg-gray-200 rounded w-16" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

