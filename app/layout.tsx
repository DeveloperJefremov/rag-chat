import type { Metadata } from 'next';
import { Fraunces, Geist, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { SessionProvider } from 'next-auth/react';
import { Sidebar } from '@/presentation/web/layout/Sidebar';

const geist = Geist({ subsets: ['latin'] });
const fraunces = Fraunces({
	subsets: ['latin'],
	weight: ['300', '400'],
	style: ['normal', 'italic'],
	variable: '--font-fraunces',
});
const jetbrainsMono = JetBrains_Mono({
	subsets: ['latin'],
	weight: ['400', '500'],
	variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
	title: 'RAG Chat',
	description: 'Chat with your documents',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en'>
			<body
				className={`${geist.className} ${fraunces.variable} ${jetbrainsMono.variable} bg-background flex h-screen overflow-hidden`}
			>
				<SessionProvider>
					<Sidebar />
					<main className='flex-1 overflow-hidden'>{children}</main>
				</SessionProvider>
			</body>
		</html>
	);
}
