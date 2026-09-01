import Link from "next/link";
import { Avatar } from "@heroui/react";
import { ChevronRight } from "lucide-react";

import { Card, CardBody } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils/format";

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ProfileCard({
  profileId,
  name,
  createdAt,
}: {
  profileId: string;
  name: string;
  createdAt: Date;
}) {
  return (
    <Link href={`/profiles/${profileId}`} className="group block h-full">
      <Card className="h-full shadow-none transition-colors hover:bg-surface-secondary">
        <CardBody className="flex h-full items-center gap-4 p-5">
          <Avatar size="md" className="shrink-0 bg-accent-soft text-accent">
            <Avatar.Fallback className="text-sm font-semibold">
              {getInitials(name)}
            </Avatar.Fallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-foreground transition-colors group-hover:text-accent">
              {name}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Created {formatDateTime(createdAt)}
            </p>
          </div>

          <ChevronRight
            className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
            aria-hidden="true"
          />
        </CardBody>
      </Card>
    </Link>
  );
}
