import { getAuthHeaders } from "@/features/auth/auth-helpers";
import {
  ClipboardItem,
  inferItemTypeFromMime,
  MAX_FILE_SIZE_BYTES,
  isMimeTypeAllowed,
} from "@/lib/validation/item";

export interface UploadOptions {
  workspaceId: string;
  file: File;
  title?: string;
  tags?: string[];
  calendarDate?: string;
  isPinned?: boolean;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/**
 * Uploads a file directly to Cloudflare R2 via presigned PUT
 * and verifies/finalizes it on the SyncShelf server.
 */
export async function uploadFileToR2({
  workspaceId,
  file,
  title,
  tags = [],
  calendarDate,
  isPinned = false,
  onProgress,
  signal,
}: UploadOptions): Promise<ClipboardItem> {
  // Pre-validation
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed limit of 25 MB.`
    );
  }

  const mimeType = file.type || "application/octet-stream";
  const itemType = inferItemTypeFromMime(mimeType);

  if (!isMimeTypeAllowed(itemType, mimeType)) {
    throw new Error(`File type '${mimeType}' is not supported.`);
  }

  const headers = await getAuthHeaders();

  // Step 1: Sign upload intent
  const signRes = await fetch(`/api/workspaces/${workspaceId}/uploads/sign`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      mimeType,
      type: itemType,
      title: title?.trim() || file.name,
      tags,
      calendarDate,
      isPinned,
    }),
    signal,
  });

  const signData = await signRes.json();
  if (!signRes.ok) {
    throw new Error(signData.error || "Failed to initialize upload.");
  }

  const { uploadUrl, intentToken } = signData;

  // Step 2: Upload directly to Cloudflare R2 using XMLHttpRequest for real progress
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", mimeType);

    if (signal) {
      signal.addEventListener("abort", () => {
        xhr.abort();
        reject(new DOMException("Upload aborted by user", "AbortError"));
      });
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(100);
        resolve();
      } else {
        reject(
          new Error(`R2 upload rejected with status ${xhr.status}: ${xhr.statusText}`)
        );
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error during direct R2 file upload. Check CORS settings."));
    };

    xhr.send(file);
  });

  // Step 3: Finalize upload with server HEAD verification
  const finalizeRes = await fetch(`/api/workspaces/${workspaceId}/uploads/finalize`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intentToken,
    }),
    signal,
  });

  const finalizeData = await finalizeRes.json();
  if (!finalizeRes.ok) {
    throw new Error(finalizeData.error || "Failed to verify and save uploaded file.");
  }

  return finalizeData.item as ClipboardItem;
}

/**
 * Fetches a short-lived presigned GET URL for viewing or downloading a private file.
 */
export async function getFileDownloadUrl(
  workspaceId: string,
  itemId: string,
  download = false
): Promise<{ url: string; originalFileName?: string; mimeType?: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `/api/workspaces/${workspaceId}/items/${itemId}/url${download ? "?download=true" : ""}`,
    {
      headers,
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to generate file access URL.");
  }

  return data;
}
