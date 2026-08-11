import Navigation from "@/components/navigation";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Inter, Geist } from "next/font/google";
import Footer from "@/components/footer/footer";
import { ThemeProvider } from "@/components/theme/theme-provider"
import Banner from "@/components/banner/banner";
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { ToastProvider } from "@/components/ui/toast";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Limitless Cheer & Gymnastics",
  description: "Limitless Cheer & Gymnastics, a premier cheerleading and gymnastics gym located in the heart of Tell City.",
  applicationName: "Limitless Cheer & Gymnastics",
  authors: [{ name: "Limitless Cheer & Gymnastics LLC" }],
  metadataBase: new URL("https://fusionlcc.com"),
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
        >
          <ToastProvider>
            <Banner />
            <Navigation />
            {children}
            <Footer />
          </ToastProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
