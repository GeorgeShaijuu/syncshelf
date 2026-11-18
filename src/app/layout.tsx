import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/features/auth/auth-context";
import { WorkspaceProvider } from "@/features/workspaces/workspace-context";
import { SmoothScrollProvider } from "@/components/providers/smooth-scroll-provider";

export const metadata: Metadata = {
  title: "SyncShelf — Universal Shared Clipboard Board",
  description:
    "Fast, searchable universal clipboard board for teams and individuals. Copy, paste, and organize anything instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F8F6EF] text-[#151515] antialiased">
        <AuthProvider>
          <WorkspaceProvider>
            <SmoothScrollProvider>{children}</SmoothScrollProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
