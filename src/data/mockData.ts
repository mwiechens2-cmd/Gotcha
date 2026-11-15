import { PhoneLookupResult, VehicleAlprAuditResult, SubscriptionPlan } from '../types';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'explorer',
    name: 'Explorer',
    priceMonthly: 0,
    priceAnnual: 0,
    description: 'Basic carrier validation and public telecom verification.',
    features: [
      'Preliminary Carrier & Line Type detection',
      'Basic Spam / Scam risk score',
      'Rate center & geographical switch location',
      '1 Vehicle ALPR scan summary per month',
      'Public records law guidelines overview',
    ],
    dossierAccess: false,
    alprAuditDepth: 'summary',
    exportEnabled: false,
  },
  {
    id: 'investigator',
    name: 'Investigator Pro',
    priceMonthly: 29,
    priceAnnual: 24, // $288 billed annually ($24/mo)
    description: 'Full unredacted OSINT dossiers and complete ALPR surveillance audit logs.',
    popular: true,
    features: [
      'Full Unredacted OSINT Phone Dossier',
      'Subscriber name, address history & emails',
      'Breach exposure data & linked social profiles',
      'Carrier porting timeline & VoIP infrastructure check',
      'Complete Flock / ALPR Camera Sighting Logs',
      '"Looked Into" Law Enforcement Query Audit',
      'Camera hardware models, direction & speeds',
      'Automated FOIA & Deletion Request Generator',
      'High-resolution PDF & JSON dossier export',
    ],
    dossierAccess: true,
    alprAuditDepth: 'full',
    exportEnabled: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise OSINT',
    priceMonthly: 89,
    priceAnnual: 72,
    description: 'Continuous monitoring, fleet auditing, and agency reciprocity mapping.',
    features: [
      'Everything in Investigator Pro',
      'Up to 25 monitored plates & phone lines',
      'Real-time webhook & SMS query alert notifications',
      'Full agency-to-agency Flock Talon network graph',
      'Historical 12-month ALPR retention reconstruction',
      'Dedicated legal compliance export for court evidence',
      'Bulk batch CSV lookup & REST API access',
    ],
    dossierAccess: true,
    alprAuditDepth: 'fleet',
    exportEnabled: true,
  },
];

export const PRESET_PHONES: Array<{ label: string; number: string; description: string }> = [
  {
    label: 'High-Risk VoIP Robocaller',
    number: '+1 (415) 890-4421',
    description: 'Twilio Cloud PBX flagged for IRS/Tech Support impersonation spam.',
  },
  {
    label: 'Verified Corporate Line',
    number: '+1 (212) 555-0199',
    description: 'Tier-1 Verizon Wireless commercial line with clear footprint.',
  },
  {
    label: 'Personal Mobile (Ported)',
    number: '+1 (512) 843-9012',
    description: 'AT&T Mobility wireless line ported from T-Mobile USA.',
  },
  {
    label: 'Debt Collection Center',
    number: '+1 (800) 672-3190',
    description: 'Toll-Free CLEC number with hundreds of FCC call complaints.',
  },
];

export const PRESET_PLATES: Array<{ label: string; plate: string; state: string; description: string }> = [
  {
    label: 'Active Query Flag (Looked Into)',
    plate: '7XYZ892',
    state: 'CA',
    description: 'Active law enforcement investigative radius search logged within 48h.',
  },
  {
    label: 'Nominal Commuter (Passive Only)',
    plate: 'TEX-4921',
    state: 'TX',
    description: '9 passive municipal camera passes, zero active law enforcement searches.',
  },
  {
    label: 'High-Surveillance Corridor',
    plate: 'FL-88A2K',
    state: 'FL',
    description: '34 detections across HOA Gate Sentinels and highway Falcon nodes.',
  },
  {
    label: 'Routine Hotlist Sync',
    plate: 'GA-9KL42',
    state: 'GA',
    description: 'Cobb County Police Dept automated NCIC sync record with clean status.',
  },
];

