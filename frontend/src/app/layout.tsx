import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "RAGI — Arnova Group", template: "%s · RAGI" },
  description: "RAGI, the operations engine of the Arnova Group ecosystem. Created by Arnold Rurangwa / Arnova Group.",
  authors: [{ name: "Arnold Rurangwa / Arnova Group" }],
  creator: "Arnold Rurangwa / Arnova Group",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070C1A" },
    { media: "(prefers-color-scheme: light)", color: "#F3F6FC" },
  ],
  viewportFit: "cover",
};

// Sets the theme before first paint so there is no flash.
const themeScript = `try{var t=localStorage.getItem('arnova-theme');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-app="ragi" data-theme="dark" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
