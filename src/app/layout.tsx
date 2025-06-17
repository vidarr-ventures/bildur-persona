import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Persona Generator | Bildur",
  description: "AI-powered customer persona generation tool by Bildur",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-black text-white`}>
        {/* Bildur Navigation */}
        <nav className="bg-black/95 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">B</span>
                  </div>
                  <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                    Bildur
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <a href="https://bildur.com" className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium">
                  Home
                </a>
                <a href="https://bildur.com/about" className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium">
                  About
                </a>
                <a href="/" className="text-purple-400 hover:text-purple-300 px-3 py-2 text-sm font-medium">
                  Persona Builder
                </a>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>

        {/* Bildur Footer */}
        <footer className="bg-gray-950 border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center text-gray-400">
              <p>&copy; 2024 Bildur. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
