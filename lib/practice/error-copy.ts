import type { PracticeErrorCode } from "@/lib/practice/types";

export const PRACTICE_UNEXPECTED_MESSAGE =
  "Something went wrong. Try again.";

export function practiceErrorMessage(code: PracticeErrorCode): string {
  switch (code) {
    case "catalog-too-small":
      return "Need at least 5 stills in the catalog to start practice.";
    case "no-run":
      return "No practice run in progress.";
    case "must-lock-in":
      return "Place a pin and lock in first.";
    case "invalid-guess":
      return "That pin is not valid.";
    case "invalid-mode":
      return "Choose Casual or Timed.";
    case "forbidden":
      return "This tab is no longer the active session.";
  }
}
