import { ClipboardItem, ClipboardItemType } from "@/lib/validation/item";

export type CalendarViewMode = "month" | "week" | "day";

export type CalendarFilterType =
  | "all"
  | "text"
  | "code"
  | "link"
  | "image"
  | "audio"
  | "video"
  | "file";

export interface CalendarDayInfo {
  date: Date;
  dateString: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  items: ClipboardItem[];
  countsByType: Record<ClipboardItemType, number>;
}
