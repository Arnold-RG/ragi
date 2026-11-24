import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz"] });

export const metadata: Metadata = {
  title: { default: "RAGI — Arnova Group", template: "%s · RAGI" },
  description: "RAGI, the operations engine of the Arnova Group ecosystem. Created by Arnold Rurangwa / Arnova Group.",
  authors: [{ name: "Arnold Rurangwa / Arnova Group" }],
  creator: "Arnold Rurangwa / Arnova Group",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f0b09" },
    { media: "(prefers-color-scheme: light)", color: "#f7f1e8" },
  ],
  viewportFit: "cover",
};

// Sets the theme before first paint so there is no flash.
const themeScript = `try{var t=localStorage.getItem('arnova-theme');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
