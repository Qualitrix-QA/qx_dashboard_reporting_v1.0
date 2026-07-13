/**
 * projectService.ts — Firebase persistence layer for Quality Lens projects.
 *
 * Design:
 *  - Projects are stored entirely in Firestore documents.
 *  - Metadata and payload are stored in the same document.
 *  - Payload size is validated before save (950 KB limit as safety margin below Firestore's 1 MB limit).
 *  - All functions are pure async utilities with no React dependencies.
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  arrayUnion,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import type { ShareLink, SharedWithEntry, Notification, UserProfile } from "@/types/sharing";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Project metadata stored in Firestore. */
export interface ProjectMetadata {
  id: string;              // Firestore document ID
  name: string;
  description: string;
  ownerId: string;
  createdAt: number;       // unix ms
  updatedAt: number;       // unix ms
  ownerEmail?: string;
  ownerName?: string;
}

/** Full payload stored in Firestore. */
export interface ProjectPayloadV1 {
  version: 1;
  savedAt: number;
  fileName: string;
  rows: Record<string, string>[];
  aiSchema: any | null;
  latestInsights: string | null;
  projectLevelData: any;
  newInitiativesData: any[];
  riskMitigationData: any[];
  dashboardOverrides: Record<string, any>;
  dashboardNotes: Record<string, string[]>;
  slideVisibility: Record<string, boolean>;
}

/** Discriminated union — add ProjectPayloadV2 here in future phases. */
export type ProjectPayload = ProjectPayloadV1;

// ─── Internal helpers ─────────────────────────────────────────────────────────

const PROJECTS_COLLECTION = "projects";
const MAX_PAYLOAD_SIZE_KB = 950;

/** Validates that the serialized payload does not exceed the 950 KB safety limit. */
function validatePayloadSize(payload: ProjectPayload): void {
  const serialized = JSON.stringify(payload);
  const sizeKB = new Blob([serialized]).size / 1024;
  if (sizeKB > MAX_PAYLOAD_SIZE_KB) {
    throw new Error(
      `Project exceeds Firestore's 1 MB document limit (payload is ${sizeKB.toFixed(1)} KB). ` +
      `Reduce the project size or switch to Firebase Storage.`
    );
  }
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Saves a brand-new project.
 * Stores metadata and payload in a single Firestore document.
 * Returns the new projectId.
 * Throws if payload exceeds size limits.
 */
export async function saveProject(
  uid: string,
  name: string,
  description: string,
  payload: ProjectPayload
): Promise<string> {
  validatePayloadSize(payload);

  const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), {
    name,
    description,
    ownerId: uid,
    payload,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return docRef.id;
}

/**
 * Updates an existing project's payload and optionally its name / description.
 * Throws if payload exceeds size limits.
 */
export async function updateProject(
  projectId: string,
  payload: ProjectPayload,
  updates?: { name?: string; description?: string }
): Promise<void> {
  const metaDoc = await getDoc(doc(db, PROJECTS_COLLECTION, projectId));
  if (!metaDoc.exists()) throw new Error(`Project ${projectId} not found.`);

  const raw = metaDoc.data();
  console.log("[Verification Log] updateProject() executing. Saving to project ID:", projectId, "Document Owner ID:", raw?.ownerId);

  validatePayloadSize(payload);

  await updateDoc(doc(db, PROJECTS_COLLECTION, projectId), {
    payload,
    updatedAt: Timestamp.now(),
    ...(updates?.name !== undefined && { name: updates.name }),
    ...(updates?.description !== undefined && { description: updates.description }),
  });
}

/**
 * Loads a saved project by its projectId.
 * Fetches metadata and payload from Firestore.
 * Returns both the metadata and the payload.
 */
export async function loadProject(projectId: string): Promise<{
  metadata: ProjectMetadata;
  payload: ProjectPayload;
}> {
  const metaDoc = await getDoc(doc(db, PROJECTS_COLLECTION, projectId));
  if (!metaDoc.exists()) throw new Error(`Project ${projectId} not found.`);

  const raw = metaDoc.data();
  console.log("[Verification Log] loadProject() completed. Loaded project ID:", projectId, "Owner ID:", raw.ownerId);
  const metadata: ProjectMetadata = {
    id: metaDoc.id,
    name: raw.name,
    description: raw.description ?? "",
    ownerId: raw.ownerId,
    createdAt: raw.createdAt?.toMillis?.() ?? 0,
    updatedAt: raw.updatedAt?.toMillis?.() ?? 0,
  };

  const payload = raw.payload as ProjectPayload;

  return { metadata, payload };
}

/**
 * Lists all projects owned by the given uid, ordered by most recently updated.
 */
export async function listUserProjects(uid: string): Promise<ProjectMetadata[]> {
  const q = query(
    collection(db, PROJECTS_COLLECTION),
    where("ownerId", "==", uid),
    orderBy("updatedAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const raw = d.data();
    return {
      id: d.id,
      name: raw.name,
      description: raw.description ?? "",
      ownerId: raw.ownerId,
      createdAt: raw.createdAt?.toMillis?.() ?? 0,
      updatedAt: raw.updatedAt?.toMillis?.() ?? 0,
    };
  });
}

/**
 * Renames a project and/or updates its description.
 * Only touches Firestore — no Storage operation needed.
 */
export async function renameProject(
  projectId: string,
  name: string,
  description?: string
): Promise<void> {
  await updateDoc(doc(db, PROJECTS_COLLECTION, projectId), {
    name,
    ...(description !== undefined && { description }),
    updatedAt: Timestamp.now(),
  });
}

/**
 * Permanently deletes a project — removes the Firestore document.
 */
export async function deleteProject(projectId: string): Promise<void> {
  await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId));
}

