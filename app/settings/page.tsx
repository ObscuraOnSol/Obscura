import { AppFrame, Placeholder } from "@/components/app-frame";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <AppFrame active="/settings" title="Settings">
      <Placeholder note="Wallet management, API-key generation (keys are prefixed obsc_live_, shown once, SHA-256 hashed at rest), and notification preferences including GPU price alerts (e.g. notify when H100 clearing price drops below $X/hr)." />
    </AppFrame>
  );
}
