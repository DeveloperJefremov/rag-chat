'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { useSidebarStore } from '@/client/stores/sidebarStore';
import { useSessionStore } from '@/client/stores/sessionStore';
import { ConfirmDialog } from '@/presentation/web/components/ConfirmDialog';
import { Button } from '@/presentation/components/ui/button';
import { IconButton } from '@/presentation/web/components/ui/IconButton';
import { Skeleton } from '@/presentation/components/ui/skeleton';

const NAV = [
	{
		id: 'chat',
		href: '/',
		label: 'Chat',
		icon: (
			<svg
				width='14'
				height='14'
				viewBox='0 0 24 24'
				fill='none'
				stroke='currentColor'
				strokeWidth='1.8'
			>
				<path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
			</svg>
		),
	},
	{
		id: 'documents',
		href: '/documents',
		label: 'Documents',
		icon: (
			<svg
				width='14'
				height='14'
				viewBox='0 0 24 24'
				fill='none'
				stroke='currentColor'
				strokeWidth='1.8'
			>
				<path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
				<polyline points='14 2 14 8 20 8' />
				<line x1='8' y1='13' x2='16' y2='13' />
				<line x1='8' y1='17' x2='16' y2='17' />
			</svg>
		),
	},
	{
		id: 'stats',
		href: '/stats',
		label: 'Stats',
		icon: (
			<svg
				width='14'
				height='14'
				viewBox='0 0 24 24'
				fill='none'
				stroke='currentColor'
				strokeWidth='1.8'
			>
				<line x1='18' y1='20' x2='18' y2='10' />
				<line x1='12' y1='20' x2='12' y2='4' />
				<line x1='6' y1='20' x2='6' y2='14' />
			</svg>
		),
	},
];

const SECTION_LABEL_CLASS = 'font-mono text-[9px] uppercase tracking-[0.15em] text-powder-600/70';

function formatRelative(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'now';
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	if (days === 1) return 'Yesterday';
	if (days < 7) return `${days}d ago`;
	return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function SessionListSkeleton() {
	return (
		<div className='flex flex-col gap-1.5 px-5 py-1.5' aria-hidden='true'>
			{[68, 84, 60, 76, 70].map((w, i) => (
				<div key={i} className='flex items-start justify-between gap-2 py-1'>
					<Skeleton className='h-3 bg-white/[0.06]' style={{ width: `${w}%` }} />
					<Skeleton className='h-2.5 w-8 flex-shrink-0 bg-white/[0.06]' />
				</div>
			))}
		</div>
	);
}

function ChatSection() {
	const {
		sessions,
		activeSessionId,
		setActiveSession,
		createSession,
		fetchSessions,
		deleteSession,
		isLoading,
	} = useSessionStore();
	const router = useRouter();
	const pathname = usePathname();
	const onChatPage = pathname === '/';

	const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string | null } | null>(
		null,
	);

	useEffect(() => {
		fetchSessions();
	}, [fetchSessions]);

	const goToSession = (id: string) => {
		setActiveSession(id);
		if (!onChatPage) router.push('/');
	};

	const handleNewChat = async () => {
		await createSession();
		if (!onChatPage) router.push('/');
	};

	const requestDelete = (e: React.MouseEvent, id: string, title: string | null) => {
		e.stopPropagation();
		setPendingDelete({ id, title });
	};

	const confirmDelete = async () => {
		if (!pendingDelete) return;
		const id = pendingDelete.id;
		setPendingDelete(null);
		try {
			await deleteSession(id);
		} catch {
			// ignore — user can retry
		}
	};

	return (
		<>
			<div className='px-5 pb-3.5'>
				<Button
					type='button'
					variant='ghost'
					onClick={handleNewChat}
					className='border-cobalt-700 text-paper hover:bg-cobalt-800 hover:text-paper flex h-auto w-full cursor-pointer items-center justify-center gap-2 rounded-md border bg-transparent py-2.5 text-[13px] font-normal transition-colors'
				>
					<span className='text-base leading-none'>+</span> New chat
				</Button>
			</div>

			<div className='flex-1 overflow-y-auto pb-2.5'>
				<div className={clsx(SECTION_LABEL_CLASS, 'px-5 pt-1.5 pb-2')}>Recent</div>
				{isLoading && sessions.length === 0 && <SessionListSkeleton />}
				{!isLoading && sessions.length === 0 && (
					<div className='text-powder-600/60 px-5 py-1.5 text-xs'>No chats yet</div>
				)}
				<ConfirmDialog
					open={pendingDelete !== null}
					title='Delete chat?'
					message={
						pendingDelete
							? `“${pendingDelete.title ?? 'New conversation'}” and all its messages, documents, and citations will be permanently removed. This cannot be undone.`
							: ''
					}
					confirmLabel='Delete'
					cancelLabel='Cancel'
					tone='danger'
					onConfirm={confirmDelete}
					onCancel={() => setPendingDelete(null)}
				/>
				{sessions.map(s => {
					const isActive = s.id === activeSessionId;
					return (
						<div
							key={s.id}
							onClick={() => goToSession(s.id)}
							className={clsx(
								'flex cursor-pointer items-start justify-between gap-2 border-l-2 px-5 py-2.5 transition-colors',
								isActive
									? 'border-terracotta-500 bg-cobalt-800'
									: 'border-transparent hover:bg-white/[0.04]',
							)}
						>
							<span className='text-powder-300 line-clamp-2 flex-1 text-[13px] leading-[1.4]'>
								{s.title ?? 'New conversation'}
							</span>
							<div className='mt-px flex flex-shrink-0 items-center gap-1.5'>
								<span className='text-smoke font-mono text-[10px]'>
									{formatRelative(s.createdAt)}
								</span>
								<IconButton
									size='sm'
									onClick={e => requestDelete(e, s.id, s.title)}
									title='Delete chat'
									aria-label='Delete chat'
									className='text-powder-600 hover:text-terracotta-500 h-auto w-auto p-0.5 opacity-60 transition-[color,opacity] hover:bg-transparent hover:opacity-100'
								>
									<svg
										width='12'
										height='12'
										viewBox='0 0 24 24'
										fill='none'
										stroke='currentColor'
										strokeWidth='1.8'
									>
										<polyline points='3 6 5 6 21 6' />
										<path d='M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6' />
										<path d='M10 11v6M14 11v6' />
										<path d='M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2' />
									</svg>
								</IconButton>
							</div>
						</div>
					);
				})}
			</div>
		</>
	);
}

