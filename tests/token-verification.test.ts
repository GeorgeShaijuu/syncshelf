import { describe, it, expect, vi } from "vitest";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import * as adminModule from "@/lib/firebase/admin";

describe("Server-Side ID Token Verification", () => {
  it("returns null when Authorization header is missing or empty", async () => {
    expect(await verifyAuthToken(null)).toBeNull();
    expect(await verifyAuthToken("")).toBeNull();
    expect(await verifyAuthToken(undefined)).toBeNull();
  });

  it("returns null when Authorization header does not start with 'Bearer '", async () => {
    expect(await verifyAuthToken("Basic abcdef123456")).toBeNull();
    expect(await verifyAuthToken("Token abcdef123456")).toBeNull();
    expect(await verifyAuthToken("Bearer")).toBeNull();
    expect(await verifyAuthToken("Bearer   ")).toBeNull();
  });

  it("returns AuthenticatedUser when token is valid", async () => {
    const mockDecodedToken = {
      uid: "user_test_123",
      email: "test@example.com",
      name: "Test User",
      aud: "syncshelf-514903",
      auth_time: 1234567890,
      exp: 1234567890 + 3600,
      iat: 1234567890,
      iss: "https://securetoken.google.com/syncshelf-514903",
      sub: "user_test_123",
      firebase: { identities: {}, sign_in_provider: "password" },
    };

    const mockAdminAuth = {
      verifyIdToken: vi.fn().mockResolvedValue(mockDecodedToken),
    };

    vi.spyOn(adminModule, "getAdminAuth").mockReturnValue(mockAdminAuth as unknown as ReturnType<typeof adminModule.getAdminAuth>);

    const result = await verifyAuthToken("Bearer valid_mock_jwt_token");

    expect(result).not.toBeNull();
    expect(result?.uid).toBe("user_test_123");
    expect(result?.email).toBe("test@example.com");
    expect(result?.displayName).toBe("Test User");
    expect(mockAdminAuth.verifyIdToken).toHaveBeenCalledWith("valid_mock_jwt_token");
  });

  it("returns null when token verification throws (e.g. expired or invalid signature)", async () => {
    const mockAdminAuth = {
      verifyIdToken: vi.fn().mockRejectedValue(new Error("Firebase ID token has expired")),
    };

    vi.spyOn(adminModule, "getAdminAuth").mockReturnValue(mockAdminAuth as unknown as ReturnType<typeof adminModule.getAdminAuth>);

    const result = await verifyAuthToken("Bearer expired_token");
    expect(result).toBeNull();
  });
});
