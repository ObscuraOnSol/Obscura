import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Analytics } from "@vercel/analytics/next";

const SITE_URL = "https://obscuraonsol.com";
const OG_DESCRIPTION =
  "A dark pool for AI/GPU compute on Solana. No one sees what you buy, what you pay, or when.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Obscura | Compute in the dark.",
    template: "%s | Obscura",
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
    title: "Obscura | Compute in the dark.",
    description: OG_DESCRIPTION,
    url: SITE_URL,
    siteName: "Obscura",
    type: "website",
    images: [
      {
        url: "/banner.png",
        width: 2172,
        height: 724,
        alt: "Obscura | Compute in the dark.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Obscura | Compute in the dark.",
    description: OG_DESCRIPTION,
    images: ["/banner.png"],
    site: "@obscuraonsol",
  },
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" }
    ],
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="font-sans antialiased"
      >
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
