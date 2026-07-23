import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body className="antialiased bg-gray-950 text-white">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}