function UserMenu({ name, role }: { name: string; role: string }) {
	const [open, setOpen] = useState(false);
	const wrapperRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const onClickOutside = (e: MouseEvent) => {
			if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		const onEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setOpen(false);
		};
		document.addEventListener('mousedown', onClickOutside);
		document.addEventListener('keydown', onEscape);
		return () => {
			document.removeEventListener('mousedown', onClickOutside);
			document.removeEventListener('keydown', onEscape);
		};
	}, [open]);

	const initial = (name?.[0] ?? 'U').toUpperCase();

	return (
		<div ref={wrapperRef} className='relative'>
			{open && (
				<div className='bg-cobalt-900 border-cobalt-800 absolute right-0 bottom-[calc(100%+8px)] left-0 z-50 flex flex-col gap-0.5 rounded-lg border p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.35)]'>
					<Link
						href='/settings'
						onClick={() => setOpen(false)}
						className='text-powder-300 hover:bg-cobalt-800 flex items-center gap-2.5 rounded-md px-2.5 py-2 no-underline transition-colors'
					>
						<svg
							width='14'
							height='14'
							viewBox='0 0 24 24'
							fill='none'
							stroke='currentColor'
							strokeWidth='1.8'
						>
							<circle cx='12' cy='12' r='3' />
							<path d='M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42' />
						</svg>
						<span className='font-mono text-[11px] tracking-[0.1em] uppercase'>Settings</span>
					</Link>

					<div className='bg-cobalt-800 mx-1 h-px' />

					<Button
						type='button'
						variant='ghost'
						onClick={() => {
							setOpen(false);
							void signOut({ callbackUrl: '/signin' });
						}}
						className='text-terracotta-500 hover:bg-terracotta-500/10 hover:text-terracotta-500 flex h-auto w-full cursor-pointer items-center justify-start gap-2.5 rounded-md border-none bg-transparent px-2.5 py-2 text-left font-normal transition-colors'
					>
						<svg
							width='14'
							height='14'
							viewBox='0 0 24 24'
							fill='none'
							stroke='currentColor'
							strokeWidth='1.8'
						>
							<path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' />
							<polyline points='16 17 21 12 16 7' />
							<line x1='21' y1='12' x2='9' y2='12' />
						</svg>
						<span className='font-mono text-[11px] tracking-[0.1em] uppercase'>Sign out</span>
					</Button>
				</div>
			)}

			<Button
				type='button'
				variant='ghost'
				onClick={() => setOpen(o => !o)}
				aria-haspopup='menu'
				aria-expanded={open}
				className={clsx(
					'flex h-auto w-full cursor-pointer items-center justify-start gap-2.5 rounded-md border-none px-2.5 py-2 text-left font-normal transition-colors',
					'bg-transparent hover:bg-white/[0.04]',
					'aria-expanded:bg-cobalt-800 aria-expanded:hover:bg-cobalt-800',
				)}
			>
				<div className='bg-cobalt-700 text-paper flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full font-serif text-[13px] font-normal'>
					{initial}
				</div>
				<div className='min-w-0 flex-1'>
					<div className='text-paper truncate font-mono text-[11px] tracking-[0.02em]'>{name}</div>
					<div className='text-powder-600 mt-0.5 font-mono text-[9px] tracking-[0.12em] uppercase'>
						{role}
					</div>
				</div>
				<svg
					width='12'
					height='12'
					viewBox='0 0 24 24'
					fill='none'
					stroke='currentColor'
					strokeWidth='2'
					className={clsx(
						'text-powder-600 flex-shrink-0 transition-transform duration-150',
						open && 'rotate-180',
					)}
				>
					<polyline points='6 9 12 15 18 9' />
				</svg>
			</Button>
		</div>
	);
}

