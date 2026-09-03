import type { Metadata } from "next";
import localFont from "next/font/local";
import { IBM_Plex_Sans } from "next/font/google";
import { getSessionIdHash } from "@/lib/auth/get-session-id-hash";
import { tabSessionBootScript } from "@/lib/auth/tab-session-boot";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const hyliaSerif = localFont({
  src: "../fonts/HyliaSerifBeta-Regular.otf",
  variable: "--font-hylia",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hyrule Guessr",
  description: "An invite-only GeoGuessr-style game set in Breath of the Wild.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const sessionIdHash = await getSessionIdHash();

  return (
    <html
      lang="en"
      className={`dark ${ibmPlexSans.variable} ${hyliaSerif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: tabSessionBootScript(sessionIdHash),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
