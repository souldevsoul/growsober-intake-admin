import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: "GrowSober Admin",
  description: "Lead management and CRM dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${dmSans.variable} ${dmSans.className} bg-black text-white neon-grid-bg`}>
        <div className="flex">
          <Sidebar />
          <main className="flex-1 min-h-screen">{children}</main>
        </div>
      </body>
    </html>
  );
}
