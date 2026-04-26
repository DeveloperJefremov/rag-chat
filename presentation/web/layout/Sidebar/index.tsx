'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { useSidebarStore } from '@/client/stores/sidebarStore';
import { useSessionStore } from '@/client/stores/sessionStore';
import { useUploadStore } from '@/client/stores/uploadStore';
import { ConfirmDialog } from '@/presentation/web/components/ConfirmDialog';

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

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono), monospace' };

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

function ChatSection() {
	const {
		sessions,
		activeSessionId,
		setActiveSession,
		createSession,
		fetchSessions,
		deleteSession,
	} = useSessionStore();

	const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string | null } | null>(
		null,
	);

	useEffect(() => {
		fetchSessions();
	}, [fetchSessions]);

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
			<div style={{ padding: '0 20px 14px' }}>
				<button
					onClick={() => createSession()}
					style={{
						width: '100%',
						padding: '9px 14px',
						background: 'transparent',
						border: '1px solid var(--cobalt-700)',
						borderRadius: 8,
						color: 'var(--paper)',
						fontFamily: 'inherit',
						fontSize: 13,
						cursor: 'pointer',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						gap: 8,
						transition: 'background 0.15s',
					}}
					onMouseEnter={e => (e.currentTarget.style.background = 'var(--cobalt-800)')}
					onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
				>
					<span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New chat
				</button>
			</div>

			<div style={{ flex: 1, overflowY: 'auto', padding: '0 0 10px' }}>
				<div
					style={{
						padding: '6px 20px 8px',
						...MONO,
						fontSize: 9,
						letterSpacing: '0.15em',
						textTransform: 'uppercase',
						color: 'var(--powder-600)',
						opacity: 0.7,
					}}
				>
					Recent
				</div>
				{sessions.length === 0 && (
					<div
						style={{ padding: '6px 20px', fontSize: 12, color: 'var(--powder-600)', opacity: 0.6 }}
					>
						No chats yet
					</div>
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
							onClick={() => setActiveSession(s.id)}
							style={{
								padding: '9px 20px',
								cursor: 'pointer',
								borderLeft: isActive ? '2px solid var(--terracotta-500)' : '2px solid transparent',
								background: isActive ? 'var(--cobalt-800)' : 'transparent',
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'flex-start',
								gap: 8,
								transition: 'background 0.15s',
							}}
							onMouseEnter={e => {
								if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
							}}
							onMouseLeave={e => {
								if (!isActive) e.currentTarget.style.background = 'transparent';
							}}
						>
							<span
								style={{
									fontFamily: 'inherit',
									fontSize: 13,
									color: 'var(--powder-300)',
									lineHeight: 1.4,
									flex: 1,
									overflow: 'hidden',
									display: '-webkit-box',
									WebkitLineClamp: 2,
									WebkitBoxOrient: 'vertical',
								}}
							>
								{s.title ?? 'New conversation'}
							</span>
							<div
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: 6,
									flexShrink: 0,
									marginTop: 1,
								}}
							>
								<span
									style={{
										...MONO,
										fontSize: 10,
										color: 'var(--smoke)',
									}}
								>
									{formatRelative(s.createdAt)}
								</span>
								<button
									onClick={e => requestDelete(e, s.id, s.title)}
									title='Delete chat'
									aria-label='Delete chat'
									style={{
										background: 'none',
										border: 'none',
										padding: 2,
										cursor: 'pointer',
										color: 'var(--powder-600)',
										display: 'flex',
										alignItems: 'center',
										opacity: 0.6,
										transition: 'opacity 0.15s, color 0.15s',
									}}
									onMouseEnter={e => {
										e.currentTarget.style.opacity = '1';
										e.currentTarget.style.color = 'var(--terracotta-500)';
									}}
									onMouseLeave={e => {
										e.currentTarget.style.opacity = '0.6';
										e.currentTarget.style.color = 'var(--powder-600)';
									}}
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
								</button>
							</div>
						</div>
					);
				})}
			</div>
		</>
	);
}

