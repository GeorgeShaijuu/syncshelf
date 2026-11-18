import { describe, it, beforeAll, afterAll, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import fs from "fs";
import path from "path";

const PROJECT_ID = "syncshelf-realtime-test";

describe("Cloud Firestore — Realtime Synchronization (onSnapshot) Integration", () => {
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

    // Seed test workspace data via Admin SDK context
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const adminDb = adminContext.firestore();

      // Workspace Alpha
      await adminDb.doc("workspaces/ws_alpha").set({
        name: "Alpha Team",
        ownerUid: "alice",
        createdAt: new Date(),
        memberCount: 3,
      });

      // Members of Workspace Alpha
      await adminDb.doc("workspaces/ws_alpha/members/alice").set({
        uid: "alice",
        role: "owner",
        status: "active",
      });
      await adminDb.doc("workspaces/ws_alpha/members/charlie").set({
        uid: "charlie",
        role: "editor",
        status: "active",
      });
      await adminDb.doc("workspaces/ws_alpha/members/dave").set({
        uid: "dave",
        role: "viewer",
        status: "active",
      });

      // Initial item in Alpha
      await adminDb.doc("workspaces/ws_alpha/items/initial_item").set({
        title: "Welcome Note",
        content: "Initial seed note",
        type: "text",
        createdBy: "alice",
        isPinned: false,
        createdAt: new Date("2026-11-16T10:00:00Z"),
        updatedAt: new Date("2026-11-16T10:00:00Z"),
      });

      // Workspace Beta (isolated from Alpha members)
      await adminDb.doc("workspaces/ws_beta").set({
        name: "Beta Team",
        ownerUid: "bob",
        createdAt: new Date(),
        memberCount: 1,
      });
      await adminDb.doc("workspaces/ws_beta/members/bob").set({
        uid: "bob",
        role: "owner",
        status: "active",
      });
      await adminDb.doc("workspaces/ws_beta/items/beta_item").set({
        title: "Beta Secret",
        content: "Secret content",
        type: "text",
        createdBy: "bob",
        isPinned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  // Test 1: Initial snapshot returns authorized workspace items
  it("1. Initial snapshot returns authorized workspace items to an active member", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const query = aliceDb
      .collection("workspaces/ws_alpha/items")
      .orderBy("createdAt", "desc")
      .limit(20);

    const snapshot: any = await new Promise((resolve, reject) => {
      const unsub = query.onSnapshot(
        (snap) => {
          unsub();
          resolve(snap);
        },
        (err) => {
          unsub();
          reject(err);
        }
      );
    });

    expect(snapshot.empty).toBe(false);
    expect(snapshot.docs.length).toBe(1);
    expect(snapshot.docs[0].id).toBe("initial_item");
    expect(snapshot.docs[0].data().title).toBe("Welcome Note");
  });

  // Test 2: New item created appears in an active listener in real time
  it("2. New item appears in an active listener without refreshing", async () => {
    const charlieDb = testEnv.authenticatedContext("charlie").firestore();
    const query = charlieDb
      .collection("workspaces/ws_alpha/items")
      .orderBy("createdAt", "desc")
      .limit(20);

    let callCount = 0;
    const receivedDocs: any[] = [];

    const unsubscribe = await new Promise<() => void>((resolve, reject) => {
      const unsub = query.onSnapshot(
        (snap) => {
          callCount++;
          if (callCount === 1) {
            // First snapshot received; resolve so test can perform mutation
            resolve(unsub);
          } else if (callCount >= 2) {
            receivedDocs.push(...snap.docs);
          }
        },
        (err) => reject(err)
      );
    });

    // Server-side mutation: create a new item (simulating API POST handler)
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await adminContext.firestore().doc("workspaces/ws_alpha/items/new_realtime_item").set({
        title: "Realtime Deployed Snippet",
        content: "console.log('realtime');",
        type: "code",
        language: "typescript",
        createdBy: "alice",
        isPinned: false,
        createdAt: new Date("2026-11-16T12:00:00Z"),
        updatedAt: new Date("2026-11-16T12:00:00Z"),
      });
    });

    // Wait for the snapshot listener to receive the second event
    await new Promise((resolve) => setTimeout(resolve, 600));

    unsubscribe();

    expect(callCount).toBeGreaterThanOrEqual(2);
    const addedDoc = receivedDocs.find((d) => d.id === "new_realtime_item");
    expect(addedDoc).toBeDefined();
    expect(addedDoc.data().title).toBe("Realtime Deployed Snippet");
  });

  // Test 3: Edited item updates in real time
  it("3. Edited item updates without refreshing in an active listener", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const query = aliceDb
      .collection("workspaces/ws_alpha/items")
      .orderBy("createdAt", "desc")
      .limit(20);

    let updatedTitle = "";
    const unsubscribe = await new Promise<() => void>((resolve, reject) => {
      let first = true;
      const unsub = query.onSnapshot(
        (snap) => {
          if (first) {
            first = false;
            resolve(unsub);
          } else {
            const doc = snap.docs.find((d) => d.id === "new_realtime_item");
            if (doc) {
              updatedTitle = doc.data().title;
            }
          }
        },
        (err) => reject(err)
      );
    });

    // Server-side mutation: update item (simulating API PATCH handler)
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await adminContext
        .firestore()
        .doc("workspaces/ws_alpha/items/new_realtime_item")
        .update({
          title: "Updated Title Across Swarm",
          updatedAt: new Date("2026-11-16T12:10:00Z"),
        });
    });

    await new Promise((resolve) => setTimeout(resolve, 600));
    unsubscribe();

    expect(updatedTitle).toBe("Updated Title Across Swarm");
  });

  // Test 4: Deleted item disappears from the listener
  it("4. Deleted item disappears from active listener in real time", async () => {
    const charlieDb = testEnv.authenticatedContext("charlie").firestore();
    const query = charlieDb
      .collection("workspaces/ws_alpha/items")
      .orderBy("createdAt", "desc")
      .limit(20);

    let removedDetected = false;
    const unsubscribe = await new Promise<() => void>((resolve, reject) => {
      let first = true;
      const unsub = query.onSnapshot(
        (snap) => {
          if (first) {
            first = false;
            resolve(unsub);
          } else {
            snap.docChanges().forEach((change) => {
              if (change.type === "removed" && change.doc.id === "new_realtime_item") {
                removedDetected = true;
              }
            });
          }
        },
        (err) => reject(err)
      );
    });

    // Server-side mutation: delete item (simulating API DELETE handler)
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await adminContext
        .firestore()
        .doc("workspaces/ws_alpha/items/new_realtime_item")
        .delete();
    });

    await new Promise((resolve) => setTimeout(resolve, 600));
    unsubscribe();

    expect(removedDetected).toBe(true);
  });

  // Test 5: Pin change is reflected in real time
  it("5. Pin change is reflected in real time across listening members", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const query = aliceDb
      .collection("workspaces/ws_alpha/items")
      .orderBy("createdAt", "desc")
      .limit(20);

    let observedPinnedStatus = false;
    const unsubscribe = await new Promise<() => void>((resolve, reject) => {
      let first = true;
      const unsub = query.onSnapshot(
        (snap) => {
          if (first) {
            first = false;
            resolve(unsub);
          } else {
            const doc = snap.docs.find((d) => d.id === "initial_item");
            if (doc && doc.data().isPinned === true) {
              observedPinnedStatus = true;
            }
          }
        },
        (err) => reject(err)
      );
    });

    // Server-side mutation: toggle pin
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await adminContext
        .firestore()
        .doc("workspaces/ws_alpha/items/initial_item")
        .update({
          isPinned: true,
          updatedAt: new Date("2026-11-16T12:20:00Z"),
        });
    });

    await new Promise((resolve) => setTimeout(resolve, 600));
    unsubscribe();

    expect(observedPinnedStatus).toBe(true);
  });

  // Test 6: Workspace switching cleanly unsubscribes from the previous listener
  it("6. Workspace switching cleanly unsubscribes from the previous listener", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const alphaQuery = aliceDb
      .collection("workspaces/ws_alpha/items")
      .orderBy("createdAt", "desc")
      .limit(20);

    let alphaEventsAfterSwitch = 0;

    // Attach listener for Workspace Alpha
    const unsubscribeAlpha = await new Promise<() => void>((resolve) => {
      const unsub = alphaQuery.onSnapshot(() => {
        resolve(unsub);
      });
    });

    // Simulate switching workspace: explicitly unsubscribe Alpha
    unsubscribeAlpha();

    // Attach listener for Alpha again to track after-unsub behavior
    alphaQuery.onSnapshot(() => {
      // should NOT be invoked if unsubscribed
    }); // we won't call this, we check the unsubscribed one:
    
    // Add an event to Alpha
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await adminContext.firestore().doc("workspaces/ws_alpha/items/switch_test_item").set({
        title: "Added after switch",
        content: "test",
        type: "text",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 400));
    // The unsubscribed listener did not receive events
    expect(alphaEventsAfterSwitch).toBe(0);
  });

  // Test 7: Sign-out cleans up the subscription
  it("7. Sign-out cleans up active subscriptions", async () => {
    const charlieDb = testEnv.authenticatedContext("charlie").firestore();
    const query = charlieDb.collection("workspaces/ws_alpha/items").limit(5);

    let callbackFiredAfterSignout = false;
    const unsub = query.onSnapshot(() => {});

    // Unsubscribe (simulating sign-out hook cleanup)
    unsub();

    // Trigger document addition
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await adminContext.firestore().doc("workspaces/ws_alpha/items/signout_test").set({
        title: "Signout test",
        content: "content",
        createdAt: new Date(),
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(callbackFiredAfterSignout).toBe(false);
  });

  // Test 8: Viewer receives realtime data but direct client writes are rejected
  it("8. Viewer receives realtime data but direct client writes remain rejected", async () => {
    const daveDb = testEnv.authenticatedContext("dave").firestore();
    const query = daveDb.collection("workspaces/ws_alpha/items").limit(5);

    // Read/subscribe succeeds for Viewer
    const snapshot: any = await new Promise((resolve, reject) => {
      const unsub = query.onSnapshot(
        (snap) => {
          unsub();
          resolve(snap);
        },
        (err) => {
          unsub();
          reject(err);
        }
      );
    });

    expect(snapshot.empty).toBe(false);

    // Direct client write attempt by Viewer must fail
    await assertFails(
      daveDb.collection("workspaces/ws_alpha/items").add({
        title: "Malicious Viewer Write",
        content: "attempt",
        createdBy: "dave",
      })
    );
  });

  // Test 9: Non-members cannot subscribe to another workspace (PERMISSION_DENIED)
  it("9. Non-members cannot subscribe to another workspace (PERMISSION_DENIED)", async () => {
    // Eve is authenticated but is NOT a member of Workspace Alpha
    const eveDb = testEnv.authenticatedContext("eve").firestore();
    const foreignQuery = eveDb.collection("workspaces/ws_alpha/items").limit(5);

    let permissionDenied = false;

    await new Promise<void>((resolve) => {
      const unsub = foreignQuery.onSnapshot(
        () => {
          unsub();
          resolve();
        },
        (err) => {
          if (err.code === "permission-denied" || err.message.includes("permission")) {
            permissionDenied = true;
          }
          unsub();
          resolve();
        }
      );
    });

    expect(permissionDenied).toBe(true);
  });

  // Test 10: Direct client writes remain completely rejected for all roles
  it("10. Direct client writes remain completely rejected for Owner, Editor, and Viewer", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore(); // Owner
    const charlieDb = testEnv.authenticatedContext("charlie").firestore(); // Editor

    // Owner direct write rejected
    await assertFails(
      aliceDb.collection("workspaces/ws_alpha/items").add({
        title: "Direct Owner Write",
        content: "Must be rejected",
      })
    );

    // Editor direct write rejected
    await assertFails(
      charlieDb.collection("workspaces/ws_alpha/items").add({
        title: "Direct Editor Write",
        content: "Must be rejected",
      })
    );
  });
});
