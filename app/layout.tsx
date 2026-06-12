import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://obscura.compute"),
  title: {
    default: "Obscura — Compute in the dark.",
    template: "%s — Obscura",
  },
  description:
    "A dark pool for AI/GPU compute on Solana. Encrypted order books, commit-reveal submission, ZK-matched batch auctions, USDC settlement. Built for AI agents and developers.",
  keywords: [
    "Obscura",
    "dark pool",
    "GPU compute",
    "Solana",
    "AI agents",
    "USDC",
    "commit-reveal",
    "$OBSC",
  ],
  openGraph: {
    title: "Obscura — Compute in the dark.",
    description:
      "A dark pool for AI/GPU compute on Solana. No one sees what you buy, what you pay, or when.",
    url: "https://obscura.compute",
    siteName: "Obscura",
    type: "website",
  },
  icons: { icon: "/logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="font-sans antialiased"
      >
        {children}
      </body>
    </html>
  );
}
