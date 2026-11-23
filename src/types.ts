export type SubscriptionTierType = 'explorer' | 'investigator' | 'enterprise';

export interface SubscriptionPlan {
  id: SubscriptionTierType;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  description: string;
  popular?: boolean;
  features: string[];
  dossierAccess: boolean;
  alprAuditDepth: 'summary' | 'full' | 'fleet';
  exportEnabled: boolean;
}

export interface PhoneLookupResult {
  phoneNumber: string;
  formattedNational: string;
  formattedInternational: string;
  countryCode: string;
  countryName: string;
  carrier: {
    name: string;
    type: 'Tier-1 Wireless' | 'Regional Mobile' | 'VoIP / Cloud PBX' | 'Landline ILEC' | 'Toll-Free CLEC';
    networkCode: string;
    originalNetwork: string;
    isPorted: boolean;
    lastPortedDate?: string;
  };
  lineType: 'Mobile' | 'Landline' | 'VoIP' | 'Toll-Free' | 'Virtual / Burner';
  riskAnalysis: {
    spamScore: number; // 0 - 100
    riskLevel: 'Low' | 'Moderate' | 'High' | 'Severe';
    primaryFlag: string;
    totalReports: number;
    activityCategory: 'Nominal Consumer' | 'Commercial Business' | 'Telemarketing Robot' | 'Phishing / Impersonation' | 'Debt Collection';
    lastActiveDate: string;
  };
  location: {
    city: string;
    state: string;
    postalCode: string;
    timeZone: string;
    rateCenter: string;
    coordinates: [number, number];
    rateCenterCoordinates?: [number, number];
    geocodeAccuracy?: 'rooftop_address' | 'approximate_address' | 'rate_center';
    formattedAddress?: string;
    geocodeQuotaExceeded?: boolean;
  };
  ownerSummary?: {
    status: 'verified_owner' | 'cnam_only' | 'reserved_block' | 'cpni_protected';
    ownerName: string;
    ownerType: 'Individual' | 'Corporate' | 'Government / Public' | 'Unlisted';
    streetAddress?: string;
    cityStateZip?: string;
    sourceLabel: string;
    sourceUrl?: string;
    note?: string;
  };
  dossier?: {
    subscriberName: string;
    subscriberType: 'Individual' | 'Corporate' | 'Undisclosed / Prepaid';
    addressHistory: Array<{
      street: string;
      cityState: string;
      years: string;
      isCurrent: boolean;
    }>;
    associatedEmails: string[];
    breachExposures: Array<{
      breachName: string;
      year: number;
      compromisedData: string[];
    }>;
    digitalFootprint: Array<{
      platform: string;
      profileHandle: string;
      verified: boolean;
    }>;
    altPhoneNumbers: string[];
  };
}

export type AlprQueryStatus = 'queried_active' | 'passive_scan_only' | 'hotlist_flagged';

export interface AlprQueryAuditRecord {
  queryId: string;
  timestamp: string;
  requestingAgency: string;
  agencyType: 'Municipal Police' | 'County Sheriff' | 'State Highway Patrol' | 'HOA Security' | 'Commercial ALPR Aggregator';
  queryReason: string;
  searchRadiusMiles?: number;
  officerBadgeOrCaseId: string;
  matchedCriteria: string;
  alertDisposition: 'Inquiry Logged' | 'Hotlist Cross-Check Negative' | 'Active Vehicle Canvass' | 'Traffic Corroboration';
}

export interface AlprCameraSighting {
  id: string;
  timestamp: string;
  cameraId: string;
  cameraName: string;
  cameraType: 'Flock Falcon (Fixed)' | 'Flock Sentinel (HOA)' | 'Mobile Cruiser ALPR' | 'Highway Transit Pole';
  municipalityAgency: string;
  intersectionOrLocation: string;
  coordinates: [number, number];
  directionOfTravel: 'Northbound' | 'Southbound' | 'Eastbound' | 'Westbound';
  laneNumber: number;
  captureConfidence: number; // e.g. 99.2%
  speedEstimateMph: number;
  retentionDaysRemaining: number;
  weatherLightCondition: 'Daylight / Clear' | 'Dusk / Low Light' | 'Night / IR Active';
}

export interface VehicleAlprAuditResult {
  plateNumber: string;
  state: string;
  vehicleDetails: {
    year: number;
    make: string;
    model: string;
    color: string;
    bodyStyle: string;
    vinMasked: string;
  };
  auditSummary: {
    overallStatus: AlprQueryStatus;
    totalDetections30Days: number;
    totalDetections90Days: number;
    activeAgencyQueriesCount: number;
    lastDetectedTimestamp: string;
    lastDetectedLocation: string;
    exposureScore: number; // 0 - 100
    exposureLevel: 'Low Exposure' | 'Moderate Exposure' | 'Heavy Surveillance Corridor';
    retentionPolicyStandard: string;
  };
  queryAuditLog: AlprQueryAuditRecord[];
  cameraSightings: AlprCameraSighting[];
  reciprocalAgencies: Array<{
    agencyName: string;
    jurisdiction: string;
    dataShareScope: 'Full Real-Time Access' | 'Historical Search (30-day)' | 'Audit Log Only';
  }>;
}

export interface UserProfileRecord {
  uid: string;
  email: string;
  displayName: string;
  tier: SubscriptionTierType;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SavedPhoneLookupRecord {
  id: string;
  ownerId: string;
  phoneNumber: string;
  formattedNational: string;
  carrierName: string;
  lineType: 'Mobile' | 'Landline' | 'VoIP' | 'Toll-Free' | 'Virtual / Burner';
  spamScore: number;
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Severe';
  subscriberPreview?: string;
  webSummary?: string;
  savedAt?: unknown;
}

export interface SavedAlprAuditRecord {
  id: string;
  ownerId: string;
  plateNumber: string;
  state: string;
  overallStatus: 'queried_active' | 'passive_scan_only';
  detections30Days: number;
  activeQueriesCount: number;
  lastLocation: string;
  retentionStandard: string;
  savedAt?: unknown;
}

export interface WatchlistItemRecord {
  id: string;
  ownerId: string;
  itemType: 'phone' | 'plate';
  targetValue: string;
  jurisdictionState?: string;
  label: string;
  lastStatus: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

