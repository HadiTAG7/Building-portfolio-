"use client";

import { firebaseConfig, isFirebaseConfigured } from "./config";

export interface LibraryEntry {
  id: string;
  name: string;
  author: string | null;
  note: string | null;
  /** Percent weights keyed by ticker. */
  weights: Record<string, number>;
  ownerUid: string;
  createdAt: number | null;
}

const COLLECTION = "portfolios";

let emulatorsConnected = false;

// The SDK is loaded on demand so visitors who never open the library don't download it.
async function sdk() {
  const [{ getApps, initializeApp }, firestore, auth] = await Promise.all([
    import("firebase/app"),
    import("firebase/firestore"),
    import("firebase/auth"),
  ]);
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  const db = firestore.getFirestore(app);
  const authInstance = auth.getAuth(app);
  // Local testing against `firebase emulators:start` (NEXT_PUBLIC_FIREBASE_EMULATOR=1).
  if (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1" && !emulatorsConnected) {
    emulatorsConnected = true;
    firestore.connectFirestoreEmulator(db, "127.0.0.1", 8080);
    auth.connectAuthEmulator(authInstance, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  return { app, firestore, auth, db, authInstance };
}

/** Anonymous sign-in gives each browser a stable id, so people can delete only what they saved. */
export async function currentUserId(): Promise<string | null> {
  if (!isFirebaseConfigured) return null;
  const { auth, authInstance } = await sdk();
  if (authInstance.currentUser) return authInstance.currentUser.uid;
  const cred = await auth.signInAnonymously(authInstance);
  return cred.user.uid;
}

export async function listLibrary(): Promise<LibraryEntry[]> {
  const { firestore, db } = await sdk();
  const q = firestore.query(firestore.collection(db, COLLECTION), firestore.orderBy("createdAt", "desc"), firestore.limit(200));
  const snap = await firestore.getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    const created = data.createdAt as { toMillis?: () => number } | undefined;
    return {
      id: d.id,
      name: String(data.name ?? ""),
      author: typeof data.author === "string" && data.author ? data.author : null,
      note: typeof data.note === "string" && data.note ? data.note : null,
      weights: (data.weights ?? {}) as Record<string, number>,
      ownerUid: String(data.ownerUid ?? ""),
      createdAt: created?.toMillis ? created.toMillis() : null,
    };
  });
}

export async function saveToLibrary(entry: { name: string; author: string; note: string; weights: Record<string, number> }): Promise<string> {
  const uid = await currentUserId();
  if (!uid) throw new Error("not signed in");
  const { firestore, db } = await sdk();
  const doc: Record<string, unknown> = {
    v: 1,
    name: entry.name.trim().slice(0, 60),
    weights: entry.weights,
    ownerUid: uid,
    createdAt: firestore.serverTimestamp(),
  };
  if (entry.author.trim()) doc.author = entry.author.trim().slice(0, 40);
  if (entry.note.trim()) doc.note = entry.note.trim().slice(0, 280);
  const ref = await firestore.addDoc(firestore.collection(db, COLLECTION), doc);
  return ref.id;
}

export async function deleteFromLibrary(id: string): Promise<void> {
  const { firestore, db } = await sdk();
  await firestore.deleteDoc(firestore.doc(db, COLLECTION, id));
}
