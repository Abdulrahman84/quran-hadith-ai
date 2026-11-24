import type { Metadata, Viewport } from "next";
import { Amiri, Geist_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { AppTabBar } from "@/components/native/app-tab-bar";
import { NativeAppBridge } from "@/components/native/native-app-bridge";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { isNativeApp } from "@/lib/native-app";
import "./globals.css";

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-geist-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["arabic", "latin"],
});

// Classical naskh for headings, answers and the wordmark: reads like a printed
// reference work rather than an app UI.
const amiri = Amiri({
  variable: "--font-display",
  weight: ["400", "700"],
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
    icon: [{ url: "/brand/sanad-mark.svg?v=vector-mark", type: "image/svg+xml" }],
    apple: "/brand/sanad-app-icon.png?v=vector-mark",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the mobile app webviews draw under the notch and home indicator;
  // globals.css pads the header and page with the safe-area insets.
  viewportFit: "cover",
  themeColor: "#f6f1e7",
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
      data-native-app={isNativeApp ? "" : undefined}
      className={`${ibmPlexSansArabic.variable} ${amiri.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ConvexClientProvider>
          <I18nProvider>
            <SiteHeader />
            {children}
            {isNativeApp ? <AppTabBar /> : <SiteFooter />}
            {isNativeApp ? <NativeAppBridge /> : null}
          </I18nProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
