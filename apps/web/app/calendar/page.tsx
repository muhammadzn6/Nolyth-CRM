import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** The calendar is now the primary dashboard workspace. Keep old bookmarks safe. */
export default function CalendarRoute() {
  redirect("/");
}
