import { AppFrame } from "@/components/app-frame";
import { ApiKeys } from "@/components/settings/api-keys";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <AppFrame active="/settings" title="Settings">
      <ApiKeys />
    </AppFrame>
  );
}
