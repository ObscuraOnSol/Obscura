import { AppFrame } from "@/components/app-frame";
import { ApiKeys } from "@/components/settings/api-keys";
import { PriceAlerts } from "@/components/settings/price-alerts";
import { NotificationPreferences } from "@/components/settings/notification-preferences";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <AppFrame active="/settings" title="Settings">
      <ApiKeys />
      <PriceAlerts />
      <NotificationPreferences />
    </AppFrame>
  );
}