function DocumentsSection() {
	const { documents } = useUploadStore();
	return (
		<div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
			<div
				style={{
					...MONO,
					fontSize: 9,
					letterSpacing: '0.15em',
					textTransform: 'uppercase',
					color: 'var(--powder-600)',
					opacity: 0.7,
					marginBottom: 10,
				}}
			>
				Knowledge Base
			</div>
			{documents.length === 0 && (
				<div style={{ fontSize: 12, color: 'var(--powder-600)', opacity: 0.6 }}>No documents</div>
			)}
			<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
				{documents.map(d => {
					const isPdf = d.name.toLowerCase().endsWith('.pdf');
					return (
						<div
							key={d.documentId}
							style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}
						>
							<div
								style={{
									width: 6,
									height: 6,
									borderRadius: 1,
									background: isPdf ? 'var(--terracotta-600)' : 'var(--cobalt-500)',
									flexShrink: 0,
								}}
							/>
							<span
								style={{
									fontFamily: 'inherit',
									fontSize: 12,
									color: 'var(--powder-300)',
									overflow: 'hidden',
									textOverflow: 'ellipsis',
									whiteSpace: 'nowrap',
								}}
							>
								{d.name}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function StatsSection() {
	const todayStats = useSidebarStore(s => s.todayStats);
	return (
		<div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
			<div
				style={{
					...MONO,
					fontSize: 9,
					letterSpacing: '0.15em',
					textTransform: 'uppercase',
					color: 'var(--powder-600)',
					opacity: 0.7,
					marginBottom: 10,
				}}
			>
				Today
			</div>
			{!todayStats && (
				<div style={{ fontSize: 12, color: 'var(--powder-600)', opacity: 0.6 }}>—</div>
			)}
			{todayStats &&
				[
					{ label: 'Requests', value: String(todayStats.requests) },
					{ label: 'Avg latency', value: `${todayStats.avgLatencyMs}ms` },
					{ label: 'Citation rate', value: `${Math.round(todayStats.citationRate * 100)}%` },
				].map(m => (
					<div
						key={m.label}
						style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}
					>
						<span style={{ fontFamily: 'inherit', fontSize: 12, color: 'var(--powder-400)' }}>
							{m.label}
						</span>
						<span style={{ ...MONO, fontSize: 12, color: 'var(--paper)', fontWeight: 500 }}>
							{m.value}
						</span>
					</div>
				))}
		</div>
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
		<div ref={wrapperRef} style={{ position: 'relative' }}>
			{open && (
				<div
					style={{
						position: 'absolute',
						bottom: 'calc(100% + 8px)',
						left: 0,
						right: 0,
						background: 'var(--cobalt-900)',
						border: '1px solid var(--cobalt-800)',
						borderRadius: 8,
						boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
						padding: 6,
						display: 'flex',
						flexDirection: 'column',
						gap: 2,
						zIndex: 50,
					}}
				>
					<Link
						href='/settings'
						onClick={() => setOpen(false)}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 10,
							padding: '8px 10px',
							borderRadius: 6,
							textDecoration: 'none',
							color: 'var(--powder-300)',
							transition: 'background 0.12s',
						}}
						onMouseEnter={e => (e.currentTarget.style.background = 'var(--cobalt-800)')}
						onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
						<span
							style={{
								...MONO,
								fontSize: 11,
								letterSpacing: '0.1em',
								textTransform: 'uppercase',
							}}
						>
							Settings
						</span>
					</Link>

					<div style={{ height: 1, background: 'var(--cobalt-800)', margin: '2px 4px' }} />

					<button
						onClick={() => {
							setOpen(false);
							void signOut({ callbackUrl: '/signin' });
						}}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 10,
							padding: '8px 10px',
							borderRadius: 6,
							background: 'transparent',
							border: 'none',
							cursor: 'pointer',
							color: 'var(--terracotta-500)',
							width: '100%',
							textAlign: 'left',
							transition: 'background 0.12s',
						}}
						onMouseEnter={e => (e.currentTarget.style.background = 'rgba(214,93,77,0.1)')}
						onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
						<span
							style={{
								...MONO,
								fontSize: 11,
								letterSpacing: '0.1em',
								textTransform: 'uppercase',
							}}
						>
							Sign out
						</span>
					</button>
				</div>
			)}

			<button
				onClick={() => setOpen(o => !o)}
				aria-haspopup='menu'
				aria-expanded={open}
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 10,
					width: '100%',
					padding: '8px 10px',
					background: open ? 'var(--cobalt-800)' : 'transparent',
					border: 'none',
					borderRadius: 7,
					cursor: 'pointer',
					textAlign: 'left',
					transition: 'background 0.12s',
				}}
				onMouseEnter={e => {
					if (!open) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
				}}
				onMouseLeave={e => {
					if (!open) e.currentTarget.style.background = 'transparent';
				}}
			>
				<div
					style={{
						width: 26,
						height: 26,
						borderRadius: '50%',
						background: 'var(--cobalt-700)',
						color: 'var(--paper)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						fontFamily: 'var(--font-fraunces), serif',
						fontSize: 13,
						fontWeight: 400,
						flexShrink: 0,
					}}
				>
					{initial}
				</div>
				<div style={{ flex: 1, minWidth: 0 }}>
					<div
						style={{
							...MONO,
							fontSize: 11,
							color: 'var(--paper)',
							letterSpacing: '0.02em',
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap',
						}}
					>
						{name}
					</div>
					<div
						style={{
							...MONO,
							fontSize: 9,
							color: 'var(--powder-600)',
							letterSpacing: '0.12em',
							textTransform: 'uppercase',
							marginTop: 2,
						}}
					>
						{role}
					</div>
				</div>
				<svg
					width='12'
					height='12'
					viewBox='0 0 24 24'
					fill='none'
					stroke='var(--powder-600)'
					strokeWidth='2'
					style={{
						flexShrink: 0,
						transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
						transition: 'transform 0.15s',
					}}
				>
					<polyline points='6 9 12 15 18 9' />
				</svg>
			</button>
		</div>
	);
}

