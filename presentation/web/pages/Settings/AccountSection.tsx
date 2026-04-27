'use client';
import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { ConfirmDialog } from '@/presentation/web/components/ConfirmDialog';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono), monospace' };
const SERIF: React.CSSProperties = { fontFamily: 'var(--font-fraunces), serif' };

export function AccountSection() {
	const { data: session } = useSession();
	const user = session?.user;

	const [emailInput, setEmailInput] = useState('');
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!user) return null;

	const emailMatches = emailInput.trim().toLowerCase() === user.email?.toLowerCase();

	const handleDelete = async () => {
		setConfirmOpen(false);
		setDeleting(true);
		setError(null);
		try {
			const res = await fetch('/api/account', { method: 'DELETE' });
			if (!res.ok) throw new Error('failed');
			await signOut({ callbackUrl: '/signin' });
		} catch {
			setError('Could not delete account. Please try again.');
			setDeleting(false);
		}
	};

	return (
		<section id='account' style={{ marginBottom: 56, scrollMarginTop: 24 }}>
			<header style={{ marginBottom: 20 }}>
				<h2
					style={{
						...SERIF,
						fontStyle: 'italic',
						fontWeight: 300,
						fontSize: 26,
						color: 'var(--cobalt-900)',
						letterSpacing: '-0.01em',
						margin: 0,
					}}
				>
					Account
				</h2>
				<div
					style={{
						...MONO,
						fontSize: 10,
						color: 'var(--smoke)',
						letterSpacing: '0.12em',
						textTransform: 'uppercase',
						marginTop: 4,
					}}
				>
					Profile · Danger zone
				</div>
			</header>

			{/* Profile card */}
			<div
				style={{
					border: '1px solid var(--powder-200)',
					borderRadius: 10,
					padding: 20,
					background: 'var(--paper)',
					display: 'flex',
					alignItems: 'center',
					gap: 18,
					marginBottom: 28,
				}}
			>
				<div
					style={{
						width: 56,
						height: 56,
						borderRadius: '50%',
						background: 'var(--cobalt-700)',
						color: 'var(--paper)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						...SERIF,
						fontSize: 22,
						fontWeight: 400,
						overflow: 'hidden',
						flexShrink: 0,
					}}
				>
					{user.image ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={user.image}
							alt=''
							style={{ width: '100%', height: '100%', objectFit: 'cover' }}
						/>
					) : (
						(user.name?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()
					)}
				</div>
				<div style={{ flex: 1, minWidth: 0 }}>
					<div
						style={{
							fontSize: 15,
							fontWeight: 500,
							color: 'var(--cobalt-900)',
							marginBottom: 2,
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap',
						}}
					>
						{user.name ?? '—'}
					</div>
					<div
						style={{
							fontSize: 13,
							color: 'var(--smoke)',
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap',
						}}
					>
						{user.email}
					</div>
				</div>
				<div
					style={{
						...MONO,
						fontSize: 10,
						letterSpacing: '0.14em',
						textTransform: 'uppercase',
						padding: '4px 10px',
						borderRadius: 6,
						background: user.role === 'ADMIN' ? 'rgba(214,93,77,0.12)' : 'var(--sand)',
						color: user.role === 'ADMIN' ? 'var(--terracotta-600)' : 'var(--cobalt-700)',
						border:
							user.role === 'ADMIN'
								? '1px solid rgba(214,93,77,0.25)'
								: '1px solid var(--powder-300)',
						flexShrink: 0,
					}}
				>
					{user.role}
				</div>
			</div>

			{/* Danger zone */}
			<div
				style={{
					border: '1px solid rgba(214,93,77,0.35)',
					borderRadius: 10,
					padding: 20,
					background: 'rgba(214,93,77,0.04)',
				}}
			>
				<div
					style={{
						...MONO,
						fontSize: 10,
						letterSpacing: '0.16em',
						textTransform: 'uppercase',
						color: 'var(--terracotta-600)',
						marginBottom: 8,
					}}
				>
					Danger zone
				</div>
				<div
					style={{
						fontSize: 14,
						fontWeight: 500,
						color: 'var(--cobalt-900)',
						marginBottom: 6,
					}}
				>
					Delete account
				</div>
				<p
					style={{
						margin: 0,
						fontSize: 13,
						lineHeight: 1.55,
						color: 'var(--cobalt-700)',
						marginBottom: 14,
					}}
				>
					Permanently delete your account, all chat sessions, documents, messages, and per-query
					logs. Aggregate platform usage stats are preserved anonymously. This action cannot be
					undone.
				</p>

				<label
					style={{
						display: 'block',
						fontSize: 12,
						color: 'var(--smoke)',
						marginBottom: 6,
					}}
				>
					Type <span style={{ ...MONO, color: 'var(--cobalt-800)' }}>{user.email}</span> to enable
					deletion:
				</label>
				<input
					type='text'
					value={emailInput}
					onChange={e => setEmailInput(e.target.value)}
					placeholder={user.email ?? ''}
					autoComplete='off'
					disabled={deleting}
					style={{
						width: '100%',
						maxWidth: 360,
						padding: '8px 12px',
						fontFamily: 'inherit',
						fontSize: 13,
						color: 'var(--cobalt-900)',
						background: 'var(--paper)',
						border: '1px solid var(--powder-300)',
						borderRadius: 7,
						outline: 'none',
						marginBottom: 14,
					}}
				/>

				<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
					<button
						onClick={() => setConfirmOpen(true)}
						disabled={!emailMatches || deleting}
						style={{
							...MONO,
							padding: '9px 18px',
							fontSize: 11,
							letterSpacing: '0.12em',
							textTransform: 'uppercase',
							background: emailMatches && !deleting ? 'var(--terracotta-500)' : 'var(--powder-200)',
							color: emailMatches && !deleting ? 'var(--paper)' : 'var(--smoke)',
							border: `1px solid ${
								emailMatches && !deleting ? 'var(--terracotta-500)' : 'var(--powder-300)'
							}`,
							borderRadius: 7,
							cursor: emailMatches && !deleting ? 'pointer' : 'not-allowed',
							transition: 'background 0.15s',
						}}
					>
						{deleting ? 'Deleting…' : 'Delete account'}
					</button>
					{error && (
						<span
							style={{
								...MONO,
								fontSize: 11,
								color: 'var(--terracotta-600)',
							}}
						>
							{error}
						</span>
					)}
				</div>
			</div>

			<ConfirmDialog
				open={confirmOpen}
				title='Delete account?'
				message='This will permanently remove your profile, chats, documents, and message logs. There is no recovery.'
				confirmLabel='Delete forever'
				cancelLabel='Cancel'
				tone='danger'
				onConfirm={handleDelete}
				onCancel={() => setConfirmOpen(false)}
			/>
		</section>
	);
}
