import { describe, it, expect } from "vitest";
import {
  getRelativeTimeString,
  formatFileSizeShort,
} from "../src/features/clipboard/board/board-card-renderers";
import { BOARD_LANES } from "../src/features/clipboard/board/board-lane";

describe("Board Card Renderers & Menu Utilities", () => {
  describe("getRelativeTimeString", () => {
    it("returns 'just now' for timestamps within the last minute", () => {
      const now = new Date().toISOString();
      expect(getRelativeTimeString(now)).toBe("just now");
    });

    it("returns minute formatting for recent items", () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(getRelativeTimeString(fiveMinAgo)).toBe("5m ago");
    });

    it("returns hour formatting for items earlier today", () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      expect(getRelativeTimeString(threeHoursAgo)).toBe("3h ago");
    });

    it("returns day formatting for older items", () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      expect(getRelativeTimeString(twoDaysAgo)).toBe("2d ago");
    });

    it("safely handles invalid date strings", () => {
      expect(getRelativeTimeString("invalid-date")).toBe("recent");
    });
  });

  describe("formatFileSizeShort", () => {
    it("handles zero or undefined bytes", () => {
      expect(formatFileSizeShort(undefined)).toBe("0 B");
      expect(formatFileSizeShort(0)).toBe("0 B");
      expect(formatFileSizeShort(-10)).toBe("0 B");
    });

    it("formats bytes, kilobytes and megabytes cleanly", () => {
      expect(formatFileSizeShort(500)).toBe("500 B");
      expect(formatFileSizeShort(1024)).toBe("1 KB");
      expect(formatFileSizeShort(812 * 1024)).toBe("812 KB");
      expect(formatFileSizeShort(2.4 * 1024 * 1024)).toBe("2.4 MB");
    });
  });

  describe("BOARD_LANES configuration", () => {
    it("defines all seven content type lanes in proper order", () => {
      const laneIds = BOARD_LANES.map((l) => l.id);
      expect(laneIds).toEqual([
        "text",
        "code",
        "link",
        "image",
        "audio",
        "video",
        "file",
      ]);
    });

    it("provides styling and badge content for each lane", () => {
      for (const lane of BOARD_LANES) {
        expect(lane.title).toBeTruthy();
        expect(lane.badgeStyle).toBeTruthy();
        expect(lane.badgeContent).toBeTruthy();
      }
    });
  });
});
