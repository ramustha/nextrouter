import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';

export const metadata: Metadata = {
  title: 'NextRouter — Multi-AI Context Sharing & Observability Engine',
  description: 'Sync, monitor, and optimize your codebase context and rules across Claude Code, Cursor, Copilot, and Antigravity.',
  keywords: ['AI coding assistant', 'Model Context Protocol', 'token optimizer', 'Cursor', 'Claude Code', 'Antigravity']
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="dashboard-wrapper">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
