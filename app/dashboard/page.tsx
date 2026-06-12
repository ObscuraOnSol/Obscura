import { AppFrame } from "@/components/app-frame";
import { DashboardLive } from "@/components/dashboard/dashboard-live";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <AppFrame active="/dashboard" title="Dashboard">
      <DashboardLive />
    </AppFrame>
  );
}
