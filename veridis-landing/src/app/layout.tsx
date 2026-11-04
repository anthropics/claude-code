import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veridis - Commerce Infrastructure for AI Agents",
  description:
    "One API to let any AI agent transact. Handle authentication, merchant access, and payments with built-in guardrails. The Stripe for AI agents.",
  keywords: [
    "AI agents",
    "agentic commerce",
    "AI payments",
    "agent commerce",
    "AI infrastructure",
    "commerce API",
  ],
  authors: [{ name: "Veridis" }],
  openGraph: {
    title: "Veridis - Commerce Infrastructure for AI Agents",
    description:
      "One API to let any AI agent transact. Handle authentication, merchant access, and payments with built-in guardrails.",
    url: "https://veridis.ai",
    siteName: "Veridis",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Veridis - Commerce Infrastructure for AI Agents",
    description:
      "One API to let any AI agent transact. The Stripe for AI agents.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
