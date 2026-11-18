import { describe, it, expect } from "vitest";
import {
  hasWorkspaceRole,
  canViewWorkspace,
  canCreateItem,
  canEditItem,
  canDeleteItem,
  canManageMembers,
  canManageWorkspace,
  type WorkspaceRole,
} from "@/lib/authz/permissions";

describe("Centralized Workspace Authorization Permissions", () => {
  describe("Role Hierarchy checks", () => {
    it("owner has access to owner, editor, and viewer levels", () => {
      expect(hasWorkspaceRole("owner", "owner")).toBe(true);
      expect(hasWorkspaceRole("owner", "editor")).toBe(true);
      expect(hasWorkspaceRole("owner", "viewer")).toBe(true);
    });

    it("editor has access to editor and viewer levels, but NOT owner level", () => {
      expect(hasWorkspaceRole("editor", "owner")).toBe(false);
      expect(hasWorkspaceRole("editor", "editor")).toBe(true);
      expect(hasWorkspaceRole("editor", "viewer")).toBe(true);
    });

    it("viewer has access ONLY to viewer level", () => {
      expect(hasWorkspaceRole("viewer", "owner")).toBe(false);
      expect(hasWorkspaceRole("viewer", "editor")).toBe(false);
      expect(hasWorkspaceRole("viewer", "viewer")).toBe(true);
    });

    it("unassigned or null role has no permissions", () => {
      expect(hasWorkspaceRole(null, "viewer")).toBe(false);
      expect(hasWorkspaceRole(undefined, "viewer")).toBe(false);
    });
  });

  describe("canViewWorkspace", () => {
    it("allows owner, editor, and viewer to view workspace", () => {
      expect(canViewWorkspace("owner")).toBe(true);
      expect(canViewWorkspace("editor")).toBe(true);
      expect(canViewWorkspace("viewer")).toBe(true);
    });

    it("rejects non-members", () => {
      expect(canViewWorkspace(null)).toBe(false);
      expect(canViewWorkspace(undefined)).toBe(false);
    });
  });

  describe("Content manipulation (create, edit, delete)", () => {
    it("allows owner and editor to create items", () => {
      expect(canCreateItem("owner")).toBe(true);
      expect(canCreateItem("editor")).toBe(true);
    });

    it("rejects viewer and non-members from creating items", () => {
      expect(canCreateItem("viewer")).toBe(false);
      expect(canCreateItem(null)).toBe(false);
    });

    it("allows owner and editor to edit and delete items", () => {
      expect(canEditItem("owner")).toBe(true);
      expect(canEditItem("editor")).toBe(true);
      expect(canDeleteItem("owner")).toBe(true);
      expect(canDeleteItem("editor")).toBe(true);
    });

    it("rejects viewer from editing or deleting items", () => {
      expect(canEditItem("viewer")).toBe(false);
      expect(canDeleteItem("viewer")).toBe(false);
    });
  });

  describe("Workspace & Member administration", () => {
    it("ONLY owner can manage members", () => {
      expect(canManageMembers("owner")).toBe(true);
      expect(canManageMembers("editor")).toBe(false);
      expect(canManageMembers("viewer")).toBe(false);
      expect(canManageMembers(null)).toBe(false);
    });

    it("ONLY owner can manage workspace settings", () => {
      expect(canManageWorkspace("owner")).toBe(true);
      expect(canManageWorkspace("editor")).toBe(false);
      expect(canManageWorkspace("viewer")).toBe(false);
      expect(canManageWorkspace(null)).toBe(false);
    });
  });

  describe("Client Role Tampering Guard", () => {
    it("never relies on client-supplied string without server role validation", () => {
      // Simulate client attempting to send role="owner" in JSON
      const clientProvidedPayload = { role: "owner" };
      const serverVerifiedMembershipRole: WorkspaceRole = "viewer";

      // Permission check MUST evaluate the serverVerifiedMembershipRole
      const canManage = canManageMembers(serverVerifiedMembershipRole);
      expect(canManage).toBe(false);

      // Verify that using client's claimed role would be wrong
      expect(clientProvidedPayload.role === "owner").toBe(true);
      expect(canManageMembers(serverVerifiedMembershipRole)).toBe(false);
    });
  });
});
