import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SessionProvider } from 'next-auth/react';
import { Sidebar } from '@/presentation/web/layout/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
	title: 'RAG Chat',
	description: 'Chat with your documents',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en'>
			<body className={`${inter.className} bg-background flex h-screen overflow-hidden`}>
				<SessionProvider>
					<Sidebar />
					<main className='flex-1 overflow-auto'>{children}</main>
				</SessionProvider>
			</body>
		</html>
	);
}
