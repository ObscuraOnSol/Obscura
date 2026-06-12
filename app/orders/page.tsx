import { AppFrame } from "@/components/app-frame";
import { OrderFlow } from "@/components/orders/order-flow";

export const metadata = { title: "Orders" };

export default function OrdersPage() {
  return (
    <AppFrame active="/orders" title="Orders">
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Commit–reveal order flow. Your order is hashed client-side and only the
        hash is submitted; reveal it to enter the next ~45s batch auction. Each
        order shows its live phase — committed, revealed, matched, settled.
      </p>
      <OrderFlow />
    </AppFrame>
  );
}
