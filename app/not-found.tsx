import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-lg">
        <CardBody className="space-y-5 text-center">
          <h1 className="orbit-heading text-foreground">
            Resource not found
          </h1>
          <Link href="/">
            <Button>Back to dashboard</Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
