// Browser-only (uses Image/canvas). Downscales a photo before it's base64-
// encoded and sent anywhere — a modern phone photo can be 4000px+ and
// several MB, which is both slow to upload on a poor connection (exactly
// the situation a solo shop owner is often in) and needlessly expensive in
// image tokens once it reaches the model. 1600px on the long edge is
// comfortably more resolution than a receipt needs to stay legible.

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

export interface ResizedImage {
  base64: string; // no data: prefix
  mediaType: string; // always "image/jpeg" after this step
  dataUrl: string; // for immediately rendering a preview/chat bubble
}

export function resizeImageFile(file: File): Promise<ResizedImage> {
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
        const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        resolve({ base64: dataUrl.split(",")[1] ?? "", mediaType: "image/jpeg", dataUrl });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