// ─── Sharing Functionality ─────────────────────────────────────────────────────

const USERS_COLLECTION = "users";
const NOTIFICATIONS_COLLECTION = "notifications";
const SHARE_LINKS_COLLECTION = "shareLinks";

/** Generates a UUID-style share link ID. */
function generateShareLinkId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Validates email format. */
function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Retrieves user profile by email.
 * Returns null if user not found.
 */
export async function getUserByEmail(email: string): Promise<UserProfile | null> {
  const q = query(
    collection(db, USERS_COLLECTION),
    where("email", "==", email.toLowerCase())
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  const data = doc.data();
  return {
    uid: doc.id,
    email: data.email,
    displayName: data.displayName,
    createdAt: data.createdAt?.toMillis?.() ?? 0,
  };
}

/**
 * Creates or updates a user record.
 * Called on signup/login to maintain users collection for email lookups.
 */
export async function createOrUpdateUserRecord(
  uid: string,
  email: string,
  displayName?: string
): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, uid);
  const userDoc = await getDoc(userRef);
  const now = Timestamp.now();
  
  if (userDoc.exists()) {
    await setDoc(
      userRef,
      {
        uid,
        email: email.toLowerCase(),
        displayName: displayName || "",
        updatedAt: now,
      },
      { merge: true }
    );
  } else {
    await setDoc(
      userRef,
      {
        uid,
        email: email.toLowerCase(),
        displayName: displayName || "",
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  }
}

/**
 * Shares a project with a registered user immediately.
 * Adds user to sharedWith and creates a notification document
 * in the root notifications collection.
 */
export async function shareProjectWithUser(
  projectId: string,
  recipientUid: string,
  recipientEmail: string,
  ownerEmail: string,
  projectName: string,
  senderUid?: string
): Promise<void> {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);

  // Check if already shared
  const projectDoc = await getDoc(projectRef);
  if (!projectDoc.exists()) throw new Error(`Project ${projectId} not found.`);

  const existingShares = projectDoc.data().sharedWith || [];
  const alreadyShared = existingShares.some((s: any) => {
    if (typeof s === "string") return s === recipientUid;
    return s?.uid === recipientUid;
  });
  if (alreadyShared) {
    throw new Error("Project already shared with this user.");
  }

  // Add recipient to project's sharedWith array
  await updateDoc(projectRef, {
    sharedWith: arrayUnion(recipientUid),
  });

  // Create notification document in the root notifications collection.
  // Resolves senderUid from the explicit parameter, then from the Firestore
  // project's ownerId as a reliable fallback.
  const resolvedSenderUid =
    senderUid || projectDoc.data().ownerId || "";

  await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
    recipientUid,
    senderUid: resolvedSenderUid,
    senderEmail: ownerEmail,
    projectId,
    projectName,
    type: "project_shared",
    isRead: false,
    createdAt: serverTimestamp(),
  });
}