export const MOCK_PHONE_DATABASE: Record<string, PhoneLookupResult> = {
  '14158904421': {
    phoneNumber: '+14158904421',
    formattedNational: '(415) 890-4421',
    formattedInternational: '+1 415-890-4421',
    countryCode: 'US',
    countryName: 'United States',
    carrier: {
      name: 'Twilio / Bandwidth.com Inc.',
      type: 'VoIP / Cloud PBX',
      networkCode: 'US-TWL-01',
      originalNetwork: 'Twilio Inc.',
      isPorted: true,
      lastPortedDate: '2024-03-12',
    },
    lineType: 'VoIP',
    riskAnalysis: {
      spamScore: 94,
      riskLevel: 'Severe',
      primaryFlag: 'Automated Robocall Phishing Cluster',
      totalReports: 1842,
      activityCategory: 'Phishing / Impersonation',
      lastActiveDate: '2026-11-10T14:22:00Z',
    },
    location: {
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94107',
      timeZone: 'America/Los_Angeles (PST)',
      rateCenter: 'SNFCCA01DS0',
      coordinates: [37.7749, -122.4194],
    },
    dossier: {
      subscriberName: 'Apex Cloud Lead Systems LLC (Disputed Identity)',
      subscriberType: 'Corporate',
      addressHistory: [
        { street: '548 Market St, Suite #8911', cityState: 'San Francisco, CA 94104', years: '2023 - Present', isCurrent: true },
        { street: '1209 Orange St, Corp Trust Center', cityState: 'Wilmington, DE 19801', years: '2021 - 2023', isCurrent: false },
      ],
      associatedEmails: ['billing@apexleadnetworks.io', 'tech-ops@virtualroute.net'],
      breachExposures: [
        { breachName: 'LeadPoint B2B Aggregator Leak', year: 2024, compromisedData: ['API Keys', 'VoIP SIP Credentials', 'Call Logs'] },
        { breachName: 'TeleSpam Blacklist Database', year: 2025, compromisedData: ['Originating IP Pool', 'Asterisk Server Configs'] },
      ],
      digitalFootprint: [
        { platform: 'Domain Registrant (WHOIS)', profileHandle: 'apexleadnetworks.io', verified: true },
        { platform: 'SIP Gateway Registry', profileHandle: 'sip.trunk.us-west-1.twl', verified: true },
        { platform: 'FCC RoboCall Mitigation Database', profileHandle: 'RMD-2024-99218', verified: false },
      ],
      altPhoneNumbers: ['+1 (415) 890-4422', '+1 (415) 890-4429', '+1 (628) 201-9011'],
    },
  },
  '12125550199': {
    phoneNumber: '+12125550199',
    formattedNational: '(212) 555-0199',
    formattedInternational: '+1 212-555-0199',
    countryCode: 'US',
    countryName: 'United States',
    carrier: {
      name: 'Verizon Wireless (Cellco Partnership)',
      type: 'Tier-1 Wireless',
      networkCode: 'US-VZW-60',
      originalNetwork: 'Verizon Wireless',
      isPorted: false,
    },
    lineType: 'Mobile',
    riskAnalysis: {
      spamScore: 4,
      riskLevel: 'Low',
      primaryFlag: 'Verified Enterprise Mobility Account',
      totalReports: 0,
      activityCategory: 'Commercial Business',
      lastActiveDate: '2026-11-11T16:04:00Z',
    },
    location: {
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      timeZone: 'America/New_York (EST)',
      rateCenter: 'NYCKNY37',
      coordinates: [40.7128, -74.006],
    },
    dossier: {
      subscriberName: 'Vanguard Media Group Inc. (Corp Line #14)',
      subscriberType: 'Corporate',
      addressHistory: [
        { street: '350 5th Avenue, 44th Floor', cityState: 'New York, NY 10118', years: '2019 - Present', isCurrent: true },
      ],
      associatedEmails: ['it-comms@vanguardmedia.com', 'press@vanguardmedia.com'],
      breachExposures: [],
      digitalFootprint: [
        { platform: 'LinkedIn Corporate Directory', profileHandle: 'vanguard-media-nyc', verified: true },
        { platform: 'Dun & Bradstreet DUNS', profileHandle: 'DUNS-09-182-3819', verified: true },
      ],
      altPhoneNumbers: ['+1 (212) 555-0100', '+1 (212) 555-0200'],
    },
  },
  '15128439012': {
    phoneNumber: '+15128439012',
    formattedNational: '(512) 843-9012',
    formattedInternational: '+1 512-843-9012',
    countryCode: 'US',
    countryName: 'United States',
    carrier: {
      name: 'AT&T Mobility LLC',
      type: 'Tier-1 Wireless',
      networkCode: 'US-ATT-410',
      originalNetwork: 'T-Mobile USA Inc.',
      isPorted: true,
      lastPortedDate: '2023-08-19',
    },
    lineType: 'Mobile',
    riskAnalysis: {
      spamScore: 12,
      riskLevel: 'Low',
      primaryFlag: 'Nominal Personal Subscriber',
      totalReports: 1,
      activityCategory: 'Nominal Consumer',
      lastActiveDate: '2026-11-11T12:45:00Z',
    },
    location: {
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      timeZone: 'America/Chicago (CST)',
      rateCenter: 'AUSTTXGR',
      coordinates: [30.2672, -97.7431],
    },
    dossier: {
      subscriberName: 'Marcus E. Thornton',
      subscriberType: 'Individual',
      addressHistory: [
        { street: '1104 S Congress Ave, Apt 3B', cityState: 'Austin, TX 78704', years: '2022 - Present', isCurrent: true },
        { street: '4208 Guadalupe St', cityState: 'Austin, TX 78751', years: '2018 - 2022', isCurrent: false },
      ],
      associatedEmails: ['m.thornton.atx@gmail.com', 'marcus@austintechlabs.dev'],
      breachExposures: [
        { breachName: 'Dropbox Credential Leak (Historical)', year: 2016, compromisedData: ['Email', 'Hashed Passwords'] },
        { breachName: 'AT&T Data Customer Incident', year: 2024, compromisedData: ['Call Metadata Records', 'Account PIN Hash'] },
      ],
      digitalFootprint: [
        { platform: 'GitHub', profileHandle: 'marcus-thornton-dev', verified: true },
        { platform: 'Telegram Public Directory', profileHandle: '@m_thornton_atx', verified: false },
      ],
      altPhoneNumbers: ['+1 (512) 843-9013'],
    },
  },
  '18006723190': {
    phoneNumber: '+18006723190',
    formattedNational: '(800) 672-3190',
    formattedInternational: '+1 800-672-3190',
    countryCode: 'US',
    countryName: 'United States',
    carrier: {
      name: 'Lumen Technologies / Level 3 Communications',
      type: 'Toll-Free CLEC',
      networkCode: 'US-LUM-00',
      originalNetwork: 'AT&T Toll-Free Service',
      isPorted: true,
      lastPortedDate: '2022-11-04',
    },
    lineType: 'Toll-Free',
    riskAnalysis: {
      spamScore: 88,
      riskLevel: 'High',
      primaryFlag: 'Aggressive Auto-Dialer Debt Collection',
      totalReports: 730,
      activityCategory: 'Debt Collection',
      lastActiveDate: '2026-11-11T09:15:00Z',
    },
    location: {
      city: 'National Toll-Free Routing',
      state: 'US',
      postalCode: '00000',
      timeZone: 'Multi-Region (US/CAN)',
      rateCenter: 'TOLLFREE-800',
      coordinates: [39.8283, -98.5795],
    },
    dossier: {
      subscriberName: 'Midland Credit Management Regional Outbound',
      subscriberType: 'Corporate',
      addressHistory: [
        { street: '350 Camino De La Reina, Suite 100', cityState: 'San Diego, CA 92108', years: '2017 - Present', isCurrent: true },
      ],
      associatedEmails: ['inquiries@mcm-collections.org'],
      breachExposures: [
        { breachName: 'CFPB Public Complaint Registry', year: 2025, compromisedData: ['Call Scripts', 'FDCPA Violation Reports'] },
      ],
      digitalFootprint: [
        { platform: 'Better Business Bureau File', profileHandle: 'midland-credit-ca', verified: true },
      ],
      altPhoneNumbers: ['+1 (800) 672-3191', '+1 (800) 672-3192'],
    },
  },
};

