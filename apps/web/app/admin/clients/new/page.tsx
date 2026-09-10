import { redirect } from "next/navigation";

export default function LegacyNewClientRoute() {
  redirect("/leads");
}
