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
      postalCode: '94104',
      timeZone: 'America/Los_Angeles (PST)',
      rateCenter: 'SNFCCA01DS0',
      coordinates: [37.789719, -122.401406],
      rateCenterCoordinates: [37.7749, -122.4194],
      geocodeAccuracy: 'rooftop_address',
      formattedAddress: '548 Market St, San Francisco, CA 94104, USA',
    },
    ownerSummary: {
      status: 'verified_owner',
      ownerName: 'Apex Cloud Lead Systems LLC (Disputed Identity)',
      ownerType: 'Corporate',
      streetAddress: '548 Market St, Suite #8911',
      cityStateZip: 'San Francisco, CA 94104',
      sourceLabel: 'Case-Study Corporate WHOIS Dossier',
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
    ownerSummary: {
      status: 'verified_owner',
      ownerName: 'Vanguard Media Group Inc. (Corp Line #14)',
      ownerType: 'Corporate',
      streetAddress: '350 5th Avenue, 44th Floor',
      cityStateZip: 'New York, NY 10118',
      sourceLabel: 'Case-Study Corporate Directory',
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
    ownerSummary: {
      status: 'verified_owner',
      ownerName: 'Marcus E. Thornton',
      ownerType: 'Individual',
      streetAddress: '1104 S Congress Ave, Apt 3B',
      cityStateZip: 'Austin, TX 78704',
      sourceLabel: 'Case-Study Subscriber Dossier',
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
    ownerSummary: {
      status: 'verified_owner',
      ownerName: 'Midland Credit Management Regional Outbound',
      ownerType: 'Corporate',
      streetAddress: '350 Camino De La Reina, Suite 100',
      cityStateZip: 'San Diego, CA 92108',
      sourceLabel: 'Case-Study Corporate Registry',
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
  'GA-9KL42_GA': {
    plateNumber: 'GA-9KL42',
    state: 'GA',
    vehicleDetails: {
      year: 2022,
      make: 'Subaru',
      model: 'Outback Touring XT',
      color: 'Autumn Green Metallic',
      bodyStyle: 'Wagon 4D',
      vinMasked: '4S4BTGPD6N314****',
    },
    auditSummary: {
      overallStatus: 'passive_scan_only',
      totalDetections30Days: 12,
      totalDetections90Days: 31,
      activeAgencyQueriesCount: 0,
      lastDetectedTimestamp: '2026-11-11T10:15:00-05:00',
      lastDetectedLocation: 'Roswell Rd & Johnson Ferry Rd, Marietta, GA',
      exposureScore: 44,
      exposureLevel: 'Moderate Exposure',
      retentionPolicyStandard: 'Georgia Open Records & Municipal ALPR Standard (30-day passive buffer)',
    },
    queryAuditLog: [
      {
        queryId: 'QRY-2026-GA-CCPD-3012',
        timestamp: '2026-11-11T03:30:00-05:00',
        requestingAgency: 'Cobb County Police Department (Precinct 4 ALPR Gateway)',
        agencyType: 'County Sheriff',
        queryReason: 'Automated NCIC / GCIC Clean Sync Verification (Routine Batch Scrub)',
        searchRadiusMiles: 0,
        officerBadgeOrCaseId: 'Auto-Daemon / GCIC-Sync-02',
        matchedCriteria: 'Automated Nightly Hotlist Sync',
        alertDisposition: 'Hotlist Cross-Check Negative',
      },
    ],
    cameraSightings: [
      {
        id: 'FLK-GA-2104',
        timestamp: '2026-11-11T10:15:00-05:00',
        cameraId: 'FLOCK-FALCON-COBB-418',
        cameraName: 'Roswell Rd & Johnson Ferry Rd',
        cameraType: 'Flock Falcon (Fixed)',
        municipalityAgency: 'Cobb County Police Dept / Flock Safety Network',
        intersectionOrLocation: 'Roswell Rd & Johnson Ferry Rd, Marietta, GA',
        coordinates: [33.9794, -84.4281],
        directionOfTravel: 'Westbound',
        laneNumber: 2,
        captureConfidence: 99.3,
        speedEstimateMph: 39,
        retentionDaysRemaining: 29,
        weatherLightCondition: 'Daylight / Clear',
      },
      {
        id: 'FLK-GA-2091',
        timestamp: '2026-11-08T16:48:20-05:00',
        cameraId: 'FLOCK-SENT-COBB-119',
        cameraName: 'East Cobb Crossing Gate Sentinel',
        cameraType: 'Flock Sentinel (HOA)',
        municipalityAgency: 'East Cobb HOA Private Security Node',
        intersectionOrLocation: 'Johnson Ferry Rd & Woodlawn Dr, Marietta, GA',
        coordinates: [33.9642, -84.4119],
        directionOfTravel: 'Southbound',
        laneNumber: 1,
        captureConfidence: 98.9,
        speedEstimateMph: 21,
        retentionDaysRemaining: 26,
        weatherLightCondition: 'Daylight / Clear',
      },
    ],
    reciprocalAgencies: [
      { agencyName: 'Cobb County Police Department', jurisdiction: 'Cobb County, GA', dataShareScope: 'Full Real-Time Access' },
      { agencyName: 'Marietta Police Department', jurisdiction: 'Marietta, GA', dataShareScope: 'Historical Search (30-day)' },
      { agencyName: 'Georgia State Patrol', jurisdiction: 'Statewide GA', dataShareScope: 'Audit Log Only' },
    ],
  },
};

const AREA_CODE_DIRECTORY: Record<
  string,
  { city: string; state: string; timeZone: string; coords: [number, number]; postalPrefix: string }
> = {
  '201': { city: 'Jersey City', state: 'NJ', timeZone: 'America/New_York (EST)', coords: [40.7178, -74.0431], postalPrefix: '073' },
  '202': { city: 'Washington', state: 'DC', timeZone: 'America/New_York (EST)', coords: [38.9072, -77.0369], postalPrefix: '200' },
  '206': { city: 'Seattle', state: 'WA', timeZone: 'America/Los_Angeles (PST)', coords: [47.6062, -122.3321], postalPrefix: '981' },
  '210': { city: 'San Antonio', state: 'TX', timeZone: 'America/Chicago (CST)', coords: [29.4241, -98.4936], postalPrefix: '782' },
  '212': { city: 'New York', state: 'NY', timeZone: 'America/New_York (EST)', coords: [40.7128, -74.006], postalPrefix: '100' },
  '213': { city: 'Los Angeles', state: 'CA', timeZone: 'America/Los_Angeles (PST)', coords: [34.0522, -118.2437], postalPrefix: '900' },
  '214': { city: 'Dallas', state: 'TX', timeZone: 'America/Chicago (CST)', coords: [32.7767, -96.797], postalPrefix: '752' },
  '215': { city: 'Philadelphia', state: 'PA', timeZone: 'America/New_York (EST)', coords: [39.9526, -75.1652], postalPrefix: '191' },
  '216': { city: 'Cleveland', state: 'OH', timeZone: 'America/New_York (EST)', coords: [41.4993, -81.6944], postalPrefix: '441' },
  '303': { city: 'Denver', state: 'CO', timeZone: 'America/Denver (MST)', coords: [39.7392, -104.9903], postalPrefix: '802' },
  '305': { city: 'Miami', state: 'FL', timeZone: 'America/New_York (EST)', coords: [25.7617, -80.1918], postalPrefix: '331' },
  '310': { city: 'Santa Monica', state: 'CA', timeZone: 'America/Los_Angeles (PST)', coords: [34.0195, -118.4912], postalPrefix: '904' },
  '312': { city: 'Chicago', state: 'IL', timeZone: 'America/Chicago (CST)', coords: [41.8781, -87.6298], postalPrefix: '606' },
  '313': { city: 'Detroit', state: 'MI', timeZone: 'America/Detroit (EST)', coords: [42.3314, -83.0458], postalPrefix: '482' },
  '314': { city: 'St. Louis', state: 'MO', timeZone: 'America/Chicago (CST)', coords: [38.627, -90.1994], postalPrefix: '631' },
  '323': { city: 'Los Angeles', state: 'CA', timeZone: 'America/Los_Angeles (PST)', coords: [34.0522, -118.2437], postalPrefix: '900' },
  '347': { city: 'Brooklyn', state: 'NY', timeZone: 'America/New_York (EST)', coords: [40.6782, -73.9442], postalPrefix: '112' },
  '404': { city: 'Atlanta', state: 'GA', timeZone: 'America/New_York (EST)', coords: [33.749, -84.388], postalPrefix: '303' },
  '407': { city: 'Orlando', state: 'FL', timeZone: 'America/New_York (EST)', coords: [28.5383, -81.3792], postalPrefix: '328' },
  '408': { city: 'San Jose', state: 'CA', timeZone: 'America/Los_Angeles (PST)', coords: [37.3382, -121.8863], postalPrefix: '951' },
  '412': { city: 'Pittsburgh', state: 'PA', timeZone: 'America/New_York (EST)', coords: [40.4406, -79.9959], postalPrefix: '152' },
  '415': { city: 'San Francisco', state: 'CA', timeZone: 'America/Los_Angeles (PST)', coords: [37.7749, -122.4194], postalPrefix: '941' },
  '469': { city: 'Dallas', state: 'TX', timeZone: 'America/Chicago (CST)', coords: [32.7767, -96.797], postalPrefix: '752' },
  '480': { city: 'Scottsdale', state: 'AZ', timeZone: 'America/Phoenix (MST)', coords: [33.4942, -111.9261], postalPrefix: '852' },
  '503': { city: 'Portland', state: 'OR', timeZone: 'America/Los_Angeles (PST)', coords: [45.5152, -122.6784], postalPrefix: '972' },
  '512': { city: 'Austin', state: 'TX', timeZone: 'America/Chicago (CST)', coords: [30.2672, -97.7431], postalPrefix: '787' },
  '602': { city: 'Phoenix', state: 'AZ', timeZone: 'America/Phoenix (MST)', coords: [33.4484, -112.074], postalPrefix: '850' },
  '612': { city: 'Minneapolis', state: 'MN', timeZone: 'America/Chicago (CST)', coords: [44.9778, -93.265], postalPrefix: '554' },
  '615': { city: 'Nashville', state: 'TN', timeZone: 'America/Chicago (CST)', coords: [36.1627, -86.7816], postalPrefix: '372' },
  '617': { city: 'Boston', state: 'MA', timeZone: 'America/New_York (EST)', coords: [42.3601, -71.0589], postalPrefix: '021' },
  '619': { city: 'San Diego', state: 'CA', timeZone: 'America/Los_Angeles (PST)', coords: [32.7157, -117.1611], postalPrefix: '921' },
  '628': { city: 'San Francisco', state: 'CA', timeZone: 'America/Los_Angeles (PST)', coords: [37.7749, -122.4194], postalPrefix: '941' },
  '646': { city: 'New York', state: 'NY', timeZone: 'America/New_York (EST)', coords: [40.7128, -74.006], postalPrefix: '100' },
  '650': { city: 'Palo Alto', state: 'CA', timeZone: 'America/Los_Angeles (PST)', coords: [37.4419, -122.143], postalPrefix: '943' },
  '702': { city: 'Las Vegas', state: 'NV', timeZone: 'America/Los_Angeles (PST)', coords: [36.1699, -115.1398], postalPrefix: '891' },
  '704': { city: 'Charlotte', state: 'NC', timeZone: 'America/New_York (EST)', coords: [35.2271, -80.8431], postalPrefix: '282' },
  '713': { city: 'Houston', state: 'TX', timeZone: 'America/Chicago (CST)', coords: [29.7604, -95.3698], postalPrefix: '770' },
  '718': { city: 'Queens', state: 'NY', timeZone: 'America/New_York (EST)', coords: [40.7282, -73.7949], postalPrefix: '113' },
  '720': { city: 'Denver', state: 'CO', timeZone: 'America/Denver (MST)', coords: [39.7392, -104.9903], postalPrefix: '802' },
  '786': { city: 'Miami', state: 'FL', timeZone: 'America/New_York (EST)', coords: [25.7617, -80.1918], postalPrefix: '331' },
  '801': { city: 'Salt Lake City', state: 'UT', timeZone: 'America/Denver (MST)', coords: [40.7608, -111.891], postalPrefix: '841' },
  '813': { city: 'Tampa', state: 'FL', timeZone: 'America/New_York (EST)', coords: [27.9506, -82.4572], postalPrefix: '336' },
  '818': { city: 'Burbank', state: 'CA', timeZone: 'America/Los_Angeles (PST)', coords: [34.1808, -118.309], postalPrefix: '915' },
  '858': { city: 'San Diego', state: 'CA', timeZone: 'America/Los_Angeles (PST)', coords: [32.8328, -117.2713], postalPrefix: '920' },
  '916': { city: 'Sacramento', state: 'CA', timeZone: 'America/Los_Angeles (PST)', coords: [38.5816, -121.4944], postalPrefix: '958' },
  '917': { city: 'New York', state: 'NY', timeZone: 'America/New_York (EST)', coords: [40.7128, -74.006], postalPrefix: '100' },
  '949': { city: 'Irvine', state: 'CA', timeZone: 'America/Los_Angeles (PST)', coords: [33.6846, -117.8265], postalPrefix: '926' },
};

const TOLL_FREE_CODES = new Set(['800', '833', '844', '855', '866', '877', '888']);

const INTL_COUNTRY_DIAL_CODES: Array<{
  dial: string;
  iso: string;
  name: string;
  tz: string;
  coords: [number, number];
}> = [
  { dial: '44', iso: 'GB', name: 'United Kingdom', tz: 'Europe/London (GMT/BST)', coords: [51.5072, -0.1276] },
  { dial: '61', iso: 'AU', name: 'Australia', tz: 'Australia/Sydney (AEST)', coords: [-33.8688, 151.2093] },
  { dial: '49', iso: 'DE', name: 'Germany', tz: 'Europe/Berlin (CET)', coords: [52.52, 13.405] },
  { dial: '33', iso: 'FR', name: 'France', tz: 'Europe/Paris (CET)', coords: [48.8566, 2.3522] },
  { dial: '34', iso: 'ES', name: 'Spain', tz: 'Europe/Madrid (CET)', coords: [40.4168, -3.7038] },
  { dial: '39', iso: 'IT', name: 'Italy', tz: 'Europe/Rome (CET)', coords: [41.9028, 12.4964] },
  { dial: '31', iso: 'NL', name: 'Netherlands', tz: 'Europe/Amsterdam (CET)', coords: [52.3676, 4.9041] },
  { dial: '41', iso: 'CH', name: 'Switzerland', tz: 'Europe/Zurich (CET)', coords: [47.3769, 8.5417] },
  { dial: '46', iso: 'SE', name: 'Sweden', tz: 'Europe/Stockholm (CET)', coords: [59.3293, 18.0686] },
  { dial: '353', iso: 'IE', name: 'Ireland', tz: 'Europe/Dublin (GMT)', coords: [53.3498, -6.2603] },
  { dial: '52', iso: 'MX', name: 'Mexico', tz: 'America/Mexico_City (CST)', coords: [19.4326, -99.1332] },
  { dial: '55', iso: 'BR', name: 'Brazil', tz: 'America/Sao_Paulo (BRT)', coords: [-23.5505, -46.6333] },
  { dial: '81', iso: 'JP', name: 'Japan', tz: 'Asia/Tokyo (JST)', coords: [35.6762, 139.6503] },
  { dial: '82', iso: 'KR', name: 'South Korea', tz: 'Asia/Seoul (KST)', coords: [37.5665, 126.978] },
  { dial: '86', iso: 'CN', name: 'China', tz: 'Asia/Shanghai (CST)', coords: [39.9042, 116.4074] },
  { dial: '91', iso: 'IN', name: 'India', tz: 'Asia/Kolkata (IST)', coords: [28.6139, 77.209] },
  { dial: '64', iso: 'NZ', name: 'New Zealand', tz: 'Pacific/Auckland (NZST)', coords: [-36.8485, 174.7633] },
];

// Client-side offline fallback for reverse phone lookup when live LERG/FCC endpoint is unreachable
export function generatePhoneLookup(rawInput: string): PhoneLookupResult {
  const trimmed = rawInput.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) {
    throw new Error('Enter a valid phone number (include area code, e.g. +1 415-890-4421).');
  }

  if (!hasPlus && digits.length === 7) {
    throw new Error(
      'Include the 3-digit area code (e.g. +1 415-890-4421) so serving carrier and rate center can be resolved.'
    );
  }

  // Handle explicit international E.164 numbers outside NANP (+1)
  const isExplicitIntlNonNanp = hasPlus && !digits.startsWith('1');
  if (isExplicitIntlNonNanp || (digits.length > 10 && !digits.startsWith('1'))) {
    const sorted = [...INTL_COUNTRY_DIAL_CODES].sort((a, b) => b.dial.length - a.dial.length);
    const matched = sorted.find((p) => digits.startsWith(p.dial));
    const dial = matched ? matched.dial : digits.slice(0, digits.length > 11 ? 2 : 1);
    const subscriber = digits.slice(dial.length);

    return {
      phoneNumber: `+${digits}`,
      formattedNational: subscriber,
      formattedInternational: `+${dial} ${subscriber}`,
      countryCode: matched?.iso || 'INTL',
      countryName: matched?.name || `International (+${dial})`,
      carrier: {
        name: `${matched?.name || `Country +${dial}`} International E.164 Gateway`,
        type: 'Landline ILEC',
        networkCode: `INTL-${matched?.iso || 'E164'}-${dial}`,
        originalNetwork: `${matched?.name || 'ITU-T'} E.164 Block`,
        isPorted: false,
      },
      lineType: 'Mobile',
      riskAnalysis: {
        spamScore: 10,
        riskLevel: 'Low',
        primaryFlag: 'International E.164 Number (Offline Fallback)',
        totalReports: 0,
        activityCategory: 'Nominal Consumer',
        lastActiveDate: new Date().toISOString(),
      },
      location: {
        city: matched ? `${matched.name} Gateway` : 'International Gateway',
        state: matched?.iso || 'INTL',
        postalCode: 'INTL',
        timeZone: matched?.tz || 'UTC (International)',
        rateCenter: `E164-CC-${dial}`,
        coordinates: matched?.coords || [20, 0],
      },
      ownerSummary: {
        status: 'cpni_protected',
        ownerName: 'Unlisted International Subscriber',
        ownerType: 'Unlisted',
        sourceLabel: 'ITU-T E.164 International Registry (Offline Fallback)',
        note: 'Connect to the live trace server to query Wikidata and configured CNAM/reverse-ID registries.',
      },
      dossier: {
        subscriberName: 'Unlisted International Subscriber (GDPR / Regional Privacy)',
        subscriberType: 'Undisclosed / Prepaid',
        addressHistory: [
          {
            street: `Country Calling Code +${dial} Allocation`,
            cityState: matched?.name || `International (+${dial})`,
            years: 'Active E.164 Range',
            isCurrent: true,
          },
        ],
        associatedEmails: [],
        breachExposures: [],
        digitalFootprint: [
          {
            platform: 'ITU-T E.164 Country Registry',
            profileHandle: `+${digits} (${matched?.name || `+${dial}`})`,
            verified: true,
          },
        ],
        altPhoneNumbers: [],
      },
    };
  }

  const clean10 = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits.slice(-10);
  const cleanNumber = `1${clean10}`;

  // Check curated case-study database first
  if (MOCK_PHONE_DATABASE[cleanNumber]) {
    return MOCK_PHONE_DATABASE[cleanNumber];
  }

  const areaCode = clean10.slice(0, 3);
  const prefix = clean10.slice(3, 6);
  const lineNum = clean10.slice(6, 10);
  const isTollFree = TOLL_FREE_CODES.has(areaCode);
  const isFictional555 = prefix === '555';

  const geo = isTollFree
    ? {
        city: 'National Toll-Free Routing',
        state: 'US',
        timeZone: 'Multi-Region (US/CAN)',
        coords: [39.8283, -98.5795] as [number, number],
        postalCode: '00000',
      }
    : AREA_CODE_DIRECTORY[areaCode]
    ? {
        city: AREA_CODE_DIRECTORY[areaCode].city,
        state: AREA_CODE_DIRECTORY[areaCode].state,
        timeZone: AREA_CODE_DIRECTORY[areaCode].timeZone,
        coords: AREA_CODE_DIRECTORY[areaCode].coords,
        postalCode: `NPA-${areaCode}`,
      }
    : {
        city: `NPA-${areaCode} Exchange`,
        state: 'US',
        timeZone:
          Number(areaCode) >= 700
            ? 'America/Los_Angeles (PST)'
            : Number(areaCode) >= 500
            ? 'America/Chicago (CST)'
            : 'America/New_York (EST)',
        coords: [39.8283, -98.5795] as [number, number],
        postalCode: `NPA-${areaCode}`,
      };

  return {
    phoneNumber: `+1${areaCode}${prefix}${lineNum}`,
    formattedNational: `(${areaCode}) ${prefix}-${lineNum}`,
    formattedInternational: `+1 ${areaCode}-${prefix}-${lineNum}`,
    countryCode: 'US',
    countryName: 'United States',
    carrier: {
      name: isFictional555
        ? 'NANPA Reserved 555 Exchange (Non-Routable / Directory)'
        : isTollFree
        ? `NANP Toll-Free Service (${areaCode} RespOrg Routing)`
        : `NPA-${areaCode} Exchange Carrier (Offline Fallback)`,
      type: isTollFree ? 'Toll-Free CLEC' : 'Landline ILEC',
      networkCode: isFictional555 ? 'US-RES-555' : `US-NPA-${areaCode}`,
      originalNetwork: isFictional555 ? 'NANPA Special Service Block' : 'NANPA Numbering Allocation',
      isPorted: false,
    },
    lineType: isTollFree ? 'Toll-Free' : 'Landline',
    riskAnalysis: {
      spamScore: isTollFree ? 24 : 12,
      riskLevel: 'Low',
      primaryFlag: isFictional555
        ? 'Reserved 555 Informational / Non-Subscriber Prefix'
        : isTollFree
        ? 'Toll-Free Routing (Live FCC check unavailable offline)'
        : 'Exchange Allocation Verified (Live carrier/FCC API offline)',
      totalReports: 0,
      activityCategory: isTollFree ? 'Commercial Business' : 'Nominal Consumer',
      lastActiveDate: new Date().toISOString(),
    },
    location: {
      city: geo.city,
      state: geo.state,
      postalCode: geo.postalCode,
      timeZone: geo.timeZone,
      rateCenter: isTollFree ? `TOLLFREE-${areaCode}` : `NPA-${areaCode}-${prefix}`,
      coordinates: geo.coords,
    },
    ownerSummary: {
      status: isFictional555 ? 'reserved_block' : 'cpni_protected',
      ownerName: isFictional555
        ? 'Reserved 555 Prefix (No Registered Subscriber)'
        : 'Unlisted / Non-Public Subscriber (Offline Fallback)',
      ownerType: 'Unlisted',
      cityStateZip: `${geo.city}, ${geo.state}`,
      sourceLabel: 'NANPA Numbering Allocation (Offline Fallback)',
      note: 'Live server owner & address lookup (SEC EDGAR, Wikidata, CNAM) is unavailable offline.',
    },
    dossier: {
      subscriberName: isFictional555
        ? 'Reserved 555 Prefix (No Registered Subscriber)'
        : 'Unlisted / Non-Public Subscriber (No Public Directory Match)',
      subscriberType: isTollFree ? 'Corporate' : 'Undisclosed / Prepaid',
      addressHistory: [
        {
          street: `Numbering Plan Area ${areaCode}-${prefix}`,
          cityState: `${geo.city}, ${geo.state}`,
          years: 'Active NANP Allocation',
          isCurrent: true,
        },
      ],
      associatedEmails: [],
      breachExposures: [],
      digitalFootprint: [
        {
          platform: 'NANPA Numbering Allocation',
          profileHandle: `+1 (${areaCode}) ${prefix}-${lineNum}`,
          verified: true,
        },
      ],
      altPhoneNumbers: [],
    },
  };
}

const STATE_CENTER_COORDS: Record<string, { city: string; coords: [number, number] }> = {
  AL: { city: 'Birmingham', coords: [33.5186, -86.8104] },
  AK: { city: 'Anchorage', coords: [61.2181, -149.9003] },
  AZ: { city: 'Phoenix', coords: [33.4484, -112.074] },
  AR: { city: 'Little Rock', coords: [34.7465, -92.2896] },
  CA: { city: 'Los Angeles', coords: [34.0522, -118.2437] },
  CO: { city: 'Denver', coords: [39.7392, -104.9903] },
  CT: { city: 'Hartford', coords: [41.7658, -72.6734] },
  DE: { city: 'Wilmington', coords: [39.7391, -75.5398] },
  DC: { city: 'Washington', coords: [38.9072, -77.0369] },
  FL: { city: 'Orlando', coords: [28.5383, -81.3792] },
  GA: { city: 'Atlanta', coords: [33.749, -84.388] },
  HI: { city: 'Honolulu', coords: [21.3069, -157.8583] },
  ID: { city: 'Boise', coords: [43.615, -116.2023] },
  IL: { city: 'Chicago', coords: [41.8781, -87.6298] },
  IN: { city: 'Indianapolis', coords: [39.7684, -86.1581] },
  IA: { city: 'Des Moines', coords: [41.5868, -93.625] },
  KS: { city: 'Wichita', coords: [37.6872, -97.3301] },
  KY: { city: 'Louisville', coords: [38.2527, -85.7585] },
  LA: { city: 'New Orleans', coords: [29.9511, -90.0715] },
  ME: { city: 'Portland', coords: [43.6591, -70.2568] },
  MD: { city: 'Baltimore', coords: [39.2904, -76.6122] },
  MA: { city: 'Boston', coords: [42.3601, -71.0589] },
  MI: { city: 'Detroit', coords: [42.3314, -83.0458] },
  MN: { city: 'Minneapolis', coords: [44.9778, -93.265] },
  MS: { city: 'Jackson', coords: [32.2988, -90.1848] },
  MO: { city: 'Kansas City', coords: [39.0997, -94.5786] },
  MT: { city: 'Billings', coords: [45.7833, -108.5007] },
  NE: { city: 'Omaha', coords: [41.2565, -95.9345] },
  NV: { city: 'Las Vegas', coords: [36.1699, -115.1398] },
  NH: { city: 'Manchester', coords: [42.9956, -71.4548] },
  NJ: { city: 'Newark', coords: [40.7357, -74.1724] },
  NM: { city: 'Albuquerque', coords: [35.0844, -106.6504] },
  NY: { city: 'New York', coords: [40.7128, -74.006] },
  NC: { city: 'Charlotte', coords: [35.2271, -80.8431] },
  ND: { city: 'Fargo', coords: [46.8772, -96.7898] },
  OH: { city: 'Columbus', coords: [39.9612, -82.9988] },
  OK: { city: 'Oklahoma City', coords: [35.4676, -97.5164] },
  OR: { city: 'Portland', coords: [45.5152, -122.6784] },
  PA: { city: 'Philadelphia', coords: [39.9526, -75.1652] },
  RI: { city: 'Providence', coords: [41.824, -71.4128] },
  SC: { city: 'Charleston', coords: [32.7765, -79.9311] },
  SD: { city: 'Sioux Falls', coords: [43.546, -96.7313] },
  TN: { city: 'Nashville', coords: [36.1627, -86.7816] },
  TX: { city: 'Austin', coords: [30.2672, -97.7431] },
  UT: { city: 'Salt Lake City', coords: [40.7608, -111.891] },
  VT: { city: 'Burlington', coords: [44.4759, -73.2121] },
  VA: { city: 'Richmond', coords: [37.5407, -77.436] },
  WA: { city: 'Seattle', coords: [47.6062, -122.3321] },
  WV: { city: 'Charleston', coords: [38.3498, -81.6326] },
  WI: { city: 'Milwaukee', coords: [43.0389, -87.9065] },
  WY: { city: 'Cheyenne', coords: [41.14, -104.8202] },
};

// Generates dynamic ALPR surveillance audit for arbitrary license plates
export function generateVehicleAudit(rawPlate: string, state: string): VehicleAlprAuditResult {
  const cleanPlate = rawPlate.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const upperState = state.toUpperCase();
  const key = `${cleanPlate}_${upperState}`;

  if (MOCK_ALPR_DATABASE[key]) {
    return MOCK_ALPR_DATABASE[key];
  }

  const seed = cleanPlate.split('').reduce((acc, char, idx) => acc + char.charCodeAt(0) * (idx + 1), 0);
  const makes = ['Toyota RAV4', 'Chevrolet Silverado', 'Honda Accord', 'Subaru Outback', 'Hyundai Tucson'];
  const colors = ['Midnight Black', 'Oxford White', 'Magnetic Gray', 'Deep Blue Metallic', 'Silver Sky'];
  const chosenMake = makes[seed % makes.length].split(' ');
  const chosenColor = colors[seed % colors.length];

  const hasBeenLookedInto = seed % 3 === 0; // 1 out of 3 plates has an active query audit entry
  const totalDetections = (seed % 28) + 4;

  const now = Date.now();
  const lastSeenDate = new Date(now - (seed % 36) * 3600000).toISOString();

  const stateMetro = STATE_CENTER_COORDS[upperState] || { city: 'Regional Metro', coords: [39.8283, -98.5795] as [number, number] };
  const [baseLat, baseLng] = stateMetro.coords;
  const latJitter = ((seed % 7) - 3) * 0.004;
  const lngJitter = (((seed >> 2) % 7) - 3) * 0.005;

  const queryLog = hasBeenLookedInto
    ? [
        {
          queryId: `QRY-2026-${upperState}-99${seed % 900}`,
          timestamp: new Date(now - ((seed % 24) + 6) * 3600000).toISOString(),
          requestingAgency: `${stateMetro.city} Municipal Police / ${upperState} ALPR Coalition`,
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
          requestingAgency: `${upperState} Highway Patrol ALPR Gateway`,
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
      cameraId: `FLOCK-FALCON-${upperState}-${(seed % 9000) + 1000}`,
      cameraName: `${stateMetro.city} Central Corridor Node ${(seed % 40) + 1}`,
      cameraType: 'Flock Falcon (Fixed)' as const,
      municipalityAgency: `${stateMetro.city} Police Dept / Partner Node`,
      intersectionOrLocation: `Main Arterial Pkwy & Central Ave, ${stateMetro.city}, ${upperState}`,
      coordinates: [
        Number((baseLat + latJitter).toFixed(4)),
        Number((baseLng + lngJitter).toFixed(4)),
      ] as [number, number],
      directionOfTravel: seed % 2 === 0 ? ('Northbound' as const) : ('Eastbound' as const),
      laneNumber: (seed % 3) + 1,
      captureConfidence: Number((98.4 + (seed % 15) / 10).toFixed(1)),
      speedEstimateMph: 35 + (seed % 25),
      retentionDaysRemaining: 30 - ((seed % 15) + 1),
      weatherLightCondition: 'Daylight / Clear' as const,
    },
    {
      id: `FLK-NODE-${seed}-2`,
      timestamp: new Date(now - 26 * 3600000).toISOString(),
      cameraId: `FLOCK-HWY-${upperState}-${(seed % 700) + 200}`,
      cameraName: `${stateMetro.city} Beltway Transit Pole #${(seed % 19) + 4}`,
      cameraType: 'Highway Transit Pole' as const,
      municipalityAgency: `${upperState} Dept of Transportation / State Patrol`,
      intersectionOrLocation: `Interstate Corridor Exit ${(seed % 28) + 2}, ${stateMetro.city}, ${upperState}`,
      coordinates: [
        Number((baseLat + latJitter + 0.018).toFixed(4)),
        Number((baseLng + lngJitter - 0.022).toFixed(4)),
      ] as [number, number],
      directionOfTravel: 'Westbound' as const,
      laneNumber: 2,
      captureConfidence: 99.4,
      speedEstimateMph: 58,
      retentionDaysRemaining: 28,
      weatherLightCondition: 'Daylight / Clear' as const,
    },
    {
      id: `FLK-NODE-${seed}-3`,
      timestamp: new Date(now - 72 * 3600000).toISOString(),
      cameraId: `FLOCK-SENT-HOA-${(seed % 500) + 100}`,
      cameraName: `Pinecrest Boulevard Community Sentinel`,
      cameraType: 'Flock Sentinel (HOA)' as const,
      municipalityAgency: `Pinecrest Community HOA Private Node`,
      intersectionOrLocation: `Pinecrest Blvd & Glenwood Gate, ${stateMetro.city}, ${upperState}`,
      coordinates: [
        Number((baseLat + latJitter - 0.015).toFixed(4)),
        Number((baseLng + lngJitter + 0.019).toFixed(4)),
      ] as [number, number],
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
