import { Skeleton } from "@/components/ui";

export default function RootPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="space-y-2">
        <Skeleton className="h-3 w-28 mx-auto" />
        <Skeleton className="h-2 w-20 mx-auto" />
      </div>
    </div>
  );
}
