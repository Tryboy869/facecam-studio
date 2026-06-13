import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FaceCam Studio',
  description: 'Create professional videos in browser',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
