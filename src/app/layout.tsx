import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";

export const metadata: Metadata = {
  title: "Kanban Board",
  description: "Personal project kanban board",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-gray-900 text-gray-100">
        <AppProvider>
          <div className="flex h-full">
            {children}
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
