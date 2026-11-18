/**
 * File Classifier
 * Maps files and blobs to standardized clipboard item types:
 * "image" | "audio" | "video" | "file"
 */

import {
  ClipboardItemType,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_AUDIO_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  ALLOWED_FILE_MIME_TYPES,
} from "@/lib/validation/item";

export interface ClassifiedFile {
  type: "image" | "audio" | "video" | "file";
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  formattedSize: string;
  extension: string;
  categoryLabel: string;
}

const EXTENSION_MAP: Record<string, { type: "image" | "audio" | "video" | "file"; mimeType: string }> = {
  // Images
  png: { type: "image", mimeType: "image/png" },
  jpg: { type: "image", mimeType: "image/jpeg" },
  jpeg: { type: "image", mimeType: "image/jpeg" },
  gif: { type: "image", mimeType: "image/gif" },
  webp: { type: "image", mimeType: "image/webp" },
  svg: { type: "image", mimeType: "image/svg+xml" },

  // Audio
  mp3: { type: "audio", mimeType: "audio/mpeg" },
  wav: { type: "audio", mimeType: "audio/wav" },
  ogg: { type: "audio", mimeType: "audio/ogg" },
  aac: { type: "audio", mimeType: "audio/aac" },
  flac: { type: "audio", mimeType: "audio/flac" },
  m4a: { type: "audio", mimeType: "audio/mp4" },

  // Video
  mp4: { type: "video", mimeType: "video/mp4" },
  webm: { type: "video", mimeType: "video/webm" },
  mov: { type: "video", mimeType: "video/quicktime" },
  mkv: { type: "video", mimeType: "video/x-matroska" },

  // Documents & files
  pdf: { type: "file", mimeType: "application/pdf" },
  txt: { type: "file", mimeType: "text/plain" },
  md: { type: "file", mimeType: "text/markdown" },
  csv: { type: "file", mimeType: "text/csv" },
  json: { type: "file", mimeType: "application/json" },
  zip: { type: "file", mimeType: "application/zip" },
  tar: { type: "file", mimeType: "application/x-tar" },
  gz: { type: "file", mimeType: "application/gzip" },
  doc: { type: "file", mimeType: "application/msword" },
  docx: {
    type: "file",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  xls: { type: "file", mimeType: "application/vnd.ms-excel" },
  xlsx: {
    type: "file",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  ppt: { type: "file", mimeType: "application/vnd.ms-powerpoint" },
  pptx: {
    type: "file",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
};

/**
 * Formats byte size into human readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i] || "MB"}`;
}

/**
 * Extracts clean extension from filename.
 */
export function getExtension(fileName: string): string {
  const parts = fileName.split(".");
  if (parts.length <= 1) return "";
  return parts.pop()?.toLowerCase().trim() || "";
}

/**
 * Classifies a File or File-like object.
 */
export function classifyFile(file: { name: string; type?: string; size?: number }): ClassifiedFile {
  const fileName = file.name || "untitled_file";
  const rawMime = file.type?.split(";")[0].trim().toLowerCase() || "";
  const ext = getExtension(fileName);
  const sizeBytes = typeof file.size === "number" ? file.size : 0;

  // 1. First priority: clean MIME prefix
  if (rawMime.startsWith("image/")) {
    return {
      type: "image",
      mimeType: rawMime,
      fileName,
      sizeBytes,
      formattedSize: formatBytes(sizeBytes),
      extension: ext || "png",
      categoryLabel: "Image",
    };
  }

  if (rawMime.startsWith("audio/")) {
    return {
      type: "audio",
      mimeType: rawMime,
      fileName,
      sizeBytes,
      formattedSize: formatBytes(sizeBytes),
      extension: ext || "mp3",
      categoryLabel: "Audio",
    };
  }

  if (rawMime.startsWith("video/")) {
    return {
      type: "video",
      mimeType: rawMime,
      fileName,
      sizeBytes,
      formattedSize: formatBytes(sizeBytes),
      extension: ext || "mp4",
      categoryLabel: "Video",
    };
  }

  // 2. Second priority: extension lookup
  if (ext && EXTENSION_MAP[ext]) {
    const mapped = EXTENSION_MAP[ext];
    const categoryLabels: Record<string, string> = {
      image: "Image",
      audio: "Audio",
      video: "Video",
      file: "Document",
    };
    return {
      type: mapped.type,
      mimeType: rawMime || mapped.mimeType,
      fileName,
      sizeBytes,
      formattedSize: formatBytes(sizeBytes),
      extension: ext,
      categoryLabel: categoryLabels[mapped.type] || "File",
    };
  }

  // 3. Fallback: generic file
  return {
    type: "file",
    mimeType: rawMime || "application/octet-stream",
    fileName,
    sizeBytes,
    formattedSize: formatBytes(sizeBytes),
    extension: ext,
    categoryLabel: ext ? ext.toUpperCase() : "File",
  };
}
