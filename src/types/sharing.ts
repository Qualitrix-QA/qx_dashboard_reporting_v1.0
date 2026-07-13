/**
 * sharing.ts — Types for project sharing functionality.
 * Backward compatible — all fields optional for existing projects.
 */

export interface ShareLink {
  linkId: string;           // UUID for shareable link
  email: string;            // Pending recipient email
  createdAt: number;        // Unix ms timestamp
}

export interface SharedWithEntry {
  uid: string;              // Recipient user ID
  email: string;            // Recipient email
  sharedAt: number;         // Unix ms timestamp
}

export interface Notification {
  id: string;               // Firestore doc ID
  uid: string;              // Recipient user ID
  type: "project_shared";   // Notification type
  projectId: string;        // Shared project ID
  projectName: string;      // Project name at time of share
  sharedBy: string;         // Owner email
  createdAt: number;        // Unix ms timestamp
  read: boolean;            // Read status
}

export interface UserProfile {
  uid: string;              // Firebase user ID
  email: string;            // User email (indexed for lookup)
  displayName?: string;     // Optional display name
  createdAt: number;        // Account creation timestamp
}
