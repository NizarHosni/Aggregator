// Cost monitoring and optimization for GPT-4 API usage

interface CostStats {
  totalQueries: number;
  totalCost: number;
  averageCost: number;
  gpt4TurboCalls: number;
  gpt4Calls: number;
  localMappings: number;
  cacheHits: number;
}

// Cost estimates (as of 2024)
const COST_ESTIMATES = {
  GPT4_TURBO_PER_QUERY: 0.01, // ~$0.01 per query parsing
  GPT4_PER_QUERY: 0.10, // ~$0.10 per taxonomy resolution
  GOOGLE_PLACES_PER_DOCTOR: 0.005, // ~$0.005 per doctor enhancement
};

export class CostMonitor {
  private stats: CostStats = {
    totalQueries: 0,
    totalCost: 0,
    averageCost: 0,
    gpt4TurboCalls: 0,
    gpt4Calls: 0,
    localMappings: 0,
    cacheHits: 0,
  };

  recordQueryParsing(usedGPT4: boolean, fromCache: boolean) {
    this.stats.totalQueries++;
    if (fromCache) {
      this.stats.cacheHits++;
      // Cache hits are free
      return;
    }
    if (usedGPT4) {
      this.stats.gpt4TurboCalls++;
      this.stats.totalCost += COST_ESTIMATES.GPT4_TURBO_PER_QUERY;
    }
    this.updateAverageCost();
  }

  recordTaxonomyResolution(usedGPT4: boolean, fromCache: boolean) {
    if (fromCache) {
      // Cache hits are free
      return;
    }
    if (usedGPT4) {
      this.stats.gpt4Calls++;
      this.stats.totalCost += COST_ESTIMATES.GPT4_PER_QUERY;
    } else {
      this.stats.localMappings++;
      // Local mappings are free
    }
    this.updateAverageCost();
  }

  recordGooglePlacesEnhancement(doctorCount: number) {
    this.stats.totalCost += doctorCount * COST_ESTIMATES.GOGLE_PLACES_PER_DOCTOR;
    this.updateAverageCost();
  }

  private updateAverageCost() {
    this.stats.averageCost =
      this.stats.totalQueries > 0
        ? this.stats.totalCost / this.stats.totalQueries
        : 0;
  }

  getStats(): CostStats {
    return {
      ...this.stats,
      averageCost: this.stats.averageCost,
    };
  }

  getCostBreakdown() {
    return {
      totalCost: this.stats.totalCost,
      averageCost: this.stats.averageCost,
      breakdown: {
        queryParsing: this.stats.gpt4TurboCalls * COST_ESTIMATES.GPT4_TURBO_PER_QUERY,
        taxonomyResolution: this.stats.gpt4Calls * COST_ESTIMATES.GPT4_PER_QUERY,
        googlePlaces: Math.max(0, this.stats.totalCost - 
          (this.stats.gpt4TurboCalls * COST_ESTIMATES.GPT4_TURBO_PER_QUERY) -
          (this.stats.gpt4Calls * COST_ESTIMATES.GPT4_PER_QUERY)),
      },
      efficiency: {
        cacheHitRate: this.stats.totalQueries > 0 
          ? this.stats.cacheHits / this.stats.totalQueries 
          : 0,
        localMappingRate: (this.stats.gpt4Calls + this.stats.localMappings) > 0
          ? this.stats.localMappings / (this.stats.gpt4Calls + this.stats.localMappings)
          : 0,
      },
    };
  }

  reset() {
    this.stats = {
      totalQueries: 0,
      totalCost: 0,
      averageCost: 0,
      gpt4TurboCalls: 0,
      gpt4Calls: 0,
      localMappings: 0,
      cacheHits: 0,
    };
  }
}

// Singleton instance
export const costMonitor = new CostMonitor();

