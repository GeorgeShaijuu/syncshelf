import { getAdminDb } from "@/lib/firebase/admin";
import { parseShareToken, verifyShareSecret } from "@/lib/shares/share-crypto";
import {
  toDateSafe,
  ShareScope,
  ShareAccessMode,
  SharePermission,
  StoredShareDocument,
} from "@/lib/validation/share";
import { getOrSetCache } from "@/lib/redis/client";
import { getWorkspaceMemberRole } from "@/lib/authz/permissions";

export interface VerifyShareAccessOptions {
  token: string;
  reqUserUid?: string | null;
  reqUserEmail?: string | null;
  requiredPermission?: SharePermission;
}

export interface VerifyShareSuccess {
  authorized: true;
  workspaceId: string;
  shareId: string;
  shareData: StoredShareDocument;
  workspaceData: Record<string, any>;
  shareRef: any;
  effectivePermission: SharePermission;
  isWorkspaceMember: boolean;
  memberRole: string | null;
}

export interface VerifyShareFailure {
  authorized: false;
  status: number;
  error: string;
  requiresAuth?: boolean;
}

export type VerifyShareResult = VerifyShareSuccess | VerifyShareFailure;

/**
 * Centrally validates a share bearer token, audience access mode, and effective permissions.
 * Enforces workspace membership precedence, token verification, expiration, and revocation.
 */
export async function verifyShareAccess({
  token,
  reqUserUid = null,
  reqUserEmail = null,
  requiredPermission = "viewer",
}: VerifyShareAccessOptions): Promise<VerifyShareResult> {
  const parsed = parseShareToken(token);
  if (!parsed) {
    return {
      authorized: false,
      status: 404,
      error: "Share link not found or invalid format",
    };
  }

  const { shareId, tokenSecret } = parsed;
  const adminDb = getAdminDb();

  // 1. Resolve workspaceId via fast pointer (cached in Redis when available)
  let workspaceId: string | null = await getOrSetCache<string | null>(
    `share_ptr:${shareId}`,
    60,
    async () => {
      const pointerSnap = await adminDb.collection("publicSharePointers").doc(shareId).get();
      return pointerSnap.exists ? pointerSnap.data()?.workspaceId || null : null;
    }
  );

  let shareData: StoredShareDocument | null = null;
  let shareRef: any = null;

  if (workspaceId) {
    shareRef = adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("shares")
      .doc(shareId);
    const snap = await shareRef.get();
    if (snap.exists) {
      shareData = snap.data() as StoredShareDocument;
    }
  }

  // Fallback: collectionGroup query if pointer was missing
  if (!shareData) {
    const groupSnap = await adminDb
      .collectionGroup("shares")
      .where("shareId", "==", shareId)
      .limit(1)
      .get();

    if (!groupSnap.empty) {
      const doc = groupSnap.docs[0];
      shareData = doc.data() as StoredShareDocument;
      shareRef = doc.ref;
      workspaceId = shareData.workspaceId;
    }
  }

  if (!shareData || !workspaceId) {
    return {
      authorized: false,
      status: 404,
      error: "Share link not found",
    };
  }

  // 2. Timing-safe cryptographic comparison against stored SHA-256 hash
  const isValidSecret = verifyShareSecret(tokenSecret, shareData.tokenHash);
  if (!isValidSecret) {
    return {
      authorized: false,
      status: 404,
      error: "Share link not found",
    };
  }

  // 3. Check revocation status
  if (shareData.status === "revoked") {
    return {
      authorized: false,
      status: 410,
      error: "This share link has been revoked by the workspace owner",
    };
  }

  // 4. Check expiration
  if (shareData.expiresAt) {
    const expiresAtDate = toDateSafe(shareData.expiresAt);
    if (expiresAtDate < new Date()) {
      return {
        authorized: false,
        status: 410,
        error: "This share link has expired",
      };
    }
  }

  // 5. Verify workspace exists
  const wsDoc = await adminDb.collection("workspaces").doc(workspaceId).get();
  if (!wsDoc.exists) {
    return {
      authorized: false,
      status: 404,
      error: "The associated workspace is no longer available",
    };
  }
  const workspaceData = wsDoc.data()!;

  // 6. Check existing workspace membership role if authenticated
  let memberRole: string | null = null;
  if (reqUserUid) {
    memberRole = await getWorkspaceMemberRole(adminDb, workspaceId, reqUserUid);
  }

  // 7. Calculate base permission according to accessMode
  const accessMode: ShareAccessMode = shareData.accessMode || "public";
  const defaultPermission: SharePermission = shareData.defaultPermission || "viewer";
  let effectivePermission: SharePermission = "viewer";

  if (accessMode === "public") {
    // Anyone with link can view.
    // If allowPublicEditing is true and user is authenticated, they can edit.
    if (reqUserUid && shareData.allowPublicEditing) {
      effectivePermission = "editor";
    } else {
      effectivePermission = "viewer";
    }
  } else if (accessMode === "authenticated") {
    if (!reqUserUid) {
      return {
        authorized: false,
        status: 401,
        requiresAuth: true,
        error: "Sign in required to access this shared link",
      };
    }
    effectivePermission = defaultPermission;
  } else if (accessMode === "specific_people") {
    if (!reqUserUid) {
      return {
        authorized: false,
        status: 401,
        requiresAuth: true,
        error: "Sign in required to access this shared link",
      };
    }

    const normalizedReqEmail = (reqUserEmail || "").toLowerCase().trim();
    const recipient = (shareData.invitedRecipients || []).find(
      (r) => r.email.toLowerCase().trim() === normalizedReqEmail
    );

    if (!recipient) {
      // Even if user is not on the invited list, check if they are the workspace owner
      if (memberRole === "owner") {
        effectivePermission = "editor";
      } else {
        return {
          authorized: false,
          status: 403,
          error: "You do not have permission to access this shared link",
        };
      }
    } else {
      effectivePermission = recipient.permission;
    }
  }

  // 8. Enforce Workspace Membership Precedence
  // Workspace membership permissions remain authoritative:
  // - An Owner or Editor of the workspace retains at least "editor" rights.
  // - A workspace Viewer cannot be elevated into an Editor by a share link.
  if (memberRole === "owner" || memberRole === "editor") {
    effectivePermission = "editor";
  } else if (memberRole === "viewer") {
    effectivePermission = "viewer";
  }

  // 9. Check requiredPermission
  if (requiredPermission === "editor" && effectivePermission !== "editor") {
    return {
      authorized: false,
      status: 403,
      error: "Write permission required for this action",
    };
  }

  return {
    authorized: true,
    workspaceId,
    shareId,
    shareData,
    workspaceData,
    shareRef,
    effectivePermission,
    isWorkspaceMember: !!memberRole,
    memberRole,
  };
}
