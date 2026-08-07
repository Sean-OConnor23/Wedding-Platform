// app/layout.tsx
import React from "react";
import { Providers } from "@/components/Providers"; // New Provider Import
import "@/app/globals.css"; // Your standard Tailwind configuration file pathway

export const metadata = {
  title: "Our Wedding Platform",
  description: "Keyless Zero-Secret Guest Portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased text-stone-800 bg-stone-50">
        {/* The clean provider wrapper maps context keys across all child modules */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
