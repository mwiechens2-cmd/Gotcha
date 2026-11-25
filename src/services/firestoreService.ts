import { User } from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import blueprint from '../../firebase-blueprint.json';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  PhoneLookupResult,
  SubscriptionTierType,
  UserProfileRecord,
  VehicleAlprAuditResult,
} from '../types';

// Exact schema limits and patterns synchronized verbatim from firebase-blueprint.json
const USER_PROPS = blueprint.entities.UserProfile.properties;
const PHONE_PROPS = blueprint.entities.SavedPhoneLookup.properties;
const ALPR_PROPS = blueprint.entities.SavedAlprAudit.properties;
const WATCH_PROPS = blueprint.entities.WatchlistItem.properties;

const ID_REGEX = new RegExp(USER_PROPS.uid.pattern);
const PHONE_REGEX = new RegExp(PHONE_PROPS.phoneNumber.pattern);
const PLATE_REGEX = new RegExp(ALPR_PROPS.plateNumber.pattern);
const STATE_REGEX = new RegExp(ALPR_PROPS.state.pattern);
const TARGET_REGEX = new RegExp(WATCH_PROPS.targetValue.pattern);

const ALLOWED_TIERS: readonly SubscriptionTierType[] = USER_PROPS.tier.enum as SubscriptionTierType[];
const ALLOWED_LINE_TYPES = PHONE_PROPS.lineType.enum as PhoneLookupResult['lineType'][];
const ALLOWED_RISK_LEVELS = PHONE_PROPS.riskLevel.enum as PhoneLookupResult['riskAnalysis']['riskLevel'][];

function assertValidId(value: string, fieldName: string): void {
  if (!ID_REGEX.test(value)) {
    throw new Error(`Invalid ${fieldName} identifier format.`);
  }
}

