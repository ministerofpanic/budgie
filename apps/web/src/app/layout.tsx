import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import "./globals.css";

const siteUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
const description = "Give every pound a job, before you spend it.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Budgie", template: "Budgie | %s" },
  description,
  applicationName: "Budgie",
  appleWebApp: { capable: true, title: "Budgie", statusBarStyle: "default" },
  // Self-hosted personal budgeting data - never meant to be publicly indexed.
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: "Budgie",
    title: "Budgie",
    description,
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Budgie",
    description,
  },
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

// Runs before paint, so the page never flashes light-then-dark. There's no
// manual toggle yet - this just follows the OS preference, matching the
// `viewport.themeColor` media queries above.
const themeScript = `
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.classList.add("dark");
  }
`;

const RootLayout = ({ children }: { readonly children: React.ReactNode }) => (
  <html
    lang="en-GB"
    suppressHydrationWarning
    className={`${GeistSans.variable} ${GeistMono.variable}`}
  >
    <head>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
    </head>
    <body className="min-h-dvh antialiased">{children}</body>
  </html>
);

export default RootLayout;
