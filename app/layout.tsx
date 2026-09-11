import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "Bertucci Labs | Intelligence, engineered";
const description =
  "Custom AI systems and software engineering for the problems that matter to your business.";

export const metadata: Metadata = {
  metadataBase: new URL("https://bertucci-labs.elated-fairy-7714.chatgpt.site"),
  title,
  description,
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
  },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "Bertucci Labs",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Bertucci Labs red wire terrain with Intelligence, engineered.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
