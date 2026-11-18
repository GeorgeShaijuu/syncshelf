import { z } from "zod";

export type ShareScope = "item" | "selected_items" | "board" | "calendar" | "workspace";
export type ShareStatus = "active" | "revoked" | "expired";
export type ShareAccessMode = "public" | "authenticated" | "specific_people";
export type SharePermission = "viewer" | "editor";
export type ShareExpiryOption = "1h" | "24h" | "7d" | "30d" | "never";

export interface ShareRecipient {
  email: string;
  permission: SharePermission;
  addedAt: string;
}

export const shareRecipientSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  permission: z.enum(["viewer", "editor"]).default("viewer"),
});

export const createShareSchema = z
  .object({
    scope: z
      .enum(["item", "selected_items", "board", "calendar", "workspace"])
      .optional(),
    itemIds: z
      .array(z.string().min(1, "Item ID cannot be empty"))
      .max(25, "Cannot share more than 25 items in a single link")
      .optional(),
    accessMode: z
      .enum(["public", "authenticated", "specific_people"])
      .default("public"),
    defaultPermission: z.enum(["viewer", "editor"]).default("viewer"),
    allowPublicEditing: z.boolean().default(false),
    invitedRecipients: z.array(shareRecipientSchema).optional(),
    expiry: z
      .enum(["1h", "24h", "7d", "30d", "never"])
      .default("7d"),
    title: z.string().trim().max(100, "Title cannot exceed 100 characters").optional(),
  })
  .superRefine((data, ctx) => {
    // When sharing selected items or when scope is omitted and itemIds is expected
    if (data.scope === "item" || data.scope === "selected_items" || (!data.scope && data.itemIds)) {
      if (!data.itemIds || data.itemIds.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one item must be selected to create a share",
          path: ["itemIds"],
        });
      } else if (new Set(data.itemIds).size !== data.itemIds.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate item IDs are not allowed in share selection",
          path: ["itemIds"],
        });
      }
    } else if (!data.scope && !data.itemIds) {
      // Default legacy share requires itemIds
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one item must be selected to create a share",
        path: ["itemIds"],
      });
    }

    // When sharing with specific people, at least one recipient is required
    if (data.accessMode === "specific_people") {
      if (!data.invitedRecipients || data.invitedRecipients.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one recipient email is required for specific people access",
          path: ["invitedRecipients"],
        });
      }
    }
  });

export type CreateShareInput = z.infer<typeof createShareSchema>;

export const updateShareSchema = z.object({
  defaultPermission: z.enum(["viewer", "editor"]).optional(),
  allowPublicEditing: z.boolean().optional(),
  invitedRecipients: z.array(shareRecipientSchema).optional(),
  expiry: z.enum(["1h", "24h", "7d", "30d", "never"]).optional(),
  title: z.string().trim().max(100).optional(),
});

export type UpdateShareInput = z.infer<typeof updateShareSchema>;

/**
 * Calculates expiration timestamp based on selected expiry duration.
 * Returns null if expiry is "never".
 */
export function calculateExpiration(
  expiry: ShareExpiryOption,
  fromDate: Date = new Date()
): Date | null {
  const baseTime = fromDate.getTime();

  switch (expiry) {
    case "1h":
      return new Date(baseTime + 1 * 60 * 60 * 1000);
    case "24h":
      return new Date(baseTime + 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(baseTime + 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(baseTime + 30 * 24 * 60 * 60 * 1000);
    case "never":
      return null;
    default:
      return new Date(baseTime + 7 * 24 * 60 * 60 * 1000);
  }
}

/**
 * Sanitized public share item for viewers and editors.
 * Excludes internal workspace identifiers and author user IDs for privacy.
 */
export interface PublicClipboardItem {
  id: string;
  type: "text" | "code" | "link" | "image" | "audio" | "video" | "file";
  title: string;
  content: string;
  language?: string;
  url?: string;
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  presignedUrl?: string;
  isPinned?: boolean;
  calendarDate?: string | null;
  createdByDisplayName?: string;
  createdByAvatarUrl?: string;
  updatedByDisplayName?: string;
  updatedByAvatarUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Sanitized public share metadata.
 * Contains workspace name, scope, accessMode, and effective permissions.
 */
export interface PublicShareMetadata {
  id: string;
  scope: ShareScope;
  status: ShareStatus;
  accessMode: ShareAccessMode;
  defaultPermission: SharePermission;
  allowPublicEditing: boolean;
  effectivePermission: SharePermission;
  workspaceName: string;
  workspaceOwnerName?: string;
  workspaceOwnerAvatarUrl?: string;
  itemCount: number;
  title?: string;
  createdAt: string;
  expiresAt: string | null;
}

/**
 * Stored representation of a share document in `workspaces/{workspaceId}/shares/{shareId}`.
 */
export interface StoredShareDocument {
  shareId: string;
  workspaceId: string;
  tokenHash: string;
  scope: ShareScope;
  itemIds?: string[];
  accessMode?: ShareAccessMode;
  defaultPermission?: SharePermission;
  allowPublicEditing?: boolean;
  invitedRecipients?: Array<{
    email: string;
    permission: SharePermission;
    addedAt: string;
  }>;
  status: ShareStatus;
  createdBy: string;
  createdAt: any; // Firestore Timestamp
  expiresAt: any | null; // Firestore Timestamp or null
  revokedAt?: any | null;
  revokedBy?: string | null;
  viewCount?: number;
  title?: string;
}

/**
 * Stored representation of an item in `workspaces/{workspaceId}/items/{itemId}`.
 */
export interface StoredItemDocument {
  id: string;
  workspaceId: string;
  type: "text" | "code" | "link" | "image" | "audio" | "video" | "file";
  title: string;
  content: string;
  language?: string;
  url?: string;
  r2ObjectKey?: string;
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  isPinned?: boolean;
  calendarDate?: string | null;
  createdByUid?: string;
  createdByDisplayName?: string;
  createdByAvatarUrl?: string;
  updatedByUid?: string;
  updatedByDisplayName?: string;
  updatedByAvatarUrl?: string;
  createdAt: any;
  updatedAt?: any;
}

/**
 * Converts a Firestore timestamp or date object to a JavaScript Date.
 */
export function toDateSafe(val: any): Date {
  if (!val) return new Date();
  if (typeof val.toDate === "function") return val.toDate();
  if (typeof val?._seconds === "number") return new Date(val._seconds * 1000);
  if (typeof val?.seconds === "number") return new Date(val.seconds * 1000);
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") return new Date(val);
  return new Date();
}