export function Sidebar() {
	const pathname = usePathname();
	const { data: session } = useSession();

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
		<aside
			style={{
				width: 260,
				minWidth: 260,
				height: '100vh',
				background: 'var(--cobalt-950)',
				display: 'flex',
				flexDirection: 'column',
				overflow: 'hidden',
			}}
		>
			<div style={{ padding: '22px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
					<div
						style={{
							width: 8,
							height: 8,
							borderRadius: '50%',
							background: 'var(--terracotta-500)',
							animation: 'pulse-dot 2.5s ease-in-out infinite',
							flexShrink: 0,
						}}
					/>
					<span
						style={{
							fontFamily: 'var(--font-fraunces), serif',
							fontWeight: 300,
							fontSize: 20,
							color: 'var(--paper)',
							letterSpacing: '-0.01em',
						}}
					>
						RAG Chat
					</span>
				</div>

				<nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
					{NAV.map(item => {
						const isActive = item.id === activeId;
						return (
							<Link
								key={item.id}
								href={item.href}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: 10,
									padding: '8px 12px',
									borderRadius: 7,
									background: isActive ? 'var(--cobalt-800)' : 'transparent',
									color: isActive ? 'var(--paper)' : 'var(--powder-400)',
									textDecoration: 'none',
									fontFamily: 'inherit',
									fontSize: 13,
									fontWeight: isActive ? 500 : 400,
									borderLeft: isActive
										? '2px solid var(--terracotta-500)'
										: '2px solid transparent',
									transition: 'background 0.15s, color 0.15s',
								}}
							>
								{item.icon}
								{item.label}
							</Link>
						);
					})}
				</nav>
			</div>

			{activeId === 'chat' && <ChatSection />}
			{activeId === 'documents' && <DocumentsSection />}
			{activeId === 'stats' && (
				<>
					<StatsSection />
					<div style={{ flex: 1 }} />
				</>
			)}

			<div style={{ borderTop: '1px solid var(--cobalt-800)', padding: '10px 12px' }}>
				{session?.user && (
					<UserMenu
						name={session.user.name ?? session.user.email ?? 'User'}
						role={session.user.role?.toLowerCase() ?? 'user'}
					/>
				)}
			</div>
		</aside>
	);
}