/**
 * Generates a shareable link for unregistered users.
 * Adds to project.shareLinks and creates a shareLinks doc.
 */
export async function generateShareLink(
  projectId: string,
  email: string
): Promise<string> {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const projectDoc = await getDoc(projectRef);
  if (!projectDoc.exists()) throw new Error(`Project ${projectId} not found.`);

  const linkId = generateShareLinkId();
  const now = Timestamp.now();

  // Add to project.shareLinks array
  await updateDoc(projectRef, {
    shareLinks: arrayUnion({
      linkId,
      email: email.toLowerCase(),
      createdAt: now,
    }),
  });

  // Create shareLinks doc for quick lookup
  await setDoc(doc(db, SHARE_LINKS_COLLECTION, linkId), {
    projectId,
    email: email.toLowerCase(),
    createdAt: now,
  });

  return linkId;
}

/**
 * Retrieves share link details by linkId.
 */
export async function getShareLinkByLinkId(linkId: string): Promise<ShareLink | null> {
  const docSnapshot = await getDoc(doc(db, SHARE_LINKS_COLLECTION, linkId));
  if (!docSnapshot.exists()) return null;

  const data = docSnapshot.data() as { projectId: string; email: string; createdAt: Timestamp };
  return {
    linkId,
    email: data.email,
    createdAt: data.createdAt?.toMillis?.() ?? 0,
  };
}

/**
 * Redeems a share link when user accesses it after logging in.
 * Converts pending share to permanent access.
 * If the redeeming user is the project owner, we skip the sharedWith write
 * so the project does not appear twice (once in My Projects, once in Shared with Me).
 */
export async function redeemShareLink(linkId: string, userId: string): Promise<string> {
  const shareLinkDoc = await getDoc(doc(db, SHARE_LINKS_COLLECTION, linkId));
  if (!shareLinkDoc.exists()) throw new Error("Share link not found or expired.");

  const { projectId } = shareLinkDoc.data();

  // Check if the redeeming user is the project owner — skip sharedWith update if so.
  const projectSnap = await getDoc(doc(db, PROJECTS_COLLECTION, projectId));
  const projectData = projectSnap.exists() ? projectSnap.data() : null;
  const isOwner = projectData && projectData.ownerId === userId;

  if (!isOwner) {
    // Add user to project.sharedWith (flat array of UIDs)
    await updateDoc(doc(db, PROJECTS_COLLECTION, projectId), {
      sharedWith: arrayUnion(userId),
    });

    // Also create a notification document in Firestore for the redeeming user
    // so they see the shared project in their notification list.
    const ownerId = projectData?.ownerId || "";
    let ownerEmail = "A colleague";
    if (ownerId) {
      const ownerProfile = await getUserProfile(ownerId);
      if (ownerProfile) ownerEmail = ownerProfile.email;
    }

    await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
      recipientUid: userId,
      senderUid: ownerId,
      senderEmail: ownerEmail,
      projectId,
      projectName: projectData?.name || "Shared Project",
      type: "project_shared",
      isRead: false,
      createdAt: serverTimestamp(),
    });
  }

  // Mark the link as accessed for audit purposes
  await updateDoc(shareLinkDoc.ref, {
    accessedAt: Timestamp.now(),
  });

  return projectId;
}

