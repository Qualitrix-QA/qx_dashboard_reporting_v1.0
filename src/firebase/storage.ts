import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Uploads a file (File or Blob) to the specified storage path.
 * Returns the public download URL of the uploaded file.
 */
export async function uploadFile(file: File | Blob, path: string): Promise<string> {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

/**
 * Deletes a file at the specified storage path.
 */
export async function deleteFile(path: string): Promise<void> {
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
}

/**
 * Retrieves the public download URL for a file at the specified storage path.
 */
export async function getDownloadUrl(path: string): Promise<string> {
  const storageRef = ref(storage, path);
  return getDownloadURL(storageRef);
}
