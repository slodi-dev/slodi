/**
 * Shared ContentItem union type covering all three content types.
 * This mirrors the base fields shared by Program, Event and Task.
 */

import type { Program } from "./programs.service";
import type { Event } from "./events.service";
import type { Task } from "./tasks.service";

export type ContentItem = Program | Event | Task;

export type ContentType = "program" | "event" | "task";

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  program: "Dagskrá",
  event: "Viðburður",
  task: "Verkefni",
};
