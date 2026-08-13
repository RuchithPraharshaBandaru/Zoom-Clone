import './globals.css';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'Zoom Workplace — Video Conferencing Platform',
  description: 'Professional video conferencing platform for meetings, webinars, and team collaboration. Create, join, and schedule meetings instantly.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
