import { z } from "zod";

export const clipboardItemTypeSchema = z.enum([
  "text",
  "code",
  "link",
  "image",
  "audio",
  "video",
  "file",
]);
export type ClipboardItemType = z.infer<typeof clipboardItemTypeSchema>;

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
] as const;

export const ALLOWED_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "audio/aac",
  "audio/flac",
] as const;

export const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
  "video/x-matroska",
] as const;

export const ALLOWED_FILE_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

export const ALL_ALLOWED_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_AUDIO_MIME_TYPES,
  ...ALLOWED_VIDEO_MIME_TYPES,
  ...ALLOWED_FILE_MIME_TYPES,
] as const;

/**
 * Checks whether the given MIME type is permitted for the given item type.
 */
export function isMimeTypeAllowed(
  type: "image" | "audio" | "video" | "file",
  mimeType: string
): boolean {
  const normalized = mimeType.split(";")[0].trim().toLowerCase();
  switch (type) {
    case "image":
      return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(normalized);
    case "audio":
      return (ALLOWED_AUDIO_MIME_TYPES as readonly string[]).includes(normalized);
    case "video":
      return (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(normalized);
    case "file":
      return (
        (ALL_ALLOWED_MIME_TYPES as readonly string[]).includes(normalized) ||
        normalized.startsWith("text/") ||
        normalized === "application/octet-stream"
      );
    default:
      return false;
  }
}

/**
 * Infers clipboard item type from MIME type.
 */
export function inferItemTypeFromMime(
  mimeType: string
): "image" | "audio" | "video" | "file" {
  const normalized = mimeType.split(";")[0].trim().toLowerCase();
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("audio/")) return "audio";
  if (normalized.startsWith("video/")) return "video";
  return "file";
}

export const createItemSchema = z.object({
  type: clipboardItemTypeSchema,
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(100, "Title cannot exceed 100 characters"),
  content: z
    .string()
    .min(1, "Content cannot be empty")
    .max(50000, "Content cannot exceed 50,000 characters"),
  language: z.string().trim().max(30).optional(),
  calendarDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid calendar date format (YYYY-MM-DD)")
    .optional(),
  tags: z
    .array(z.string().trim().min(1).max(30))
    .max(10, "Maximum of 10 tags allowed")
    .optional()
    .default([]),
  isPinned: z.boolean().optional().default(false),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;

export const updateItemSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty")
      .max(100, "Title cannot exceed 100 characters")
      .optional(),
    content: z
      .string()
      .min(1, "Content cannot be empty")
      .max(50000, "Content cannot exceed 50,000 characters")
      .optional(),
    type: clipboardItemTypeSchema.optional(),
    language: z.string().trim().max(30).nullable().optional(),
    calendarDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid calendar date format (YYYY-MM-DD)")
      .nullable()
      .optional(),
    tags: z
      .array(z.string().trim().min(1).max(30))
      .max(10, "Maximum of 10 tags allowed")
      .optional(),
    isPinned: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
  });

export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export const listItemsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
  type: clipboardItemTypeSchema.optional(),
  pinned: z.enum(["true", "false"]).optional(),
  search: z.string().trim().optional(),
});

export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;

/**
 * Upload signing request schema
 */
export const signUploadSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, "File name is required")
    .max(255, "File name cannot exceed 255 characters"),
  fileSize: z
    .number()
    .int("File size must be an integer")
    .positive("File size must be positive")
    .max(
      MAX_FILE_SIZE_BYTES,
      `File size exceeds maximum allowed limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`
    ),
  mimeType: z
    .string()
    .trim()
    .min(1, "MIME type is required"),
  type: z.enum(["image", "audio", "video", "file"]),
  title: z
    .string()
    .trim()
    .max(100, "Title cannot exceed 100 characters")
    .optional(),
  tags: z
    .array(z.string().trim().min(1).max(30))
    .max(10, "Maximum of 10 tags allowed")
    .optional()
    .default([]),
  calendarDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid calendar date format (YYYY-MM-DD)")
    .optional(),
  isPinned: z.boolean().optional().default(false),
});

export type SignUploadInput = z.infer<typeof signUploadSchema>;

/**
 * Upload finalize request schema
 */
export const finalizeUploadSchema = z.object({
  intentToken: z.string().min(1, "Upload intent token is required"),
});

export type FinalizeUploadInput = z.infer<typeof finalizeUploadSchema>;

export interface ClipboardItem {
  id: string;
  workspaceId: string;
  type: ClipboardItemType;
  title: string;
  content: string;
  language?: string;
  calendarDate?: string;
  originalFileName?: string;
  fileName?: string;
  objectKey?: string;
  mimeType?: string;
  sizeBytes?: number;
  fileSizeBytes?: number;
  url?: string;
  presignedUrl?: string;
  createdBy: string;
  createdByUid?: string;
  createdByDisplayName?: string;
  createdByAvatarUrl?: string;
  updatedByUid?: string;
  updatedByDisplayName?: string;
  updatedByAvatarUrl?: string;
  createdAt: string; // ISO string when returned over API
  updatedAt: string;
  isPinned: boolean;
  tags: string[];
  contentLength: number;
}

/**
 * Formats a Date object or ISO string into a local YYYY-MM-DD string.
 * Guarantees local day boundaries without UTC shifting.
 */
export function formatLocalDateString(dateInput: Date | string | number): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns an item's calendar date, falling back to its createdAt date.
 */
export function getItemCalendarDate(item: { calendarDate?: string; createdAt?: string }): string {
  if (item.calendarDate && /^\d{4}-\d{2}-\d{2}$/.test(item.calendarDate)) {
    return item.calendarDate;
  }
  return formatLocalDateString(item.createdAt || new Date());
}
