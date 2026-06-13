import { AppFrame } from "@/components/app-frame";
import { MarketplaceLive } from "@/components/marketplace/marketplace-live";

export const metadata = { title: "Marketplace" };

export default function MarketplacePage() {
  return (
    <AppFrame active="/marketplace" title="Marketplace">
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Live GPU clearing prices and provider depth. Peer-to-peer auction
        pricing, materially cheaper than hyperscalers.
      </p>
      <MarketplaceLive />
    </AppFrame>
  );
}