export function Sidebar() {
	const pathname = usePathname();
	const { data: session } = useSession();
	const mobileOpen = useSidebarStore(s => s.mobileOpen);
	const closeMobile = useSidebarStore(s => s.closeMobile);

	useEffect(() => {
		closeMobile();
	}, [pathname, closeMobile]);

	useEffect(() => {
		if (!mobileOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') closeMobile();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [mobileOpen, closeMobile]);

	if (pathname?.startsWith('/signin')) return null;

	const activeId =
		pathname === '/'
			? 'chat'
			: pathname?.startsWith('/documents')
				? 'documents'
				: pathname?.startsWith('/stats')
					? 'stats'
					: 'chat';

	return (
		<>
			{mobileOpen && (
				<Button
					type='button'
					variant='ghost'
					aria-label='Close sidebar'
					onClick={closeMobile}
					className='bg-cobalt-950/40 hover:bg-cobalt-950/40 desk:hidden fixed inset-0 z-30 h-auto cursor-pointer rounded-none'
				/>
			)}
			<aside
				data-open={mobileOpen}
				className={clsx(
					'bg-cobalt-950 fixed inset-y-0 left-0 z-40 flex h-screen w-[280px] flex-col overflow-hidden',
					'-translate-x-full transition-transform duration-200 ease-out',
					'data-[open=true]:translate-x-0',
					'desk:static desk:w-[260px] desk:min-w-[260px] desk:translate-x-0',
				)}
			>
				<div className='flex items-center justify-between border-b border-white/[0.06] px-5 pt-[22px] pb-[18px]'>
					<div className='flex items-center gap-2.5'>
						<div className='animate-pulse-dot bg-terracotta-500 h-2 w-2 flex-shrink-0 rounded-full' />
						<span className='text-paper font-serif text-[20px] font-light tracking-[-0.01em]'>
							RAG Chat
						</span>
					</div>
					<IconButton
						tone='sidebar'
						size='sm'
						aria-label='Close sidebar'
						onClick={closeMobile}
						className='desk:hidden -mr-2 p-1.5'
					>
						<svg
							width='16'
							height='16'
							viewBox='0 0 24 24'
							fill='none'
							stroke='currentColor'
							strokeWidth='2'
						>
							<line x1='18' y1='6' x2='6' y2='18' />
							<line x1='6' y1='6' x2='18' y2='18' />
						</svg>
					</IconButton>
				</div>

				<nav className='flex flex-col gap-0.5 px-5 pt-3.5 pb-4'>
					{NAV.map(item => {
						const isActive = item.id === activeId;
						return (
							<Link
								key={item.id}
								href={item.href}
								className={clsx(
									'flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-[13px] no-underline transition-[background,color] duration-150',
									isActive
										? 'border-terracotta-500 bg-cobalt-800 text-paper font-medium'
										: 'text-powder-400 border-transparent hover:bg-white/[0.04]',
								)}
							>
								{item.icon}
								{item.label}
							</Link>
						);
					})}
				</nav>

				<ChatSection />

				<div className='border-cobalt-800 border-t px-3 py-2.5'>
					{session?.user && (
						<UserMenu
							name={session.user.name ?? session.user.email ?? 'User'}
							role={session.user.role?.toLowerCase() ?? 'user'}
						/>
					)}
				</div>
			</aside>
		</>
	);
}