/**
 * Retrieves user profile by UID.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, USERS_COLLECTION, uid);
  const userDoc = await getDoc(userRef);
  if (!userDoc.exists()) return null;
  const data = userDoc.data();
  return {
    uid: userDoc.id,
    email: data.email,
    displayName: data.displayName,
    createdAt: data.createdAt?.toMillis?.() ?? 0,
  };
}

/**
 * Lists all projects shared with a user.
 * Projects owned by the requesting user are excluded — Firestore does not
 * support combining array-contains with != in a single query, so we filter
 * client-side after the fetch.
 */
export async function getUserSharedProjects(uid: string): Promise<ProjectMetadata[]> {
  const q = query(
    collection(db, PROJECTS_COLLECTION),
    where("sharedWith", "array-contains", uid)
  );
  const snapshot = await getDocs(q);

  // Exclude documents the current user owns so the project they shared never
  // appears under "Shared with Me" — it already shows in "My Projects".
  const sharedDocs = snapshot.docs.filter((d) => d.data().ownerId !== uid);

  const projects = await Promise.all(
    sharedDocs.map(async (d) => {
      const raw = d.data();
      let ownerEmail = "";
      let ownerName = "";
      if (raw.ownerId) {
        try {
          const ownerProfile = await getUserProfile(raw.ownerId);
          if (ownerProfile) {
            ownerEmail = ownerProfile.email;
            ownerName = ownerProfile.displayName || "";
          }
        } catch (err) {
          console.error("Failed to fetch owner profile:", err);
        }
      }
      return {
        id: d.id,
        name: raw.name,
        description: raw.description ?? "",
        ownerId: raw.ownerId,
        createdAt: raw.createdAt?.toMillis?.() ?? 0,
        updatedAt: raw.updatedAt?.toMillis?.() ?? 0,
        ownerEmail,
        ownerName,
      };
    })
  );

  return projects;
}

/**
 * Creates a notification for a user.
 */
export async function createNotification(
  uid: string,
  type: string,
  data: { projectId: string; projectName: string; sharedBy: string }
): Promise<void> {
  await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
    recipientUid: uid,
    senderUid: "",
    senderEmail: data.sharedBy,
    projectId: data.projectId,
    projectName: data.projectName,
    type,
    isRead: false,
    createdAt: serverTimestamp(),
  });
}

/**
 * Lists all notifications for a user from the root collection.
 */
export async function getUserNotifications(
  uid: string,
  unreadOnly: boolean = false
): Promise<Notification[]> {
  let q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where("recipientUid", "==", uid)
  );

  if (unreadOnly) {
    q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where("recipientUid", "==", uid),
      where("isRead", "==", false)
    );
  }

  const snapshot = await getDocs(q);
  const notifications = snapshot.docs.map((d) => {
    const raw = d.data();
    return {
      id: d.id,
      uid: raw.recipientUid || "",
      type: (raw.type || "project_shared") as "project_shared",
      projectId: raw.projectId || "",
      projectName: raw.projectName || "",
      sharedBy: raw.senderEmail || "",
      createdAt: raw.createdAt?.toMillis?.() ?? 0,
      read: raw.isRead ?? false,
    };
  });

  // Sort client-side by createdAt descending
  return notifications.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Marks a notification as read in the root collection.
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  await updateDoc(
    doc(db, NOTIFICATIONS_COLLECTION, notificationId),
    { isRead: true }
  );
}

/**
 * Subscribes to real-time notifications for a user.
 */
export function subscribeUserNotifications(
  uid: string,
  callback: (notifications: Notification[]) => void
) {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where("recipientUid", "==", uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const notifications = snapshot.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          uid: raw.recipientUid || "",
          type: (raw.type || "project_shared") as "project_shared",
          projectId: raw.projectId || "",
          projectName: raw.projectName || "",
          sharedBy: raw.senderEmail || "",
          createdAt: raw.createdAt?.toMillis?.() ?? 0,
          read: raw.isRead ?? false,
        };
      });
      // Sort client-side by createdAt descending
      notifications.sort((a, b) => b.createdAt - a.createdAt);
      callback(notifications);
    },
    (err) => {
      console.error("Error in subscribeUserNotifications:", err);
    }
  );
}

