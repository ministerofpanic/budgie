import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Budgie", template: "%s · Budgie" },
  description: "Give every pound a job, before you spend it.",
  applicationName: "Budgie",
  appleWebApp: { capable: true, title: "Budgie", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfdfb" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1614" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const RootLayout = ({ children }: { readonly children: React.ReactNode }) => (
  <html lang="en-GB" suppressHydrationWarning>
    <body className="min-h-dvh antialiased">{children}</body>
  </html>
);

export default RootLayout;
