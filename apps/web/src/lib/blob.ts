import { put } from "@vercel/blob";

/**
 * Upload a stream (or buffer) to Vercel Blob.
 * Returns the public URL — store this as the slip/media asset reference.
 */
type BlobBody = Parameters<typeof put>[1];

export async function uploadBlob(args: {
  pathname: string;
  body: BlobBody;
  contentType?: string;
}): Promise<{ url: string; pathname: string }> {
  const blob = await put(args.pathname, args.body, {
    access: "public",
    contentType: args.contentType,
    addRandomSuffix: false,
  });
  return { url: blob.url, pathname: blob.pathname };
}

export function yearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
