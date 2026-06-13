import type { Metadata } from "next";
import { Roboto, Lora } from "next/font/google";
import "./globals.css";


const roboto = Roboto({
  weight: ["300", "400", "500", "700", "900"],
  subsets: ["vietnamese", "latin"],
  variable: "--font-sans",
  display: "swap",
});

const lora = Lora({
  subsets: ["vietnamese", "latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "English Context Coach",
  description: "Context-aware English learning for Vietnamese learners.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${roboto.variable} ${lora.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('theme');
                  var theme = stored || 'system';
                  if (theme === 'system') {
                    var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
                  } else {
                    document.documentElement.setAttribute('data-theme', theme);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}