export const MOCK_ALPR_DATABASE: Record<string, VehicleAlprAuditResult> = {
  '7XYZ892_CA': {
    plateNumber: '7XYZ892',
    state: 'CA',
    vehicleDetails: {
      year: 2022,
      make: 'Honda',
      model: 'Civic Sport',
      color: 'Sonic Gray Pearl',
      bodyStyle: 'Sedan 4D',
      vinMasked: '1HGCV1F16NA08****',
    },
    auditSummary: {
      overallStatus: 'queried_active',
      totalDetections30Days: 16,
      totalDetections90Days: 48,
      activeAgencyQueriesCount: 2,
      lastDetectedTimestamp: '2026-11-11T14:48:12-08:00',
      lastDetectedLocation: 'Ventura Blvd & Sepulveda Blvd, Los Angeles, CA',
      exposureScore: 82,
      exposureLevel: 'Heavy Surveillance Corridor',
      retentionPolicyStandard: 'California SB 34 Compliance (60-day auto-purge for non-investigative hits)',
    },
    queryAuditLog: [
      {
        queryId: 'QRY-2026-LAPD-88192',
        timestamp: '2026-11-10T22:15:40-08:00',
        requestingAgency: 'Los Angeles Police Department (Valley Traffic Div)',
        agencyType: 'Municipal Police',
        queryReason: 'Intersection Canvas: Automated Geo-Fence Correlation (0.5 mi radius of reported incident)',
        searchRadiusMiles: 0.5,
        officerBadgeOrCaseId: 'Badge #4109 / Ref: IR-2026-77821',
        matchedCriteria: 'Plate exact match on northbound camera sensor',
        alertDisposition: 'Active Vehicle Canvass',
      },
      {
        queryId: 'QRY-2026-LASD-04122',
        timestamp: '2026-11-04T11:02:18-08:00',
        requestingAgency: 'Los Angeles County Sheriff Dept (West Hollywood Station)',
        agencyType: 'County Sheriff',
        queryReason: 'Regional ALPR Sharing Audit: Routine Stolen Vehicle & BOLO Hotlist Sweep',
        searchRadiusMiles: 5.0,
        officerBadgeOrCaseId: 'Auto-Task Scheduler / Unit ALPR-8',
        matchedCriteria: 'Daily NCIC Hotlist Cross-Reference',
        alertDisposition: 'Hotlist Cross-Check Negative',
      },
    ],
    cameraSightings: [
      {
        id: 'FLK-CAM-90118',
        timestamp: '2026-11-11T14:48:12-08:00',
        cameraId: 'FLOCK-FALCON-LA-8812',
        cameraName: 'Ventura Blvd & Sepulveda Blvd (Pole NW)',
        cameraType: 'Flock Falcon (Fixed)',
        municipalityAgency: 'City of Los Angeles / LAPD Partner Node',
        intersectionOrLocation: 'Ventura Blvd & Sepulveda Blvd, Sherman Oaks, CA',
        coordinates: [34.1524, -118.4665],
        directionOfTravel: 'Westbound',
        laneNumber: 2,
        captureConfidence: 99.6,
        speedEstimateMph: 34,
        retentionDaysRemaining: 59,
        weatherLightCondition: 'Daylight / Clear',
      },
      {
        id: 'FLK-CAM-90119',
        timestamp: '2026-11-11T08:12:05-08:00',
        cameraId: 'FLOCK-FALCON-LA-7402',
        cameraName: 'Burbank Blvd & Van Nuys Blvd',
        cameraType: 'Flock Falcon (Fixed)',
        municipalityAgency: 'City of Los Angeles / LAPD Partner Node',
        intersectionOrLocation: 'Burbank Blvd & Van Nuys Blvd, Van Nuys, CA',
        coordinates: [34.1722, -118.4489],
        directionOfTravel: 'Northbound',
        laneNumber: 1,
        captureConfidence: 98.9,
        speedEstimateMph: 41,
        retentionDaysRemaining: 59,
        weatherLightCondition: 'Daylight / Clear',
      },
      {
        id: 'FLK-CAM-90045',
        timestamp: '2026-11-09T18:34:22-08:00',
        cameraId: 'FLOCK-SENT-HOA-0419',
        cameraName: 'Oakridge Ridge Estates Entrance Gate',
        cameraType: 'Flock Sentinel (HOA)',
        municipalityAgency: 'Oakridge Homeowners Association Private Node',
        intersectionOrLocation: 'Oakridge Ave & Mountain View Rd, Encino, CA',
        coordinates: [34.1598, -118.5112],
        directionOfTravel: 'Southbound',
        laneNumber: 1,
        captureConfidence: 99.2,
        speedEstimateMph: 18,
        retentionDaysRemaining: 27,
        weatherLightCondition: 'Dusk / Low Light',
      },
      {
        id: 'FLK-CAM-89410',
        timestamp: '2026-11-07T12:05:44-08:00',
        cameraId: 'ALPR-CHP-MOB-1102',
        cameraName: 'US-101 Northbound Milemarker 18.2',
        cameraType: 'Mobile Cruiser ALPR',
        municipalityAgency: 'California Highway Patrol (West Valley Unit)',
        intersectionOrLocation: 'US-101 at Coldwater Canyon Ave, Studio City, CA',
        coordinates: [34.1485, -118.4142],
        directionOfTravel: 'Northbound',
        laneNumber: 3,
        captureConfidence: 97.8,
        speedEstimateMph: 66,
        retentionDaysRemaining: 55,
        weatherLightCondition: 'Daylight / Clear',
      },
    ],
    reciprocalAgencies: [
      { agencyName: 'Los Angeles Police Dept', jurisdiction: 'Los Angeles, CA', dataShareScope: 'Full Real-Time Access' },
      { agencyName: 'Los Angeles County Sheriff', jurisdiction: 'LA County, CA', dataShareScope: 'Historical Search (30-day)' },
      { agencyName: 'Beverly Hills Police Dept', jurisdiction: 'Beverly Hills, CA', dataShareScope: 'Historical Search (30-day)' },
      { agencyName: 'Oakridge HOA Security Portal', jurisdiction: 'Private HOA Encino', dataShareScope: 'Audit Log Only' },
    ],
  },
  'TEX-4921_TX': {
    plateNumber: 'TEX-4921',
    state: 'TX',
    vehicleDetails: {
      year: 2021,
      make: 'Ford',
      model: 'F-150 Lariat SuperCrew',
      color: 'Carbonized Gray Metallic',
      bodyStyle: 'Truck 4D',
      vinMasked: '1FTFW1E84MFA9****',
    },
    auditSummary: {
      overallStatus: 'passive_scan_only',
      totalDetections30Days: 9,
      totalDetections90Days: 24,
      activeAgencyQueriesCount: 0,
      lastDetectedTimestamp: '2026-11-10T17:19:30-06:00',
      lastDetectedLocation: 'Lamar Blvd & Barton Springs Rd, Austin, TX',
      exposureScore: 36,
      exposureLevel: 'Moderate Exposure',
      retentionPolicyStandard: 'Texas Local Govt Code Chapter 370 (30-day retention on passive captures)',
    },
    queryAuditLog: [
      {
        queryId: 'QRY-2026-TX-SYNC-1198',
        timestamp: '2026-11-10T04:00:00-06:00',
        requestingAgency: 'Texas Department of Public Safety (DPS ALPR Gateway)',
        agencyType: 'State Highway Patrol',
        queryReason: 'Daily Automated NCIC/TCIC Clean Sync Check (Passive Batch)',
        searchRadiusMiles: 0,
        officerBadgeOrCaseId: 'Automated Daemon / TCIC-ALPR',
        matchedCriteria: 'System Batch Verification',
        alertDisposition: 'Hotlist Cross-Check Negative',
      },
    ],
    cameraSightings: [
      {
        id: 'FLK-TX-4401',
        timestamp: '2026-11-10T17:19:30-06:00',
        cameraId: 'FLOCK-FALCON-ATX-2041',
        cameraName: 'S Lamar Blvd & Barton Springs Rd',
        cameraType: 'Flock Falcon (Fixed)',
        municipalityAgency: 'City of Austin / Austin Police Dept',
        intersectionOrLocation: 'S Lamar Blvd & Barton Springs Rd, Austin, TX',
        coordinates: [30.2612, -97.7583],
        directionOfTravel: 'Northbound',
        laneNumber: 1,
        captureConfidence: 99.4,
        speedEstimateMph: 28,
        retentionDaysRemaining: 29,
        weatherLightCondition: 'Dusk / Low Light',
      },
      {
        id: 'FLK-TX-4389',
        timestamp: '2026-11-08T09:41:15-06:00',
        cameraId: 'FLOCK-FALCON-ATX-1980',
        cameraName: 'S Congress Ave & Oltorf St',
        cameraType: 'Flock Falcon (Fixed)',
        municipalityAgency: 'City of Austin / Austin Police Dept',
        intersectionOrLocation: 'S Congress Ave & Oltorf St, Austin, TX',
        coordinates: [30.2415, -97.7554],
        directionOfTravel: 'Southbound',
        laneNumber: 2,
        captureConfidence: 99.1,
        speedEstimateMph: 31,
        retentionDaysRemaining: 27,
        weatherLightCondition: 'Daylight / Clear',
      },
    ],
    reciprocalAgencies: [
      { agencyName: 'Austin Police Department', jurisdiction: 'Austin, TX', dataShareScope: 'Full Real-Time Access' },
      { agencyName: 'Travis County Sheriff', jurisdiction: 'Travis County, TX', dataShareScope: 'Historical Search (30-day)' },
    ],
  },
  'FL-88A2K_FL': {
    plateNumber: 'FL-88A2K',
    state: 'FL',
    vehicleDetails: {
      year: 2023,
      make: 'Tesla',
      model: 'Model Y Long Range',
      color: 'Pearl White Multi-Coat',
      bodyStyle: 'SUV 4D',
      vinMasked: '7SAYGDEE4PF67****',
    },
    auditSummary: {
      overallStatus: 'passive_scan_only',
      totalDetections30Days: 34,
      totalDetections90Days: 98,
      activeAgencyQueriesCount: 0,
      lastDetectedTimestamp: '2026-11-11T16:20:00-05:00',
      lastDetectedLocation: 'Palmetto Expressway & NW 103rd St, Miami, FL',
      exposureScore: 91,
      exposureLevel: 'Heavy Surveillance Corridor',
      retentionPolicyStandard: 'Florida Statute § 316.0777 (Flock camera local retention up to 90 days)',
    },
    queryAuditLog: [
      {
        queryId: 'QRY-2026-FL-HOA-9921',
        timestamp: '2026-11-09T08:14:00-05:00',
        requestingAgency: 'Biscayne Gated Communities Security Consortium',
        agencyType: 'HOA Security',
        queryReason: 'Community Perimeter Access Log: Authorized Resident Decal Audit',
        searchRadiusMiles: 1.0,
        officerBadgeOrCaseId: 'Sec-Mgr #104 / Access Patrol',
        matchedCriteria: 'Registered Plate Verification',
        alertDisposition: 'Inquiry Logged',
      },
    ],
    cameraSightings: [
      {
        id: 'FLK-FL-1002',
        timestamp: '2026-11-11T16:20:00-05:00',
        cameraId: 'FLOCK-FALCON-MIA-0911',
        cameraName: 'Palmetto Expressway & NW 103rd St',
        cameraType: 'Highway Transit Pole',
        municipalityAgency: 'Miami-Dade Police Dept / Flock Network',
        intersectionOrLocation: 'Palmetto Expressway & NW 103rd St, Hialeah, FL',
        coordinates: [25.8674, -80.3241],
        directionOfTravel: 'Southbound',
        laneNumber: 4,
        captureConfidence: 99.8,
        speedEstimateMph: 64,
        retentionDaysRemaining: 89,
        weatherLightCondition: 'Daylight / Clear',
      },
      {
        id: 'FLK-FL-1003',
        timestamp: '2026-11-10T19:05:12-05:00',
        cameraId: 'FLOCK-SENT-MIA-0422',
        cameraName: 'Biscayne Palms Main Gate Sentinel',
        cameraType: 'Flock Sentinel (HOA)',
        municipalityAgency: 'Biscayne Palms HOA Security Node',
        intersectionOrLocation: 'Palms Blvd & Biscayne Dr, Aventura, FL',
        coordinates: [25.9564, -80.1392],
        directionOfTravel: 'Eastbound',
        laneNumber: 1,
        captureConfidence: 99.5,
        speedEstimateMph: 15,
        retentionDaysRemaining: 28,
        weatherLightCondition: 'Dusk / Low Light',
      },
    ],
    reciprocalAgencies: [
      { agencyName: 'Miami-Dade Police Dept', jurisdiction: 'Miami-Dade County, FL', dataShareScope: 'Full Real-Time Access' },
      { agencyName: 'City of Miami Police', jurisdiction: 'Miami, FL', dataShareScope: 'Historical Search (30-day)' },
      { agencyName: 'Florida Highway Patrol', jurisdiction: 'Statewide FL', dataShareScope: 'Full Real-Time Access' },
    ],
  },
};

