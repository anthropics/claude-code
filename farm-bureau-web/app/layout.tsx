import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Louisiana Farm Bureau Benefits | Find Your Benefits",
  description:
    "Discover which Louisiana Farm Bureau benefits are most valuable for your situation. Personalized consultation with Garrett Gardner, LFBF Insurance Agent.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