function clampText(value: string, maxLen: number, fallback = ''): string {
  const cleaned = value.trim();
  if (!cleaned) return fallback;
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

function clampFiniteInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function sanitizeDocId(raw: string, fallbackPrefix: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, USER_PROPS.uid.maxLength);
  if (cleaned && ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return `${fallbackPrefix}_${Date.now()}`;
}

export function buildPhoneLookupId(phoneNumber: string): string {
  const digits = phoneNumber.replace(/[^0-9]/g, '');
  return sanitizeDocId(`phone_${digits || 'target'}`, 'phone');
}

export function buildAlprAuditId(plateNumber: string, state: string): string {
  const cleanPlate = plateNumber.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const cleanState = state.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  return sanitizeDocId(`alpr_${cleanState || 'US'}_${cleanPlate || 'PLATE'}`, 'alpr');
}

export function buildWatchlistId(
  itemType: 'phone' | 'plate',
  targetValue: string,
  jurisdictionState?: string
): string {
  if (itemType === 'phone') {
    const digits = targetValue.replace(/[^0-9]/g, '');
    return sanitizeDocId(`watch_phone_${digits || 'num'}`, 'watch_phone');
  }
  const cleanPlate = targetValue.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const cleanState = (jurisdictionState || 'US').trim().toUpperCase().slice(0, 2);
  return sanitizeDocId(`watch_plate_${cleanState}_${cleanPlate || 'plt'}`, 'watch_plate');
}

const inFlightProfileEnsures = new Map<string, Promise<UserProfileRecord>>();

export function ensureUserProfile(
  user: User,
  fallbackTier: SubscriptionTierType
): Promise<UserProfileRecord> {
  const existing = inFlightProfileEnsures.get(user.uid);
  if (existing) return existing;

  const task = (async (): Promise<UserProfileRecord> => {
    assertValidId(user.uid, 'user');
    const path = `users/${user.uid}`;
    const ref = doc(db, 'users', user.uid);

    let snap;
    try {
      snap = await getDoc(ref);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }

    if (snap.exists()) {
      const data = snap.data() as UserProfileRecord;
      const validTier = ALLOWED_TIERS.includes(data.tier) ? data.tier : fallbackTier;
      return {
        ...data,
        tier: validTier,
      };
    }

    if (!user.emailVerified) {
      throw new Error('A verified Google email address is required to save records.');
    }

    const email = (user.email || '').trim();
    if (email.length < USER_PROPS.email.minLength || email.length > USER_PROPS.email.maxLength) {
      throw new Error('Google account is missing a valid email address.');
    }

    const displayName = clampText(
      user.displayName || email.split('@')[0] || 'Investigator',
      USER_PROPS.displayName.maxLength,
      'Investigator'
    );
    const tier: SubscriptionTierType = ALLOWED_TIERS.includes(fallbackTier) ? fallbackTier : 'explorer';

    const payload = {
      uid: user.uid,
      email,
      displayName,
      tier,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(ref, payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }

    return {
      uid: user.uid,
      email,
      displayName,
      tier,
    };
  })().finally(() => {
    inFlightProfileEnsures.delete(user.uid);
  });

  inFlightProfileEnsures.set(user.uid, task);
  return task;
}

export async function persistUserTier(uid: string, nextTier: SubscriptionTierType): Promise<void> {
  assertValidId(uid, 'user');
  if (!ALLOWED_TIERS.includes(nextTier)) {
    throw new Error('Invalid subscription tier.');
  }
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      tier: nextTier,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function savePhoneLookupRecord(
  uid: string,
  result: PhoneLookupResult,
  tier: SubscriptionTierType,
  webSummary?: string
): Promise<string> {
  assertValidId(uid, 'user');
  const lookupId = buildPhoneLookupId(result.phoneNumber);
  assertValidId(lookupId, 'lookup');
  const path = `users/${uid}/phoneLookups/${lookupId}`;
  const ref = doc(db, 'users', uid, 'phoneLookups', lookupId);

  const rawSanitizedPhone = result.phoneNumber.replace(/[^0-9+()\s-]/g, '').trim();
  const normalizedPhone = clampText(rawSanitizedPhone, PHONE_PROPS.phoneNumber.maxLength);
  if (!PHONE_REGEX.test(normalizedPhone)) {
    throw new Error('Phone number format does not match schema requirements.');
  }

  const isUnlocked = tier === 'investigator' || tier === 'enterprise';
  const subscriberPreview = clampText(
    isUnlocked && result.dossier?.subscriberName
      ? result.dossier.subscriberName
      : 'Redacted on Explorer tier',
    PHONE_PROPS.subscriberPreview.maxLength
  );
  const cleanWebSummary = clampText(webSummary || '', PHONE_PROPS.webSummary.maxLength);

  let existingSnap;
  try {
    existingSnap = await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  const rawFormatted = clampText(
    result.formattedNational,
    PHONE_PROPS.formattedNational.maxLength,
    normalizedPhone
  );
  const formattedNational =
    rawFormatted.length >= PHONE_PROPS.formattedNational.minLength ? rawFormatted : normalizedPhone;

  const lineType = ALLOWED_LINE_TYPES.includes(result.lineType) ? result.lineType : 'Mobile';
  const riskLevel = ALLOWED_RISK_LEVELS.includes(result.riskAnalysis.riskLevel)
    ? result.riskAnalysis.riskLevel
    : 'Low';

  const mutableFields = {
    formattedNational,
    carrierName: clampText(result.carrier.name, PHONE_PROPS.carrierName.maxLength, 'Unknown Carrier'),
    lineType,
    spamScore: clampFiniteInt(result.riskAnalysis.spamScore, 0, 100),
    riskLevel,
    subscriberPreview,
    ...(cleanWebSummary ? { webSummary: cleanWebSummary } : {}),
    savedAt: serverTimestamp(),
  };

  if (existingSnap.exists()) {
    try {
      await updateDoc(ref, mutableFields);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    return lookupId;
  }

  try {
    await setDoc(ref, {
      id: lookupId,
      ownerId: uid,
      phoneNumber: normalizedPhone,
      ...mutableFields,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return lookupId;
}

export async function removePhoneLookupRecord(uid: string, lookupId: string): Promise<void> {
  assertValidId(uid, 'user');
  assertValidId(lookupId, 'lookup');
  const path = `users/${uid}/phoneLookups/${lookupId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'phoneLookups', lookupId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveAlprAuditRecord(
  uid: string,
  audit: VehicleAlprAuditResult
): Promise<string> {
  assertValidId(uid, 'user');
  const cleanPlate = audit.plateNumber.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const cleanState = audit.state.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);

  if (!PLATE_REGEX.test(cleanPlate) || !STATE_REGEX.test(cleanState)) {
    throw new Error('License plate or state jurisdiction does not match schema constraints.');
  }

  const auditId = buildAlprAuditId(cleanPlate, cleanState);
  assertValidId(auditId, 'audit');
  const path = `users/${uid}/alprAudits/${auditId}`;
  const ref = doc(db, 'users', uid, 'alprAudits', auditId);

  const overallStatus =
    audit.auditSummary.overallStatus === 'queried_active' ||
    audit.auditSummary.overallStatus === 'hotlist_flagged'
      ? 'queried_active'
      : 'passive_scan_only';

  let existingSnap;
  try {
    existingSnap = await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  const mutableFields = {
    overallStatus,
    detections30Days: clampFiniteInt(audit.auditSummary.totalDetections30Days, 0, 100000),
    activeQueriesCount: clampFiniteInt(audit.auditSummary.activeAgencyQueriesCount, 0, 10000),
    lastLocation: clampText(
      audit.auditSummary.lastDetectedLocation,
      ALPR_PROPS.lastLocation.maxLength,
      `Sector, ${cleanState}`
    ),
    retentionStandard: clampText(
      audit.auditSummary.retentionPolicyStandard,
      ALPR_PROPS.retentionStandard.maxLength,
      `${cleanState} ALPR Retention Policy`
    ),
    savedAt: serverTimestamp(),
  };

  if (existingSnap.exists()) {
    try {
      await updateDoc(ref, mutableFields);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    return auditId;
  }

  try {
    await setDoc(ref, {
      id: auditId,
      ownerId: uid,
      plateNumber: cleanPlate,
      state: cleanState,
      ...mutableFields,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return auditId;
}

export async function removeAlprAuditRecord(uid: string, auditId: string): Promise<void> {
  assertValidId(uid, 'user');
  assertValidId(auditId, 'audit');
  const path = `users/${uid}/alprAudits/${auditId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'alprAudits', auditId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertWatchlistItemRecord(
  uid: string,
  input: {
    itemType: 'phone' | 'plate';
    targetValue: string;
    jurisdictionState?: string;
    label: string;
    lastStatus: string;
  }
): Promise<string> {
  assertValidId(uid, 'user');
  const sanitizedTarget = input.targetValue.replace(/[^A-Za-z0-9+()\s-]/g, '').trim();
  const cleanTarget = clampText(sanitizedTarget, WATCH_PROPS.targetValue.maxLength);
  if (!TARGET_REGEX.test(cleanTarget)) {
    throw new Error('Watchlist target value contains unsupported characters.');
  }

  const cleanState =
    input.itemType === 'plate'
      ? (input.jurisdictionState || 'CA').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2)
      : '';
  if (input.itemType === 'plate' && !STATE_REGEX.test(cleanState)) {
    throw new Error('Select a valid 2-letter US state for plate watchlist targets.');
  }

  const itemId = buildWatchlistId(input.itemType, cleanTarget, cleanState);
  assertValidId(itemId, 'watchlist item');
  const path = `users/${uid}/watchlist/${itemId}`;
  const ref = doc(db, 'users', uid, 'watchlist', itemId);

  const label = clampText(input.label, WATCH_PROPS.label.maxLength, cleanTarget);
  const lastStatus = clampText(input.lastStatus, WATCH_PROPS.lastStatus.maxLength, 'Monitored');

  let existingSnap;
  try {
    existingSnap = await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (existingSnap.exists()) {
    try {
      await updateDoc(ref, {
        label,
        lastStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    return itemId;
  }

  try {
    await setDoc(ref, {
      id: itemId,
      ownerId: uid,
      itemType: input.itemType,
      targetValue: cleanTarget,
      jurisdictionState: cleanState,
      label,
      lastStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return itemId;
}

export async function updateWatchlistItemRecord(
  uid: string,
  itemId: string,
  label: string,
  lastStatus: string
): Promise<void> {
  assertValidId(uid, 'user');
  assertValidId(itemId, 'watchlist item');
  const path = `users/${uid}/watchlist/${itemId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'watchlist', itemId), {
      label: clampText(label, WATCH_PROPS.label.maxLength, 'Monitored Target'),
      lastStatus: clampText(lastStatus, WATCH_PROPS.lastStatus.maxLength, 'Checked'),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeWatchlistItemRecord(uid: string, itemId: string): Promise<void> {
  assertValidId(uid, 'user');
  assertValidId(itemId, 'watchlist item');
  const path = `users/${uid}/watchlist/${itemId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'watchlist', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
