import { AppFrame } from "@/components/app-frame";
import { ActivityFeed } from "@/components/activity/activity-feed";

export const metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <AppFrame active="/activity" title="Activity feed">
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Your complete order timeline (commits, reveals, fills, and cancels)
        with relative timestamps and CSV export.
      </p>
      <ActivityFeed />
    </AppFrame>
  );
}
