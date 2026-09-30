import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sharey - Save it now. Get it anywhere.",
  description: "Personal cross-device sharing and saving tool",
  icons: {
    icon: "/logo.png?v=2",
    apple: "/logo.png?v=2",
    shortcut: "/logo.png?v=2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json?v=2" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="apple-touch-icon" href="/logo.png?v=2" />
      </head>
      <body suppressHydrationWarning className={`${inter.className} min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
