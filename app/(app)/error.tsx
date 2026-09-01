"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export default function ApplicationError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">
            Something went wrong
          </h2>
          <p className="text-sm text-muted">
            {error.message || "We hit an unexpected application error."}
          </p>
        </div>
        <Button onPress={reset}>Try again</Button>
      </CardBody>
    </Card>
  );
}
