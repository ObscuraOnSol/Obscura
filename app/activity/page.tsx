import { AppFrame, Placeholder } from "@/components/app-frame";

export const metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <AppFrame active="/activity" title="Activity feed">
      <Placeholder note="Complete wallet timeline — fills, cancels, settlements — with relative timestamps, filter-by-type, and CSV export. Each fill carries a transaction receipt: block number, timestamp, compute cost, confirmations, and a Solana explorer link." />
    </AppFrame>
  );
}
