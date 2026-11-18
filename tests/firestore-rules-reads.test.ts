import { describe, it, beforeAll, afterAll } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import fs from "fs";
import path from "path";

const PROJECT_ID = "syncshelf-rules-reads-test";

describe("Cloud Firestore Security Rules — Read & Isolation Enforcement", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const rules = fs.readFileSync(path.resolve(process.cwd(), "firestore.rules"), "utf8");

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: "127.0.0.1",
        port: 8080,
        rules,
      },
    });

    await testEnv.clearFirestore();

    // Seed test data with admin privileges (bypassing security rules)
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const adminDb = adminContext.firestore();

      // Workspace A owned by Alice
      await adminDb.doc("workspaces/ws_alice").set({
        name: "Alice Workspace",
        ownerUid: "alice",
        createdAt: new Date(),
        memberCount: 3,
      });

      // Members of Workspace A
      await adminDb.doc("workspaces/ws_alice/members/alice").set({
        uid: "alice",
        role: "owner",
        status: "active",
      });
      await adminDb.doc("workspaces/ws_alice/members/charlie").set({
        uid: "charlie",
        role: "editor",
        status: "active",
      });
      await adminDb.doc("workspaces/ws_alice/members/dave").set({
        uid: "dave",
        role: "viewer",
        status: "active",
      });

      // Items in Workspace A
      await adminDb.doc("workspaces/ws_alice/items/item_1").set({
        title: "Database Password",
        content: "supersecret",
        createdBy: "alice",
      });

      // User Profiles & Membership Indexes
      await adminDb.doc("users/alice").set({
        email: "alice@example.com",
        displayName: "Alice",
      });
      await adminDb.doc("users/alice/workspaceMemberships/ws_alice").set({
        workspaceId: "ws_alice",
        role: "owner",
      });

      // Workspace B owned by Bob
      await adminDb.doc("workspaces/ws_bob").set({
        name: "Bob Workspace",
        ownerUid: "bob",
        createdAt: new Date(),
        memberCount: 1,
      });
      await adminDb.doc("workspaces/ws_bob/members/bob").set({
        uid: "bob",
        role: "owner",
        status: "active",
      });
      await adminDb.doc("workspaces/ws_bob/items/bob_item").set({
        title: "Bob Confidential",
        content: "classified",
      });
      await adminDb.doc("users/bob").set({
        email: "bob@example.com",
        displayName: "Bob",
      });
      await adminDb.doc("users/bob/workspaceMemberships/ws_bob").set({
        workspaceId: "ws_bob",
        role: "owner",
      });

      // Server-only collections
      await adminDb.doc("invites/invite_1").set({ code: "INVITE123" });
      await adminDb.doc("shares/share_1").set({ token: "SHARETOKEN" });
      await adminDb.doc("auditLogs/log_1").set({ event: "WORKSPACE_CREATED" });
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  describe("1. Anonymous / Unauthenticated Visitors", () => {
    it("denies unauthenticated read to workspaces", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(db.doc("workspaces/ws_alice").get());
    });

    it("denies unauthenticated read to workspace members", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(db.doc("workspaces/ws_alice/members/alice").get());
    });

    it("denies unauthenticated read to workspace items", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(db.doc("workspaces/ws_alice/items/item_1").get());
    });

    it("denies unauthenticated read to user profiles and indexes", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(db.doc("users/alice").get());
      await assertFails(db.doc("users/alice/workspaceMemberships/ws_alice").get());
    });
  });

  describe("2. Workspace Isolation & Non-Member Protection", () => {
    it("denies non-members from reading workspace documents", async () => {
      const db = testEnv.authenticatedContext("bob").firestore();
      await assertFails(db.doc("workspaces/ws_alice").get());
    });

    it("denies non-members from reading member lists", async () => {
      const db = testEnv.authenticatedContext("bob").firestore();
      await assertFails(db.doc("workspaces/ws_alice/members/alice").get());
      await assertFails(db.doc("workspaces/ws_alice/members/charlie").get());
    });

    it("denies non-members from reading workspace items", async () => {
      const db = testEnv.authenticatedContext("bob").firestore();
      await assertFails(db.doc("workspaces/ws_alice/items/item_1").get());
    });

    it("denies listing the root workspaces collection to prevent enumeration", async () => {
      const aliceDb = testEnv.authenticatedContext("alice").firestore();
      const bobDb = testEnv.authenticatedContext("bob").firestore();

      await assertFails(aliceDb.collection("workspaces").get());
      await assertFails(bobDb.collection("workspaces").get());
    });
  });

  describe("3. User Profile & Membership Index Security", () => {
    it("allows a user to read their own profile", async () => {
      const db = testEnv.authenticatedContext("alice").firestore();
      await assertSucceeds(db.doc("users/alice").get());
    });

    it("allows a user to read their own workspace membership indexes", async () => {
      const db = testEnv.authenticatedContext("alice").firestore();
      await assertSucceeds(db.doc("users/alice/workspaceMemberships/ws_alice").get());
      await assertSucceeds(db.collection("users/alice/workspaceMemberships").get());
    });

    it("denies a user from reading another user's profile", async () => {
      const db = testEnv.authenticatedContext("alice").firestore();
      await assertFails(db.doc("users/bob").get());
    });

    it("denies a user from reading another user's workspace membership index", async () => {
      const db = testEnv.authenticatedContext("alice").firestore();
      await assertFails(db.doc("users/bob/workspaceMemberships/ws_bob").get());
      await assertFails(db.collection("users/bob/workspaceMemberships").get());
    });

    it("denies listing the root users collection to prevent user harvesting", async () => {
      const db = testEnv.authenticatedContext("alice").firestore();
      await assertFails(db.collection("users").get());
    });
  });

  describe("4. Authenticated Workspace Member Access", () => {
    it("allows the workspace OWNER to read workspace data, members, and items", async () => {
      const db = testEnv.authenticatedContext("alice").firestore();
      await assertSucceeds(db.doc("workspaces/ws_alice").get());
      await assertSucceeds(db.doc("workspaces/ws_alice/members/alice").get());
      await assertSucceeds(db.doc("workspaces/ws_alice/members/charlie").get());
      await assertSucceeds(db.doc("workspaces/ws_alice/items/item_1").get());
      await assertSucceeds(db.collection("workspaces/ws_alice/items").get());
    });

    it("allows an EDITOR to read workspace data, members, and items", async () => {
      const db = testEnv.authenticatedContext("charlie").firestore();
      await assertSucceeds(db.doc("workspaces/ws_alice").get());
      await assertSucceeds(db.doc("workspaces/ws_alice/members/charlie").get());
      await assertSucceeds(db.doc("workspaces/ws_alice/members/alice").get());
      await assertSucceeds(db.doc("workspaces/ws_alice/items/item_1").get());
      await assertSucceeds(db.collection("workspaces/ws_alice/items").get());
    });

    it("allows a VIEWER to read workspace data, members, and items", async () => {
      const db = testEnv.authenticatedContext("dave").firestore();
      await assertSucceeds(db.doc("workspaces/ws_alice").get());
      await assertSucceeds(db.doc("workspaces/ws_alice/members/dave").get());
      await assertSucceeds(db.doc("workspaces/ws_alice/members/alice").get());
      await assertSucceeds(db.doc("workspaces/ws_alice/items/item_1").get());
      await assertSucceeds(db.collection("workspaces/ws_alice/items").get());
    });
  });

  describe("5. Sensitive & Server-Only Collections (Admin SDK Only)", () => {
    it("denies all client reads to invites", async () => {
      const aliceDb = testEnv.authenticatedContext("alice").firestore();
      const unauthDb = testEnv.unauthenticatedContext().firestore();

      await assertFails(aliceDb.doc("invites/invite_1").get());
      await assertFails(aliceDb.collection("invites").get());
      await assertFails(unauthDb.doc("invites/invite_1").get());
    });

    it("denies all client reads to shares and auditLogs", async () => {
      const aliceDb = testEnv.authenticatedContext("alice").firestore();
      const unauthDb = testEnv.unauthenticatedContext().firestore();

      await assertFails(aliceDb.doc("shares/share_1").get());
      await assertFails(unauthDb.doc("shares/share_1").get());
      await assertFails(aliceDb.doc("auditLogs/log_1").get());
      await assertFails(unauthDb.doc("auditLogs/log_1").get());

      // Milestone 9: denies direct client reads to workspace shares subcollection and publicSharePointers
      await assertFails(aliceDb.doc("workspaces/ws_alice/shares/share_1").get());
      await assertFails(unauthDb.doc("workspaces/ws_alice/shares/share_1").get());
      await assertFails(aliceDb.collection("workspaces/ws_alice/shares").get());
      await assertFails(aliceDb.doc("publicSharePointers/ptr_1").get());
      await assertFails(unauthDb.doc("publicSharePointers/ptr_1").get());
    });
  });
});
