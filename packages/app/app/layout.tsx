import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "XBridge — Xahau ↔ XRPL Bridge",
  description: "Bridge assets between Xahau and XRPL using the native XChainBridge protocol",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-white antialiased">{children}</body>
    </html>
  );
}
