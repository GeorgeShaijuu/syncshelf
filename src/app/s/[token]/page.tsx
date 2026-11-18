import { Metadata } from "next";
import { PublicShareClientView } from "./public-share-client-view";

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

export const metadata: Metadata = {
  title: "SyncShelf — Shared Clipboard Content",
  description: "View shared clipboard entries on SyncShelf.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
  },
};

export default async function PublicSharePage({ params }: PageProps) {
  const { token } = await params;
  return <PublicShareClientView token={token} />;
}
