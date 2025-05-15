import type {Metadata} from 'next';
import { Geist } from 'next/font/google'; // Corrected import, Geist_Mono not explicitly requested for body
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Added Toaster

const geistSans = Geist({ // Using the more common Geist import
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

// Geist Mono can still be available if needed for specific elements later
// const geistMono = Geist_Mono({
//   variable: '--font-geist-mono',
//   subsets: ['latin'],
// });

export const metadata: Metadata = {
  title: 'ChronoConnect',
  description: 'Peer-to-peer video chat application',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
