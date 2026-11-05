import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { QueryProvider } from "@/components/providers/QueryProvider";
import "./globals.css";
import "./theme.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Garments — Tailor Management System",
  description: "Tailor Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={poppins.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
          document.addEventListener('wheel', function(e) {
            if (document.activeElement && document.activeElement.type === 'number') {
              document.activeElement.blur();
            }
          }, { passive: true });
          document.addEventListener('keydown', function(e) {
            if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
                e.target && e.target.type === 'number') {
              e.preventDefault();
            }
          });
        `,
          }}
        />
      </head>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