/**
 * Marks all unread notifications for a project as read.
 */
export async function markProjectNotificationsAsRead(uid: string, projectId: string): Promise<void> {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where("recipientUid", "==", uid),
    where("projectId", "==", projectId),
    where("isRead", "==", false)
  );
  const snapshot = await getDocs(q);
  const batch = snapshot.docs.map((d) =>
    updateDoc(doc(db, NOTIFICATIONS_COLLECTION, d.id), { isRead: true })
  );
  await Promise.all(batch);
}

/**
 * Opens a shared project as an independent personal copy for the recipient.
 *
 * - First open: loads the owner's payload, creates a new project document
 *   owned by the recipient with copiedFromShared = true and originalProjectId
 *   pointing to the owner's document, then returns the copy's metadata + payload.
 * - Subsequent opens: finds the existing copy and returns it directly.
 *
 * The owner's document is NEVER modified by this function.
 */
export async function getOrCreateRecipientCopy(
  originalProjectId: string,
  recipientUid: string
): Promise<{ metadata: ProjectMetadata; payload: ProjectPayload; copyId: string }> {
  // 1. Check if the recipient already has a personal copy of this project.
  const existingQ = query(
    collection(db, PROJECTS_COLLECTION),
    where("ownerId", "==", recipientUid),
    where("originalProjectId", "==", originalProjectId),
    where("copiedFromShared", "==", true)
  );
  const existingSnap = await getDocs(existingQ);

  if (!existingSnap.empty) {
    // Return the existing copy.
    const copyDoc = existingSnap.docs[0];
    const raw = copyDoc.data();
    console.log("[Verification Log] Personal copy already exists. No new copy created.");
    console.log("[Verification Log] Loaded copy document. Project ID:", copyDoc.id, "Owner ID:", raw.ownerId);

    const metadata: ProjectMetadata = {
      id: copyDoc.id,
      name: raw.name,
      description: raw.description ?? "",
      ownerId: raw.ownerId,
      createdAt: raw.createdAt?.toMillis?.() ?? 0,
      updatedAt: raw.updatedAt?.toMillis?.() ?? 0,
    };
    return { metadata, payload: raw.payload as ProjectPayload, copyId: copyDoc.id };
  }

  // 2. No copy yet — load the owner's original project using loadProject to trigger its logging.
  console.log("[Verification Log] No personal copy found. Creating a new personal copy. Original Project ID:", originalProjectId);
  const { metadata: originalMeta, payload: originalPayload } = await loadProject(originalProjectId);
  console.log("[Verification Log] Loaded original project document. Project ID:", originalProjectId, "Owner ID (Original):", originalMeta.ownerId);

  const originalName: string = originalMeta.name ?? "Shared Project";
  const originalDescription: string = originalMeta.description ?? "";

  // 3. Create a personal copy owned by the recipient.
  validatePayloadSize(originalPayload);
  const now = Timestamp.now();
  const copyRef = await addDoc(collection(db, PROJECTS_COLLECTION), {
    name: originalName,
    description: originalDescription,
    ownerId: recipientUid,
    payload: originalPayload,
    createdAt: now,
    updatedAt: now,
    copiedFromShared: true,
    originalProjectId,
  });

  console.log("[Verification Log] Personal copy created successfully. New copy ID:", copyRef.id, "Owner ID (Recipient):", recipientUid);

  const metadata: ProjectMetadata = {
    id: copyRef.id,
    name: originalName,
    description: originalDescription,
    ownerId: recipientUid,
    createdAt: now.toMillis(),
    updatedAt: now.toMillis(),
  };

  return { metadata, payload: originalPayload, copyId: copyRef.id };
}

// Re-export utilities for use in components
export { validateEmail, generateShareLinkId };
