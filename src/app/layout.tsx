import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Concorsi Hero',
  description: 'Microlearning stile Duolingo per concorsi pubblici in Italia'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
