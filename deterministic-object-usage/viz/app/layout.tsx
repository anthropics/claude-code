import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "deterministic-viz | Feature Evolution Visualizer",
  description:
    "Beautiful Mermaid diagrams + Ghostty-style ASCII animation for changelog feature visualization",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
