import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Orbit CRM", template: "%s · Orbit CRM" },
  description: "Job placement operations, coordinated in one workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">{children}</body>
    </html>
  );
}
