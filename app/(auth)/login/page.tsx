import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { OrbitLogo } from "@/components/brand/orbit-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireActiveUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let hasActiveSession = false;

  try {
    await requireActiveUser();
    hasActiveSession = true;
  } catch {}

  if (hasActiveSession) {
    redirect("/");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md shadow-overlay">
        <CardHeader className="space-y-5">
          <OrbitLogo height={26} showWordmark />
          <h1 className="orbit-heading text-foreground">
            Sign in
          </h1>
        </CardHeader>
        <CardBody>
          <LoginForm />
        </CardBody>
      </Card>
    </div>
  );
}