// Generates dynamic lookup for arbitrary phone numbers
export function generatePhoneLookup(rawInput: string): PhoneLookupResult {
  const digits = rawInput.replace(/\D/g, '');
  const cleanNumber = digits.length === 10 ? `1${digits}` : digits;

  // Check static database first
  if (MOCK_PHONE_DATABASE[cleanNumber]) {
    return MOCK_PHONE_DATABASE[cleanNumber];
  }

  // Deterministic seed based on digits
  const seed = cleanNumber.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const carriers = [
    { name: 'T-Mobile USA Inc.', type: 'Tier-1 Wireless' as const, line: 'Mobile' as const },
    { name: 'AT&T Mobility LLC', type: 'Tier-1 Wireless' as const, line: 'Mobile' as const },
    { name: 'Verizon Wireless', type: 'Tier-1 Wireless' as const, line: 'Mobile' as const },
    { name: 'Twilio / Cloud VoIP Systems', type: 'VoIP / Cloud PBX' as const, line: 'VoIP' as const },
    { name: 'Charter Spectrum Mobile', type: 'Regional Mobile' as const, line: 'Mobile' as const },
  ];
  const chosenCarrier = carriers[seed % carriers.length];

  const spamScore = (seed * 17) % 96;
  const isHighRisk = chosenCarrier.line === 'VoIP' || spamScore > 65;

  const areaCode = digits.slice(-10, -7) || '555';
  const prefix = digits.slice(-7, -4) || '123';
  const lineNum = digits.slice(-4) || '4567';

  return {
    phoneNumber: `+1${areaCode}${prefix}${lineNum}`,
    formattedNational: `(${areaCode}) ${prefix}-${lineNum}`,
    formattedInternational: `+1 ${areaCode}-${prefix}-${lineNum}`,
    countryCode: 'US',
    countryName: 'United States',
    carrier: {
      name: chosenCarrier.name,
      type: chosenCarrier.type,
      networkCode: `US-NET-${(seed % 800) + 100}`,
      originalNetwork: chosenCarrier.name,
      isPorted: seed % 2 === 0,
      lastPortedDate: seed % 2 === 0 ? '2024-06-18' : undefined,
    },
    lineType: chosenCarrier.line,
    riskAnalysis: {
      spamScore,
      riskLevel: spamScore > 75 ? 'Severe' : spamScore > 40 ? 'Moderate' : 'Low',
      primaryFlag: isHighRisk ? 'Automated High-Volume Outbound Pattern' : 'Verified Consumer Allocation',
      totalReports: isHighRisk ? (seed % 450) + 40 : seed % 5,
      activityCategory: isHighRisk ? 'Telemarketing Robot' : 'Nominal Consumer',
      lastActiveDate: new Date(Date.now() - (seed % 48) * 3600000).toISOString(),
    },
    location: {
      city: 'Metro Regional Exchange',
      state: 'US-Centric',
      postalCode: `${10000 + (seed % 80000)}`,
      timeZone: 'America/New_York (EST)',
      rateCenter: `RC-${areaCode}-01`,
      coordinates: [37.7749, -122.4194],
    },
    dossier: {
      subscriberName: isHighRisk ? 'Redacted Commercial Entity / VoIP Trunk' : `Jordan ${String.fromCharCode(65 + (seed % 26))}. Miller`,
      subscriberType: isHighRisk ? 'Corporate' : 'Individual',
      addressHistory: [
        { street: `${100 + (seed % 900)} Oak Ridge Way`, cityState: `Metropolis, State ${10000 + (seed % 80000)}`, years: '2021 - Present', isCurrent: true },
      ],
      associatedEmails: [`subscriber.${areaCode}${prefix}@protonmail.com`],
      breachExposures: [
        { breachName: 'Aggregator Identity Index 2024', year: 2024, compromisedData: ['Billing Phone Hash', 'Carrier Association'] },
      ],
      digitalFootprint: [
        { platform: 'Telecommunications Carrier Registry', profileHandle: `MSISDN-1${areaCode}${prefix}${lineNum}`, verified: true },
      ],
      altPhoneNumbers: [`+1 (${areaCode}) ${prefix}-${String(parseInt(lineNum, 10) + 1).padStart(4, '0')}`],
    },
  };
}

