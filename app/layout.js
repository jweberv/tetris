import './globals.css';

export const metadata = {
  title: 'Tetris',
  description: 'Tetris built with Next.js',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
