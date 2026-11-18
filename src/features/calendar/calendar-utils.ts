import { ClipboardItem, ClipboardItemType, getItemCalendarDate, formatLocalDateString } from "@/lib/validation/item";
import { CalendarDayInfo } from "./calendar-types";

/**
 * Returns a list of day objects representing the full 7-column calendar grid for a given month.
 * Starts on Sunday and ends on Saturday, including necessary trailing days from previous/next months.
 */
export function getMonthCalendarDays(
  viewDate: Date,
  selectedDateString: string,
  items: ClipboardItem[]
): CalendarDayInfo[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // First day of current month
  const firstDayOfMonth = new Date(year, month, 1);
  const firstDayWeekday = firstDayOfMonth.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Last day of current month
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  // Today in local timezone
  const todayString = formatLocalDateString(new Date());

  // Index items by dateString (YYYY-MM-DD)
  const itemsByDate = new Map<string, ClipboardItem[]>();
  for (const item of items) {
    const dStr = getItemCalendarDate(item);
    if (!itemsByDate.has(dStr)) {
      itemsByDate.set(dStr, []);
    }
    itemsByDate.get(dStr)!.push(item);
  }

  const result: CalendarDayInfo[] = [];

  // 1. Trailing days from previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = firstDayWeekday - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const date = new Date(year, month - 1, dayNum);
    const dateString = formatLocalDateString(date);
    const dayItems = itemsByDate.get(dateString) || [];

    result.push(
      buildDayInfo(
        date,
        dateString,
        dayNum,
        false,
        dateString === todayString,
        dateString === selectedDateString,
        dayItems
      )
    );
  }

  // 2. Days of current month
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const date = new Date(year, month, dayNum);
    const dateString = formatLocalDateString(date);
    const dayItems = itemsByDate.get(dateString) || [];

    result.push(
      buildDayInfo(
        date,
        dateString,
        dayNum,
        true,
        dateString === todayString,
        dateString === selectedDateString,
        dayItems
      )
    );
  }

  // 3. Trailing days for next month to complete the week rows (multiples of 7, 35 or 42 cells)
  const remainingCells = (7 - (result.length % 7)) % 7;
  // If we only have 35 cells (5 rows) and month starts late, or standard 35/42
  const targetTotal = result.length + remainingCells < 35 ? 35 : result.length + remainingCells;
  const trailingNeeded = targetTotal - result.length;

  for (let dayNum = 1; dayNum <= trailingNeeded; dayNum++) {
    const date = new Date(year, month + 1, dayNum);
    const dateString = formatLocalDateString(date);
    const dayItems = itemsByDate.get(dateString) || [];

    result.push(
      buildDayInfo(
        date,
        dateString,
        dayNum,
        false,
        dateString === todayString,
        dateString === selectedDateString,
        dayItems
      )
    );
  }

  return result;
}

/**
 * Returns 7 days for the week containing viewDate.
 */
export function getWeekCalendarDays(
  viewDate: Date,
  selectedDateString: string,
  items: ClipboardItem[]
): CalendarDayInfo[] {
  const current = new Date(viewDate);
  const dayOfWeek = current.getDay(); // 0 = Sunday
  const sunday = new Date(current);
  sunday.setDate(current.getDate() - dayOfWeek);

  const todayString = formatLocalDateString(new Date());

  const itemsByDate = new Map<string, ClipboardItem[]>();
  for (const item of items) {
    const dStr = getItemCalendarDate(item);
    if (!itemsByDate.has(dStr)) {
      itemsByDate.set(dStr, []);
    }
    itemsByDate.get(dStr)!.push(item);
  }

  const result: CalendarDayInfo[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + i);
    const dateString = formatLocalDateString(date);
    const dayItems = itemsByDate.get(dateString) || [];

    result.push(
      buildDayInfo(
        date,
        dateString,
        date.getDate(),
        date.getMonth() === viewDate.getMonth(),
        dateString === todayString,
        dateString === selectedDateString,
        dayItems
      )
    );
  }

  return result;
}

function buildDayInfo(
  date: Date,
  dateString: string,
  dayNumber: number,
  isCurrentMonth: boolean,
  isToday: boolean,
  isSelected: boolean,
  items: ClipboardItem[]
): CalendarDayInfo {
  const countsByType: Record<ClipboardItemType, number> = {
    text: 0,
    code: 0,
    link: 0,
    image: 0,
    audio: 0,
    video: 0,
    file: 0,
  };

  for (const item of items) {
    const type = item.type || "text";
    if (countsByType[type] !== undefined) {
      countsByType[type]++;
    } else {
      countsByType.file++;
    }
  }

  return {
    date,
    dateString,
    dayNumber,
    isCurrentMonth,
    isToday,
    isSelected,
    items,
    countsByType,
  };
}

/**
 * Formats a date nicely for the panel header: e.g. "Tue, Mar 18, 2025"
 */
export function formatSelectedDateDisplay(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(`${dateInput}T00:00:00`) : dateInput;
  if (isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Returns header title like "Today", "Yesterday", or the Day name.
 */
export function getSelectedDateHeading(dateString: string): string {
  const todayStr = formatLocalDateString(new Date());
  if (dateString === todayStr) return "Today";

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateString === formatLocalDateString(yesterday)) return "Yesterday";

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateString === formatLocalDateString(tomorrow)) return "Tomorrow";

  const date = new Date(`${dateString}T00:00:00`);
  if (!isNaN(date.getTime())) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }

  return "Selected Date";
}
