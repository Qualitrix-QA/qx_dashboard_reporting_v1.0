import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  DocumentData,
  QueryConstraint,
  query,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Creates a new document in the specified collection.
 * If customDocId is provided, it sets the document with that ID;
 * otherwise, Firestore generates a random ID automatically.
 * Returns the document ID.
 */
export async function createDocument(
  collectionPath: string,
  data: DocumentData,
  customDocId?: string
): Promise<string> {
  if (customDocId) {
    const docRef = doc(db, collectionPath, customDocId);
    await setDoc(docRef, data);
    return customDocId;
  } else {
    const docRef = await addDoc(collection(db, collectionPath), data);
    return docRef.id;
  }
}

/**
 * Retrieves a single document snapshot from the collection.
 * Returns the document data with the document `id`, or null if it doesn't exist.
 */
export async function getDocument(collectionPath: string, docId: string): Promise<DocumentData | null> {
  const docRef = doc(db, collectionPath, docId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

/**
 * Updates properties on an existing document in a collection.
 */
export async function updateDocument(
  collectionPath: string,
  docId: string,
  data: Partial<DocumentData>
): Promise<void> {
  const docRef = doc(db, collectionPath, docId);
  await updateDoc(docRef, data);
}

/**
 * Deletes a document by its ID.
 */
export async function deleteDocument(collectionPath: string, docId: string): Promise<void> {
  const docRef = doc(db, collectionPath, docId);
  await deleteDoc(docRef);
}

/**
 * Retrieves all documents in a collection.
 */
export async function getCollectionDocuments(collectionPath: string): Promise<DocumentData[]> {
  const querySnapshot = await getDocs(collection(db, collectionPath));
  return querySnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

/**
 * Subscribes to real-time updates for a single document.
 * Returns an unsubscribe callback function.
 */
export function subscribeToDocument(
  collectionPath: string,
  docId: string,
  callback: (data: DocumentData | null) => void
): () => void {
  const docRef = doc(db, collectionPath, docId);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    } else {
      callback(null);
    }
  });
}

/**
 * Subscribes to real-time updates for a collection with optional query constraints (e.g. where, orderBy).
 * Returns an unsubscribe callback function.
 */
export function subscribeToCollection(
  collectionPath: string,
  callback: (docs: DocumentData[]) => void,
  ...constraints: QueryConstraint[]
): () => void {
  const collectionRef = collection(db, collectionPath);
  const q = query(collectionRef, ...constraints);
  return onSnapshot(q, (querySnapshot) => {
    const docs = querySnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    callback(docs);
  });
}