// Generates dynamic ALPR surveillance audit for arbitrary license plates
export function generateVehicleAudit(rawPlate: string, state: string): VehicleAlprAuditResult {
  const cleanPlate = rawPlate.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const key = `${cleanPlate}_${state.toUpperCase()}`;

  if (MOCK_ALPR_DATABASE[key]) {
    return MOCK_ALPR_DATABASE[key];
  }

  const seed = cleanPlate.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const makes = ['Toyota RAV4', 'Chevrolet Silverado', 'Honda Accord', 'Subaru Outback', 'Hyundai Tucson'];
  const colors = ['Midnight Black', 'Oxford White', 'Magnetic Gray', 'Deep Blue Metallic', 'Silver Sky'];
  const chosenMake = makes[seed % makes.length].split(' ');
  const chosenColor = colors[seed % colors.length];

  const hasBeenLookedInto = seed % 3 === 0; // 1 out of 3 plates has an active query audit entry
  const totalDetections = (seed % 28) + 4;

  const now = Date.now();
  const lastSeenDate = new Date(now - (seed % 36) * 3600000).toISOString();

  const queryLog = hasBeenLookedInto
    ? [
        {
          queryId: `QRY-2026-${state}-99${seed % 900}`,
          timestamp: new Date(now - ((seed % 24) + 6) * 3600000).toISOString(),
          requestingAgency: `${state} Regional Law Enforcement ALPR Coalition`,
          agencyType: 'Municipal Police' as const,
          queryReason: 'Active Patrol Inquiries: Regional Radius Vehicle Scan Filter',
          searchRadiusMiles: 2.5,
          officerBadgeOrCaseId: `Unit Desk #${(seed % 300) + 100}`,
          matchedCriteria: 'Optical ALPR Plate Match across corridor cameras',
          alertDisposition: 'Inquiry Logged' as const,
        },
      ]
    : [
        {
          queryId: `QRY-2026-PASSIVE-${seed % 400}`,
          timestamp: new Date(now - 48 * 3600000).toISOString(),
          requestingAgency: `${state} Highway Patrol ALPR Gateway`,
          agencyType: 'State Highway Patrol' as const,
          queryReason: 'Automated 24h Hotlist Scrub (Stolen / Wanted / Amber Alert Sync)',
          searchRadiusMiles: 0,
          officerBadgeOrCaseId: 'NCIC Daemon #04',
          matchedCriteria: 'Batch Hotlist Scrub',
          alertDisposition: 'Hotlist Cross-Check Negative' as const,
        },
      ];

  const cameraSightings = [
    {
      id: `FLK-NODE-${seed}-1`,
      timestamp: lastSeenDate,
      cameraId: `FLOCK-FALCON-${state}-${(seed % 9000) + 1000}`,
      cameraName: `Main Arterial Expressway & Node ${(seed % 40) + 1}`,
      cameraType: 'Flock Falcon (Fixed)' as const,
      municipalityAgency: `${state} Municipal Police Dept`,
      intersectionOrLocation: `Expressway 40 & Central Ave, Zone ${(seed % 12) + 1}`,
      coordinates: [34.0522 + (seed % 10) * 0.01, -118.2437 + (seed % 10) * 0.01] as [number, number],
      directionOfTravel: seed % 2 === 0 ? ('Northbound' as const) : ('Eastbound' as const),
      laneNumber: (seed % 3) + 1,
      captureConfidence: 98.4 + ((seed % 15) / 10),
      speedEstimateMph: 35 + (seed % 25),
      retentionDaysRemaining: 30 - ((seed % 15) + 1),
      weatherLightCondition: 'Daylight / Clear' as const,
    },
    {
      id: `FLK-NODE-${seed}-2`,
      timestamp: new Date(now - 72 * 3600000).toISOString(),
      cameraId: `FLOCK-SENT-HOA-${(seed % 500) + 100}`,
      cameraName: `Pinecrest Boulevard Community Sentinel`,
      cameraType: 'Flock Sentinel (HOA)' as const,
      municipalityAgency: `Pinecrest Community HOA Private Node`,
      intersectionOrLocation: `Pinecrest Blvd & Glenwood Gate, ${state}`,
      coordinates: [34.0622 + (seed % 10) * 0.01, -118.2537 + (seed % 10) * 0.01] as [number, number],
      directionOfTravel: 'Southbound' as const,
      laneNumber: 1,
      captureConfidence: 99.1,
      speedEstimateMph: 22,
      retentionDaysRemaining: 24,
      weatherLightCondition: 'Dusk / Low Light' as const,
    },
  ];

  return {
    plateNumber: cleanPlate,
    state: state.toUpperCase(),
    vehicleDetails: {
      year: 2020 + (seed % 5),
      make: chosenMake[0],
      model: chosenMake.slice(1).join(' '),
      color: chosenColor,
      bodyStyle: 'Crossover / SUV',
      vinMasked: `1HGCV1${state}${(seed % 90000) + 10000}****`,
    },
    auditSummary: {
      overallStatus: hasBeenLookedInto ? 'queried_active' : 'passive_scan_only',
      totalDetections30Days: totalDetections,
      totalDetections90Days: totalDetections * 3,
      activeAgencyQueriesCount: hasBeenLookedInto ? 1 : 0,
      lastDetectedTimestamp: lastSeenDate,
      lastDetectedLocation: `Arterial Corridor, ${state}`,
      exposureScore: hasBeenLookedInto ? 78 : (seed % 45) + 20,
      exposureLevel: hasBeenLookedInto ? 'Heavy Surveillance Corridor' : 'Moderate Exposure',
      retentionPolicyStandard: `${state} Statutory ALPR Retention Standard (30-day default window)`,
    },
    queryAuditLog: queryLog,
    cameraSightings,
    reciprocalAgencies: [
      { agencyName: `${state} State Police ALPR Hub`, jurisdiction: `Statewide ${state}`, dataShareScope: 'Full Real-Time Access' },
      { agencyName: 'Regional County Sheriff Dispatch', jurisdiction: `County Jurisdiction`, dataShareScope: 'Historical Search (30-day)' },
    ],
  };
}
