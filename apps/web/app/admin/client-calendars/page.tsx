import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Compatibility redirect for bookmarks created before calendars became
 * candidate-profile owned. Calendar connections now live on each profile.
 */
export default function LegacyClientCalendarsRoute() {
  redirect("/profiles");
}
