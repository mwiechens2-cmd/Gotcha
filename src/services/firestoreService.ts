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

function clampText(value: string, maxLen: number, fallback = ''): string {
  const cleaned = value.trim();
  if (!cleaned) return fallback;
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
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

export async function ensureUserProfile(
  user: User,
  fallbackTier: SubscriptionTierType
): Promise<UserProfileRecord> {
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

  const email = clampText(user.email || '', USER_PROPS.email.maxLength);
  if (!email) {
    throw new Error('Google account is missing a verified email address.');
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
}

export async function persistUserTier(uid: string, nextTier: SubscriptionTierType): Promise<void> {
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
  const lookupId = buildPhoneLookupId(result.phoneNumber);
  const path = `users/${uid}/phoneLookups/${lookupId}`;
  const ref = doc(db, 'users', uid, 'phoneLookups', lookupId);

  const normalizedPhone = clampText(result.phoneNumber, PHONE_PROPS.phoneNumber.maxLength);
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

  const mutableFields = {
    formattedNational: clampText(
      result.formattedNational,
      PHONE_PROPS.formattedNational.maxLength,
      normalizedPhone
    ),
    carrierName: clampText(result.carrier.name, PHONE_PROPS.carrierName.maxLength, 'Unknown Carrier'),
    lineType: result.lineType,
    spamScore: Math.max(0, Math.min(100, Math.round(result.riskAnalysis.spamScore))),
    riskLevel: result.riskAnalysis.riskLevel,
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
  const cleanPlate = audit.plateNumber.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const cleanState = audit.state.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);

  if (!PLATE_REGEX.test(cleanPlate) || !STATE_REGEX.test(cleanState)) {
    throw new Error('License plate or state jurisdiction does not match schema constraints.');
  }

  const auditId = buildAlprAuditId(cleanPlate, cleanState);
  const path = `users/${uid}/alprAudits/${auditId}`;
  const ref = doc(db, 'users', uid, 'alprAudits', auditId);

  const overallStatus =
    audit.auditSummary.overallStatus === 'queried_active' ? 'queried_active' : 'passive_scan_only';

  let existingSnap;
  try {
    existingSnap = await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  const mutableFields = {
    overallStatus,
    detections30Days: Math.max(0, Math.min(100000, Math.round(audit.auditSummary.totalDetections30Days))),
    activeQueriesCount: Math.max(
      0,
      Math.min(10000, Math.round(audit.auditSummary.activeAgencyQueriesCount))
    ),
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
  const cleanTarget = clampText(input.targetValue, WATCH_PROPS.targetValue.maxLength);
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
  const path = `users/${uid}/watchlist/${itemId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'watchlist', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
