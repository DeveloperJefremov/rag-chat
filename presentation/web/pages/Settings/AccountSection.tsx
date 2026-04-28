'use client';
import clsx from 'clsx';
import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { ConfirmDialog } from '@/presentation/web/components/ConfirmDialog';

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
		<section id='account' className='scroll-mt-6'>
			<header className='mb-5'>
				<h2 className='text-cobalt-900 desk:text-[26px] m-0 font-serif text-2xl font-light tracking-[-0.01em] italic'>
					Account
				</h2>
				<div className='text-smoke mt-1 font-mono text-[10px] tracking-[0.12em] uppercase'>
					Profile · Danger zone
				</div>
			</header>

			<div className='border-powder-200 bg-paper mb-7 flex flex-wrap items-center gap-4 rounded-[10px] border p-5'>
				<div className='bg-cobalt-700 text-paper flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full font-serif text-[22px]'>
					{user.image ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={user.image} alt='' className='h-full w-full object-cover' />
					) : (
						(user.name?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()
					)}
				</div>
				<div className='min-w-0 flex-1'>
					<div className='text-cobalt-900 mb-0.5 truncate text-[15px] font-medium'>
						{user.name ?? '—'}
					</div>
					<div className='text-smoke truncate text-[13px]'>{user.email}</div>
				</div>
				<div
					className={clsx(
						'flex-shrink-0 rounded-md border px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] uppercase',
						user.role === 'ADMIN'
							? 'border-terracotta-500/25 bg-terracotta-500/[0.12] text-terracotta-600'
							: 'border-powder-300 bg-sand text-cobalt-700',
					)}
				>
					{user.role}
				</div>
			</div>

			<div className='border-terracotta-500/35 bg-terracotta-500/[0.04] rounded-[10px] border p-5'>
				<div className='text-terracotta-600 mb-2 font-mono text-[10px] tracking-[0.16em] uppercase'>
					Danger zone
				</div>
				<div className='text-cobalt-900 mb-1.5 text-sm font-medium'>Delete account</div>
				<p className='text-cobalt-700 m-0 mb-3.5 text-[13px] leading-[1.55]'>
					Permanently delete your account, all chat sessions, documents, messages, and per-query
					logs. Aggregate platform usage stats are preserved anonymously. This action cannot be
					undone.
				</p>

				<label className='text-smoke mb-1.5 block text-xs'>
					Type <span className='text-cobalt-800 font-mono'>{user.email}</span> to enable deletion:
				</label>
				<input
					type='text'
					value={emailInput}
					onChange={e => setEmailInput(e.target.value)}
					placeholder={user.email ?? ''}
					autoComplete='off'
					disabled={deleting}
					className='border-powder-300 bg-paper text-cobalt-900 focus:border-cobalt-700 mb-3.5 w-full max-w-[360px] rounded-md border px-3 py-2 text-[13px] outline-none disabled:opacity-50'
				/>

				<div className='flex flex-wrap items-center gap-3'>
					<button
						type='button'
						onClick={() => setConfirmOpen(true)}
						disabled={!emailMatches || deleting}
						className={clsx(
							'rounded-md border px-[18px] py-2.5 font-mono text-[11px] tracking-[0.12em] uppercase transition-colors',
							emailMatches && !deleting
								? 'border-terracotta-500 bg-terracotta-500 text-paper hover:bg-terracotta-600 hover:border-terracotta-600 cursor-pointer'
								: 'border-powder-300 bg-powder-200 text-smoke cursor-not-allowed',
						)}
					>
						{deleting ? 'Deleting…' : 'Delete account'}
					</button>
					{error && <span className='text-terracotta-600 font-mono text-[11px]'>{error}</span>}
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
