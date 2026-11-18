import { z } from "zod";

export const assignableRoleSchema = z.enum(["editor", "viewer"]);
export type AssignableRole = z.infer<typeof assignableRoleSchema>;

export const createInviteSchema = z.object({
  role: assignableRoleSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  expiresInDays: z
    .number()
    .int()
    .min(1, "Minimum expiration is 1 day")
    .max(30, "Maximum expiration is 30 days")
    .default(7),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().trim().min(1, "Invitation token is required"),
});

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const updateMemberRoleSchema = z.object({
  role: assignableRoleSchema,
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const listInvitesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export type ListInvitesQuery = z.infer<typeof listInvitesQuerySchema>;

export const listMembersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;

export const listAuditLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

export interface PublicWorkspaceInvite {
  id: string;
  workspaceId: string;
  role: "editor" | "viewer";
  email: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  createdBy: string;
  createdAt: string; // ISO string
  expiresAt: string; // ISO string
  acceptedBy?: string | null;
  acceptedAt?: string | null;
}

export interface WorkspaceMemberInfo {
  uid: string;
  role: "owner" | "editor" | "viewer";
  status: "active" | "pending" | "suspended";
  joinedAt: string; // ISO string
  invitedBy?: string;
  email?: string;
  displayName?: string;
  isOwner: boolean;
}

export function toDateSafe(val: any, fallback: Date = new Date()): Date {
  if (!val) return fallback;
  if (typeof val?.toDate === "function") {
    try {
      const d = val.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) return d;
    } catch {}
  }
  if (typeof val?._seconds === "number") {
    const d = new Date(val._seconds * 1000);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof val?.seconds === "number") {
    const d = new Date(val.seconds * 1000);
    if (!isNaN(d.getTime())) return d;
  }
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? fallback : d;
}
