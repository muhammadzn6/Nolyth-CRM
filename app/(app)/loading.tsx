import { Card, CardBody } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ApplicationLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-56" />
      <Card>
        <CardBody className="space-y-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-5/6" />
          <Skeleton className="h-5 w-2/3" />
        </CardBody>
      </Card>
    </div>
  );
}
