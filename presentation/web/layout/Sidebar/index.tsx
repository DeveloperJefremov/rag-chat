'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, FileText, BarChart2 } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/presentation/components/ui/avatar';
import { Button } from '@/presentation/components/ui/button';

const NAV = [
	{ href: '/', label: 'Chat', icon: MessageSquare },
	{ href: '/documents', label: 'Documents', icon: FileText },
	{ href: '/stats', label: 'Stats', icon: BarChart2 },
];

export function Sidebar() {
	const pathname = usePathname();
	const { data: session } = useSession();

	return (
		<aside className='bg-muted/30 flex w-56 shrink-0 flex-col border-r'>
			<div className='border-b px-4 py-5'>
				<h1 className='text-sm font-bold tracking-tight'>RAG Chat</h1>
				<p className='text-muted-foreground mt-0.5 text-xs'>Document Intelligence</p>
			</div>

			<nav className='flex-1 space-y-0.5 p-2'>
				{NAV.map(({ href, label, icon: Icon }) => {
					const active = pathname === href;
					return (
						<Link
							key={href}
							href={href}
							className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
								active
									? 'bg-primary text-primary-foreground font-medium'
									: 'text-muted-foreground hover:text-foreground hover:bg-muted'
							}`}
						>
							<Icon className='h-4 w-4 shrink-0' />
							{label}
						</Link>
					);
				})}
			</nav>

			{session?.user && (
				<div className='border-t p-3'>
					<div className='mb-2 flex items-center gap-2'>
						<Avatar className='h-7 w-7'>
							<AvatarImage src={session.user.image ?? undefined} alt={session.user.name ?? ''} />
							<AvatarFallback className='text-xs'>
								{(session.user.name ?? session.user.email ?? '?')[0].toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<div className='min-w-0 flex-1'>
							<p className='truncate text-xs font-medium'>
								{session.user.name ?? session.user.email}
							</p>
							<p className='text-muted-foreground text-xs capitalize'>
								{session.user.role?.toLowerCase()}
							</p>
						</div>
					</div>
					<Button
						variant='ghost'
						size='sm'
						className='text-muted-foreground hover:text-foreground w-full justify-start text-xs'
						onClick={() => signOut({ callbackUrl: '/signin' })}
					>
						Sign out
					</Button>
				</div>
			)}
		</aside>
	);
}
