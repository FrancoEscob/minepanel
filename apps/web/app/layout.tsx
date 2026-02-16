import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MinePanel",
  description: "Panel MVP para gestión local de servidores Minecraft"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
