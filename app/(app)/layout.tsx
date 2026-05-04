import { Sidebar } from '@/presentation/web/layout/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<>
			<Sidebar />
			<main className='flex-1 overflow-hidden'>{children}</main>
		</>
	);
}
