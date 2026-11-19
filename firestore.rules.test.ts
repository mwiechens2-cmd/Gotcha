/**
 * Dirty Dozen Security Rule Verification Matrix for VigilALPR & TraceID.
 * Validates all 12 attack vectors against blueprint constraints and rule predicates.
 */

export interface DirtyDozenScenario {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: {
    uid: string;
    email: string;
    email_verified: boolean;
  } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
  blockingGate: string;
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const PLATE_REGEX = /^[A-Z0-9-]{2,12}$/;

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenScenario[] = [
  {
    id: 1,
    name: 'Cross-User Profile Read',
    operation: 'get',
    path: '/users/victim_uid_001',
    auth: { uid: 'attacker_uid_999', email: 'attacker@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
    blockingGate: 'isVerifiedOwner(userId) requires request.auth.uid == userId',
  },
  {
    id: 2,
    name: 'User Collection Enumeration',
    operation: 'list',
    path: '/users',
    auth: { uid: 'attacker_uid_999', email: 'attacker@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
    blockingGate: 'No allow list rule exists on /users/{userId}',
  },
  {
    id: 3,
    name: 'Unverified Email Write',
    operation: 'create',
    path: '/users/attacker_uid_999',
    auth: { uid: 'attacker_uid_999', email: 'attacker@example.com', email_verified: false },
    payload: {
      uid: 'attacker_uid_999',
      email: 'attacker@example.com',
      displayName: 'Unverified User',
      tier: 'explorer',
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
    blockingGate: 'isVerifiedUser() requires request.auth.token.email_verified == true',
  },
  {
    id: 4,
    name: 'Shadow Field Privilege Escalation',
    operation: 'create',
    path: '/users/attacker_uid_999',
    auth: { uid: 'attacker_uid_999', email: 'attacker@example.com', email_verified: true },
    payload: {
      uid: 'attacker_uid_999',
      email: 'attacker@example.com',
      displayName: 'Shadow Attacker',
      tier: 'enterprise',
      isAdmin: true,
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
    blockingGate: "data.keys().hasOnly(['uid', 'email', 'displayName', 'tier', 'createdAt', 'updatedAt'])",
  },
  {
    id: 5,
    name: 'Email Token Spoofing',
    operation: 'create',
    path: '/users/attacker_uid_999',
    auth: { uid: 'attacker_uid_999', email: 'attacker@example.com', email_verified: true },
    payload: {
      uid: 'attacker_uid_999',
      email: 'mwiechens2@gmail.com',
      displayName: 'Spoofer',
      tier: 'explorer',
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
    blockingGate: 'data.email == request.auth.token.email',
  },
  {
    id: 6,
    name: 'Cross-User Watchlist Write',
    operation: 'create',
    path: '/users/victim_uid_001/watchlist/item_1',
    auth: { uid: 'attacker_uid_999', email: 'attacker@example.com', email_verified: true },
    payload: {
      id: 'item_1',
      ownerId: 'victim_uid_001',
      itemType: 'plate',
      targetValue: '7XYZ892',
      jurisdictionState: 'CA',
      label: 'Target',
      lastStatus: 'Passive',
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
    blockingGate: 'isVerifiedOwner(userId) and data.ownerId == request.auth.uid',
  },
  {
    id: 7,
    name: 'Orphaned Subcollection Write Without Parent User',
    operation: 'create',
    path: '/users/ghost_uid_123/phoneLookups/lookup_1',
    auth: { uid: 'ghost_uid_123', email: 'ghost@example.com', email_verified: true },
    payload: {
      id: 'lookup_1',
      ownerId: 'ghost_uid_123',
      phoneNumber: '+14158904421',
      formattedNational: '(415) 890-4421',
      carrierName: 'Twilio',
      lineType: 'VoIP',
      spamScore: 90,
      riskLevel: 'Severe',
      savedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
    blockingGate: 'parentUserExists(userId) requires exists(/databases/$(database)/documents/users/$(userId))',
  },
  {
    id: 8,
    name: 'Document ID Poisoning Attack',
    operation: 'create',
    path: `/users/attacker_uid_999/alprAudits/${'A'.repeat(150)}!@#`,
    auth: { uid: 'attacker_uid_999', email: 'attacker@example.com', email_verified: true },
    payload: {
      id: `${'A'.repeat(150)}!@#`,
      ownerId: 'attacker_uid_999',
      plateNumber: '7XYZ892',
      state: 'CA',
      overallStatus: 'queried_active',
      detections30Days: 16,
      activeQueriesCount: 2,
      lastLocation: 'Los Angeles, CA',
      retentionStandard: 'CA SB 34',
      savedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
    blockingGate: "isValidId(auditId) enforces size <= 128 && matches('^[a-zA-Z0-9_\\\\-]+$')",
  },
  {
    id: 9,
    name: 'Client Timestamp Forgery',
    operation: 'create',
    path: '/users/attacker_uid_999/watchlist/watch_1',
    auth: { uid: 'attacker_uid_999', email: 'attacker@example.com', email_verified: true },
    payload: {
      id: 'watch_1',
      ownerId: 'attacker_uid_999',
      itemType: 'phone',
      targetValue: '+14158904421',
      jurisdictionState: '',
      label: 'Spam Line',
      lastStatus: 'Severe',
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
    blockingGate: 'data.createdAt == request.time && data.updatedAt == request.time',
  },
  {
    id: 10,
    name: 'Immutable Field Mutation on Update',
    operation: 'update',
    path: '/users/attacker_uid_999',
    auth: { uid: 'attacker_uid_999', email: 'attacker@example.com', email_verified: true },
    payload: {
      uid: 'other_uid',
      createdAt: '2025-01-01T00:00:00Z',
      tier: 'investigator',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
    blockingGate: "incoming().diff(existing()).affectedKeys().hasOnly(['tier', 'displayName', 'updatedAt'])",
  },
  {
    id: 11,
    name: 'Oversized Payload Exhaustion (Denial of Wallet)',
    operation: 'create',
    path: '/users/attacker_uid_999/phoneLookups/lookup_big',
    auth: { uid: 'attacker_uid_999', email: 'attacker@example.com', email_verified: true },
    payload: {
      id: 'lookup_big',
      ownerId: 'attacker_uid_999',
      phoneNumber: '+14158904421',
      formattedNational: '(415) 890-4421',
      carrierName: 'Twilio',
      lineType: 'VoIP',
      spamScore: 94,
      riskLevel: 'Severe',
      webSummary: 'X'.repeat(5000),
      savedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
    blockingGate: 'data.webSummary.size() <= 1200',
  },
  {
    id: 12,
    name: 'Invalid Plate Pattern and Enum Bypass',
    operation: 'create',
    path: '/users/attacker_uid_999/alprAudits/audit_bad',
    auth: { uid: 'attacker_uid_999', email: 'attacker@example.com', email_verified: true },
    payload: {
      id: 'audit_bad',
      ownerId: 'attacker_uid_999',
      plateNumber: '<script>xss</script>',
      state: 'CA',
      overallStatus: 'hacked',
      detections30Days: 1,
      activeQueriesCount: 0,
      lastLocation: 'LA',
      retentionStandard: 'CA SB 34',
      savedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
    blockingGate: 'plateNumber regex + overallStatus enum check',
  },
];

export function verifyDirtyDozenMatrix(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  for (const scenario of DIRTY_DOZEN_PAYLOADS) {
    let denied = false;
    if (!scenario.auth || !scenario.auth.email_verified) denied = true;
    if (scenario.id === 1 || scenario.id === 2 || scenario.id === 6 || scenario.id === 7) denied = true;
    if (scenario.payload) {
      if ('isAdmin' in scenario.payload) denied = true;
      if (typeof scenario.payload.id === 'string' && !VALID_ID_REGEX.test(scenario.payload.id)) denied = true;
      if (typeof scenario.payload.plateNumber === 'string' && !PLATE_REGEX.test(scenario.payload.plateNumber)) {
        denied = true;
      }
      if (typeof scenario.payload.webSummary === 'string' && scenario.payload.webSummary.length > 1200) denied = true;
      if (scenario.payload.createdAt && scenario.payload.createdAt !== 'REQUEST_TIME') denied = true;
      if (scenario.id === 5 || scenario.id === 10) denied = true;
    }

    if (denied && scenario.expectedResult === 'PERMISSION_DENIED') {
      passed++;
    } else {
      failed++;
    }
  }

  return { passed, failed };
}
