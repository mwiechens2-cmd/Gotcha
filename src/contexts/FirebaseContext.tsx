import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, db, googleProvider, handleFirestoreError, OperationType, testConnection } from '../firebase';
import {
  ensureUserProfile,
  persistUserTier,
  removeAlprAuditRecord,
  removePhoneLookupRecord,
  removeWatchlistItemRecord,
  saveAlprAuditRecord,
  savePhoneLookupRecord,
  updateWatchlistItemRecord,
  upsertWatchlistItemRecord,
} from '../services/firestoreService';
import {
  PhoneLookupResult,
  SavedAlprAuditRecord,
  SavedPhoneLookupRecord,
  SubscriptionTierType,
  UserProfileRecord,
  VehicleAlprAuditResult,
  WatchlistItemRecord,
} from '../types';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  authLoading: boolean;
  dataLoading: boolean;
  userProfile: UserProfileRecord | null;
  savedPhoneLookups: SavedPhoneLookupRecord[];
  savedAlprAudits: SavedAlprAuditRecord[];
  watchlistItems: WatchlistItemRecord[];
  firebaseError: string | null;
  clearFirebaseError: () => void;
  retryConnection: () => Promise<void>;
  signInWithGoogle: () => Promise<User | null>;
  signOutUser: () => Promise<void>;
  syncTierSelection: (nextTier: SubscriptionTierType) => Promise<void>;
  savePhoneTrace: (result: PhoneLookupResult, tier: SubscriptionTierType, webSummary?: string) => Promise<string | null>;
  deletePhoneTrace: (lookupId: string) => Promise<void>;
  savePlateAudit: (audit: VehicleAlprAuditResult) => Promise<string | null>;
  deletePlateAudit: (auditId: string) => Promise<void>;
  addToWatchlist: (input: {
    itemType: 'phone' | 'plate';
    targetValue: string;
    jurisdictionState?: string;
    label: string;
    lastStatus: string;
  }) => Promise<string | null>;
  updateWatchlistItem: (itemId: string, label: string, lastStatus: string) => Promise<void>;
  deleteWatchlistItem: (itemId: string) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

function formatUserFacingError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  let extracted = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (parsed.error) extracted = parsed.error;
  } catch {
    // Plain error message
  }

  if (extracted.includes("Free daily read units per project")) {
    const url = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;
    return `Daily free Firestore read quota exceeded. Upgrade or review your database plan in Firebase Console: ${url}`;
  }
  if (extracted.toLowerCase().includes('quota exceeded')) {
    return 'Firestore usage quota exceeded. Quota resets tomorrow (see Spark plan limits under Cloud Firestore Enterprise edition).';
  }
  return extracted;
}

