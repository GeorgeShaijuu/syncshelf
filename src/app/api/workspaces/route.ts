import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { createWorkspaceSchema } from "@/lib/validation/workspace";
import { hasFirebaseAdminConfig } from "@/lib/env";

/**
 * POST /api/workspaces
 * Creates a user's single owned workspace using deterministic ID `workspaces/{ownerUid}`.
 * Strictly enforces that one Firebase UID can own exactly ONE workspace.
 * Executes atomically in a Firestore transaction.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = await verifyAuthToken(authHeader);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing authentication token" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = createWorkspaceSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    if (!hasFirebaseAdminConfig()) {
      return NextResponse.json(
        {
          error: "Firebase Admin credentials not configured.",
          details:
            "The server requires FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY environment variables to connect to Firestore. Please configure them in your Vercel Project Settings.",
        },
        { status: 500 }
      );
    }

    const { name } = parseResult.data;
    const adminDb = getAdminDb();
    const ownerUid = user.uid;
    const deterministicWorkspaceId = ownerUid;

    const workspaceRef = adminDb.collection("workspaces").doc(deterministicWorkspaceId);
    const memberRef = workspaceRef.collection("members").doc(ownerUid);
    const userMembershipRef = adminDb
      .collection("users")
      .doc(ownerUid)
      .collection("workspaceMemberships")
      .doc(deterministicWorkspaceId);

    // Atomic transaction enforcing the single owned workspace constraint
    const result = await adminDb.runTransaction(async (transaction) => {
      const existingWorkspace = await transaction.get(workspaceRef);
      if (existingWorkspace.exists) {
        return {
          conflict: true,
          message: "You already own a workspace. Each account can own exactly one workspace.",
        };
      }

      const existingMembership = await transaction.get(userMembershipRef);
      if (existingMembership.exists && existingMembership.data()?.role === "owner") {
        return {
          conflict: true,
          message: "An owned workspace record already exists for this account.",
        };
      }

      const now = FieldValue.serverTimestamp();

      const workspaceData = {
        name,
        ownerUid,
        createdAt: now,
        updatedAt: now,
        memberCount: 1,
        settings: {
          allowWorkspaceShareLinks: false,
          defaultMemberRole: "viewer",
        },
      };

      const memberData = {
        uid: ownerUid,
        role: "owner",
        status: "active",
        joinedAt: now,
        invitedBy: ownerUid,
      };

      const userMembershipData = {
        workspaceId: deterministicWorkspaceId,
        workspaceName: name,
        role: "owner",
        ownerUid,
        joinedAt: now,
      };

      transaction.set(workspaceRef, workspaceData);
      transaction.set(memberRef, memberData);
      transaction.set(userMembershipRef, userMembershipData);

      return {
        conflict: false,
        workspace: {
          id: deterministicWorkspaceId,
          name,
          ownerUid,
          role: "owner",
          memberCount: 1,
        },
      };
    });

    if (result.conflict) {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }

    return NextResponse.json(result.workspace, { status: 201 });
  } catch (error) {
    console.error("[SyncShelf API] Error creating workspace:", error);
    const details =
      error instanceof Error ? error.message : "Internal server error occurred while creating workspace.";
    return NextResponse.json(
      {
        error: "Internal server error occurred while creating workspace.",
        details,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/workspaces
 * Lists all workspaces the authenticated user is an active member of.
 * Uses the lightweight index `users/{uid}/workspaceMemberships` and resolves canonical records.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = await verifyAuthToken(authHeader);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing authentication token" },
        { status: 401 }
      );
    }

    if (!hasFirebaseAdminConfig()) {
      return NextResponse.json(
        {
          error: "Firebase Admin credentials not configured.",
          details:
            "The server requires FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY environment variables to connect to Firestore. Please configure them in your Vercel Project Settings.",
        },
        { status: 500 }
      );
    }

    const adminDb = getAdminDb();
    const uid = user.uid;

    // Fetch the user's membership index
    const membershipsSnapshot = await adminDb
      .collection("users")
      .doc(uid)
      .collection("workspaceMemberships")
      .get();

    if (membershipsSnapshot.empty) {
      return NextResponse.json({ workspaces: [] }, { status: 200 });
    }

    // Resolve referenced workspaces and verify membership concurrently via Promise.all
    const workspacePromises = membershipsSnapshot.docs.map(async (membershipDoc) => {
      const membershipData = membershipDoc.data();
      const workspaceId = membershipData.workspaceId || membershipDoc.id;

      try {
        const [workspaceDoc, memberDoc] = await Promise.all([
          adminDb.collection("workspaces").doc(workspaceId).get(),
          adminDb
            .collection("workspaces")
            .doc(workspaceId)
            .collection("members")
            .doc(uid)
            .get(),
        ]);

        if (!workspaceDoc.exists) {
          // Stale index reference, skip
          return null;
        }

        if (!memberDoc.exists || memberDoc.data()?.status !== "active") {
          // Inactive or revoked membership, skip
          return null;
        }

        const workspaceData = workspaceDoc.data();
        const role = memberDoc.data()?.role || membershipData.role;

        return {
          id: workspaceDoc.id,
          name: workspaceData?.name || membershipData.workspaceName,
          ownerUid: workspaceData?.ownerUid || membershipData.ownerUid,
          role,
          memberCount: workspaceData?.memberCount || 1,
          isOwner: role === "owner",
          createdAt: workspaceData?.createdAt?.toDate?.()?.toISOString() || null,
        };
      } catch (docErr) {
        console.warn(`[SyncShelf API] Failed resolving workspace ${workspaceId}:`, docErr);
        return null;
      }
    });

    const resolvedWorkspaces = await Promise.all(workspacePromises);
    const workspaces = resolvedWorkspaces.filter(Boolean);

    return NextResponse.json({ workspaces }, { status: 200 });
  } catch (error) {
    console.error("[SyncShelf API] Error listing workspaces:", error);
    const details =
      error instanceof Error ? error.message : "Internal server error occurred while retrieving workspaces.";
    return NextResponse.json(
      {
        error: "Internal server error occurred while retrieving workspaces.",
        details,
      },
      { status: 500 }
    );
  }
}
