"use client";

import { ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
import { getFirebase } from "./firebase";

const MAX_DIMENSION = 480; // plenty for a letterhead-sized logo; keeps the file small to upload on poor connections
const STORAGE_PATH = (businessId: string) => `logos/${businessId}/logo.png`;

// PNG (not JPEG, unlike lib/imageResize.ts) so a transparent-background
// logo stays transparent on the printed letterhead instead of gaining a
// white/black box around it.
function resizeToPngDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that image."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Couldn't read that image."));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width >= height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Image processing isn't supported in this browser."));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Uploads to a fixed path per business (logos/{businessId}/logo.png) — a
// re-upload simply overwrites the old file, so there's nothing to clean up
// and Settings.logoUrl only ever needs to be written once per change.
export async function uploadBusinessLogo(businessId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (PNG or JPG).");
  }
  const { storage } = getFirebase();
  const dataUrl = await resizeToPngDataUrl(file);
  const fileRef = ref(storage, STORAGE_PATH(businessId));
  await uploadString(fileRef, dataUrl, "data_url", { contentType: "image/png" });
  return getDownloadURL(fileRef);
}

export async function removeBusinessLogo(businessId: string): Promise<void> {
  const { storage } = getFirebase();
  const fileRef = ref(storage, STORAGE_PATH(businessId));
  try {
    await deleteObject(fileRef);
  } catch {
    // Already gone (or never uploaded) — fine either way, the caller is
    // about to clear Settings.logoUrl regardless.
  }
}
