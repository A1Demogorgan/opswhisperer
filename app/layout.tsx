import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "COO Ops Cockpit",
  description: "Demo-grade operations cockpit for quarterly revenue and BPM conversion.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