function toEpochMs(ts: unknown): number {
  if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export const FirebaseProvider: React.FC<{
  children: React.ReactNode;
  currentTier: SubscriptionTierType;
  onTierHydrated: (tier: SubscriptionTierType) => void;
}> = ({ children, currentTier, onTierHydrated }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfileRecord | null>(null);
  const [savedPhoneLookups, setSavedPhoneLookups] = useState<SavedPhoneLookupRecord[]>([]);
  const [savedAlprAudits, setSavedAlprAudits] = useState<SavedAlprAuditRecord[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItemRecord[]>([]);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const latestTierRef = useRef(currentTier);
  const onTierHydratedRef = useRef(onTierHydrated);
  latestTierRef.current = currentTier;
  onTierHydratedRef.current = onTierHydrated;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (!nextUser) {
        setUserProfile(null);
        setSavedPhoneLookups([]);
        setSavedAlprAudits([]);
        setWatchlistItems([]);
        setDataLoading(false);
        return;
      }

      setDataLoading(true);
      try {
        const profile = await ensureUserProfile(nextUser, latestTierRef.current);
        setUserProfile(profile);
        onTierHydratedRef.current(profile.tier);
      } catch (err) {
        setFirebaseError(formatUserFacingError(err));
      } finally {
        setDataLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Attach real-time Firestore listeners only when auth is ready and user is authenticated
  useEffect(() => {
    if (!authReady || !user) return;

    const uid = user.uid;
    const phonePath = `users/${uid}/phoneLookups`;
    const alprPath = `users/${uid}/alprAudits`;
    const watchPath = `users/${uid}/watchlist`;

    const unsubPhones = onSnapshot(
      query(collection(db, 'users', uid, 'phoneLookups'), where('ownerId', '==', uid)),
      (snapshot) => {
        const rows = snapshot.docs.map((d) => d.data() as SavedPhoneLookupRecord);
        rows.sort((a, b) => toEpochMs(b.savedAt) - toEpochMs(a.savedAt));
        setSavedPhoneLookups(rows);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, phonePath);
        } catch (wrapped) {
          setFirebaseError(formatUserFacingError(wrapped));
        }
      }
    );

    const unsubAlprs = onSnapshot(
      query(collection(db, 'users', uid, 'alprAudits'), where('ownerId', '==', uid)),
      (snapshot) => {
        const rows = snapshot.docs.map((d) => d.data() as SavedAlprAuditRecord);
        rows.sort((a, b) => toEpochMs(b.savedAt) - toEpochMs(a.savedAt));
        setSavedAlprAudits(rows);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, alprPath);
        } catch (wrapped) {
          setFirebaseError(formatUserFacingError(wrapped));
        }
      }
    );

    const unsubWatch = onSnapshot(
      query(collection(db, 'users', uid, 'watchlist'), where('ownerId', '==', uid)),
      (snapshot) => {
        const rows = snapshot.docs.map((d) => d.data() as WatchlistItemRecord);
        rows.sort((a, b) => toEpochMs(b.updatedAt) - toEpochMs(a.updatedAt));
        setWatchlistItems(rows);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, watchPath);
        } catch (wrapped) {
          setFirebaseError(formatUserFacingError(wrapped));
        }
      }
    );

    return () => {
      unsubPhones();
      unsubAlprs();
      unsubWatch();
    };
  }, [authReady, user]);

  const signInWithGoogle = async (): Promise<User | null> => {
    setAuthLoading(true);
    setFirebaseError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      return cred.user;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return null;
      }
      setFirebaseError(formatUserFacingError(err));
      return null;
    } finally {
      setAuthLoading(false);
    }
  };

  const signOutUser = async (): Promise<void> => {
    setFirebaseError(null);
    try {
      await signOut(auth);
    } catch (err) {
      setFirebaseError(formatUserFacingError(err));
    }
  };

  const syncTierSelection = async (nextTier: SubscriptionTierType): Promise<void> => {
    if (!user) return;
    setFirebaseError(null);
    try {
      await persistUserTier(user.uid, nextTier);
      setUserProfile((prev) => (prev ? { ...prev, tier: nextTier } : prev));
    } catch (err) {
      setFirebaseError(formatUserFacingError(err));
    }
  };

  const requireSignedInUser = async (): Promise<User | null> => {
    if (user) return user;
    return signInWithGoogle();
  };

  const savePhoneTrace = async (
    result: PhoneLookupResult,
    tier: SubscriptionTierType,
    webSummary?: string
  ): Promise<string | null> => {
    const activeUser = await requireSignedInUser();
    if (!activeUser) return null;
    setFirebaseError(null);
    try {
      await ensureUserProfile(activeUser, tier);
      return await savePhoneLookupRecord(activeUser.uid, result, tier, webSummary);
    } catch (err) {
      setFirebaseError(formatUserFacingError(err));
      return null;
    }
  };

  const deletePhoneTrace = async (lookupId: string): Promise<void> => {
    if (!user) return;
    setFirebaseError(null);
    try {
      await removePhoneLookupRecord(user.uid, lookupId);
    } catch (err) {
      setFirebaseError(formatUserFacingError(err));
    }
  };

  const savePlateAudit = async (audit: VehicleAlprAuditResult): Promise<string | null> => {
    const activeUser = await requireSignedInUser();
    if (!activeUser) return null;
    setFirebaseError(null);
    try {
      await ensureUserProfile(activeUser, currentTier);
      return await saveAlprAuditRecord(activeUser.uid, audit);
    } catch (err) {
      setFirebaseError(formatUserFacingError(err));
      return null;
    }
  };

  const deletePlateAudit = async (auditId: string): Promise<void> => {
    if (!user) return;
    setFirebaseError(null);
    try {
      await removeAlprAuditRecord(user.uid, auditId);
    } catch (err) {
      setFirebaseError(formatUserFacingError(err));
    }
  };

  const addToWatchlist = async (input: {
    itemType: 'phone' | 'plate';
    targetValue: string;
    jurisdictionState?: string;
    label: string;
    lastStatus: string;
  }): Promise<string | null> => {
    const activeUser = await requireSignedInUser();
    if (!activeUser) return null;
    setFirebaseError(null);
    try {
      await ensureUserProfile(activeUser, currentTier);
      return await upsertWatchlistItemRecord(activeUser.uid, input);
    } catch (err) {
      setFirebaseError(formatUserFacingError(err));
      return null;
    }
  };

  const updateWatchlistItem = async (
    itemId: string,
    label: string,
    lastStatus: string
  ): Promise<void> => {
    if (!user) return;
    setFirebaseError(null);
    try {
      await updateWatchlistItemRecord(user.uid, itemId, label, lastStatus);
    } catch (err) {
      setFirebaseError(formatUserFacingError(err));
    }
  };

  const deleteWatchlistItem = async (itemId: string): Promise<void> => {
    if (!user) return;
    setFirebaseError(null);
    try {
      await removeWatchlistItemRecord(user.uid, itemId);
    } catch (err) {
      setFirebaseError(formatUserFacingError(err));
    }
  };

  const retryConnection = async (): Promise<void> => {
    setFirebaseError(null);
    try {
      await testConnection();
      if (user) {
        const profile = await ensureUserProfile(user, currentTier);
        setUserProfile(profile);
        onTierHydrated(profile.tier);
      }
    } catch (err) {
      setFirebaseError(formatUserFacingError(err));
    }
  };

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        authLoading,
        dataLoading,
        userProfile,
        savedPhoneLookups,
        savedAlprAudits,
        watchlistItems,
        firebaseError,
        clearFirebaseError: () => setFirebaseError(null),
        retryConnection,
        signInWithGoogle,
        signOutUser,
        syncTierSelection,
        savePhoneTrace,
        deletePhoneTrace,
        savePlateAudit,
        deletePlateAudit,
        addToWatchlist,
        updateWatchlistItem,
        deleteWatchlistItem,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used within FirebaseProvider.');
  }
  return ctx;
}
