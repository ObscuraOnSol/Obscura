import { AppFrame, StatCard, Placeholder } from "@/components/app-frame";
import { StaggerContainer, StaggerItem } from "@/components/motion";

export const metadata = { title: "Agent mode" };

const STATS = [
  { label: "Passport", value: "SAS · active", sub: "owner-revocable" },
  { label: "Reputation", value: "87 / 100", sub: "signal-weighted" },
  { label: "Tier", value: "Gold", sub: "3,000 req/min" },
];

export default function AgentPage() {
  return (
    <AppFrame active="/agent" title="Agent mode">
      <StaggerContainer className="grid gap-4 sm:grid-cols-3" staggerDelay={0.07}>
        {STATS.map((s) => (
          <StaggerItem key={s.label}>
            <StatCard label={s.label} value={s.value} sub={s.sub} />
          </StaggerItem>
        ))}
      </StaggerContainer>
      <Placeholder note="Dedicated dashboard for AI agents: real-time programmatic order status, spend caps and daily rolling limits, and settlement history for SAS-passport agents. Token-gated via X-API-Key against the Agent Order API." />
    </AppFrame>
  );
}
