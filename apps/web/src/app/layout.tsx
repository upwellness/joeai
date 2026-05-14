import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JoeAI Dashboard",
  description: "LINE OA Sales Intelligence & Customer Payment Bot",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
