import type { Metadata } from "next";
import { SessionProvider } from "./components/SessionProvider";
import "./globals.css";
import "./index.css";

export const metadata: Metadata = {
  title: "Podcast Research Tool",
  description: "Search and analyze podcast transcripts with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script src="https://sql.js.org/dist/sql-wasm.js" async></script>
      </head>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
