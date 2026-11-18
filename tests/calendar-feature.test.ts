import { describe, it, expect } from "vitest";
import {
  formatLocalDateString,
  getItemCalendarDate,
  ClipboardItem,
} from "../src/lib/validation/item";
import {
  getMonthCalendarDays,
  getWeekCalendarDays,
  formatSelectedDateDisplay,
  getSelectedDateHeading,
} from "../src/features/calendar/calendar-utils";

describe("Calendar Feature — Date Calculations & Grouping", () => {
  it("formats local date without UTC boundary shifting", () => {
    const d = new Date(2026, 2, 18); // March 18, 2026
    const str = formatLocalDateString(d);
    expect(str).toBe("2026-03-18");
  });

  it("handles invalid date gracefully by returning today's formatted local date", () => {
    const invalidStr = formatLocalDateString("not-a-valid-date");
    expect(invalidStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("extracts dedicated calendarDate when present on an item", () => {
    const item: Partial<ClipboardItem> = {
      calendarDate: "2026-03-18",
      createdAt: "2026-03-19T10:00:00.000Z",
    };
    expect(getItemCalendarDate(item as any)).toBe("2026-03-18");
  });

  it("falls back to local date derived from createdAt when calendarDate is missing", () => {
    const item: Partial<ClipboardItem> = {
      createdAt: "2026-04-05T12:00:00.000Z",
    };
    const res = getItemCalendarDate(item as any);
    expect(res).toMatch(/^2026-04-0[456]$/); // depending on local offset
  });

  it("generates correct 7-column Month grid with proper padding and content counts", () => {
    const testDate = new Date(2026, 2, 1); // March 2026
    const selectedDate = "2026-03-18";

    const mockItems: ClipboardItem[] = [
      {
        id: "item-1",
        workspaceId: "ws-1",
        type: "text",
        title: "Meeting notes",
        content: "Discuss roadmap",
        calendarDate: "2026-03-18",
        createdBy: "user-1",
        createdAt: "2026-03-18T10:00:00.000Z",
        updatedAt: "2026-03-18T10:00:00.000Z",
        isPinned: false,
        tags: [],
        contentLength: 15,
      },
      {
        id: "item-2",
        workspaceId: "ws-1",
        type: "code",
        title: "Snippet",
        content: "const a = 1;",
        calendarDate: "2026-03-18",
        createdBy: "user-1",
        createdAt: "2026-03-18T11:00:00.000Z",
        updatedAt: "2026-03-18T11:00:00.000Z",
        isPinned: false,
        tags: [],
        contentLength: 12,
      },
      {
        id: "item-3",
        workspaceId: "ws-1",
        type: "link",
        title: "Docs",
        content: "https://example.com",
        calendarDate: "2026-03-05",
        createdBy: "user-1",
        createdAt: "2026-03-05T09:00:00.000Z",
        updatedAt: "2026-03-05T09:00:00.000Z",
        isPinned: false,
        tags: [],
        contentLength: 19,
      },
    ];

    const days = getMonthCalendarDays(testDate, selectedDate, mockItems);

    // Grid size must be multiple of 7 (35 or 42)
    expect(days.length % 7).toBe(0);
    expect(days.length).toBeGreaterThanOrEqual(35);

    // Selected day check
    const selectedDay = days.find((d) => d.dateString === selectedDate);
    expect(selectedDay).toBeDefined();
    expect(selectedDay?.isSelected).toBe(true);
    expect(selectedDay?.countsByType.text).toBe(1);
    expect(selectedDay?.countsByType.code).toBe(1);
    expect(selectedDay?.countsByType.link).toBe(0);

    // Day with link item check
    const linkDay = days.find((d) => d.dateString === "2026-03-05");
    expect(linkDay).toBeDefined();
    expect(linkDay?.countsByType.link).toBe(1);
  });

  it("generates exactly 7 days for Week grid covering Sunday through Saturday", () => {
    const testDate = new Date(2026, 2, 18); // Wednesday March 18, 2026
    const selectedDate = "2026-03-18";

    const days = getWeekCalendarDays(testDate, selectedDate, []);
    expect(days.length).toBe(7);

    // First day should be Sunday
    expect(days[0].date.getDay()).toBe(0);
    // Last day should be Saturday
    expect(days[6].date.getDay()).toBe(6);

    // Selected day is marked correctly
    const selectedDay = days.find((d) => d.dateString === selectedDate);
    expect(selectedDay?.isSelected).toBe(true);
  });

  it("formats selected date display string accurately", () => {
    const display = formatSelectedDateDisplay("2026-03-18");
    expect(display).toContain("Mar");
    expect(display).toContain("18");
    expect(display).toContain("2026");
  });

  it("determines relative date headings dynamically (Today, Yesterday, etc.)", () => {
    const todayStr = formatLocalDateString(new Date());
    expect(getSelectedDateHeading(todayStr)).toBe("Today");

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatLocalDateString(yesterday);
    expect(getSelectedDateHeading(yesterdayStr)).toBe("Yesterday");

    const futureDate = "2030-01-01";
    const futureHeading = getSelectedDateHeading(futureDate);
    expect(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Tuesday"]).toContain(
      futureHeading
    );
  });
});
