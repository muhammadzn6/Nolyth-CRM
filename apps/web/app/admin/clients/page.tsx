import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy compatibility route. Company details now live on each application. */
export default function ClientsRoute() {
  redirect("/leads");
}
