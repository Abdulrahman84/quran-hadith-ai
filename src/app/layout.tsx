import type { Metadata } from "next";
import { Geist_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-geist-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["arabic", "latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "سند | Sanad AI",
  description: "A citation-first Quran, tafsir, and Sunnah assistant.",
  verification: {
    google: "P4KIgp2oN1afFuRDLRHg20NkD-cAUvc-WTVaow1cbuk",
  },
  icons: {
    icon: "/brand/sanad-icon-gold-forward.png?v=gold-forward",
    shortcut: "/brand/sanad-icon-gold-forward.png?v=gold-forward",
    apple: "/brand/sanad-icon-gold-forward.png?v=gold-forward",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      dir="rtl"
      lang="ar"
      className={`${ibmPlexSansArabic.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ConvexClientProvider>
          <I18nProvider>
            <SiteHeader />
            {children}
          </I18nProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
