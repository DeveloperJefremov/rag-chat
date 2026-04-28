'use client';
import clsx from 'clsx';
import { useEffect } from 'react';

interface ConfirmDialogProps {
	open: boolean;
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	tone?: 'danger' | 'neutral';
	onConfirm: () => void;
	onCancel: () => void;
}

export function ConfirmDialog({
	open,
	title,
	message,
	confirmLabel = 'Confirm',
	cancelLabel = 'Cancel',
	tone = 'danger',
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onCancel();
			if (e.key === 'Enter') onConfirm();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [open, onCancel, onConfirm]);

	if (!open) return null;

	const isDanger = tone === 'danger';

	return (
		<div
			role='dialog'
			aria-modal='true'
			aria-labelledby='confirm-dialog-title'
			onClick={onCancel}
			className='fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(10,14,26,0.62)] p-6 backdrop-blur-[4px]'
		>
			<div
				onClick={e => e.stopPropagation()}
				className='border-powder-200 bg-paper w-full max-w-[420px] rounded-[12px] border p-7 shadow-[0_24px_64px_-16px_rgba(10,14,26,0.4)]'
			>
				<div className='mb-3.5 flex items-center gap-2.5'>
					<div
						className={clsx(
							'h-2 w-2 flex-shrink-0 rounded-full',
							isDanger ? 'bg-terracotta-500' : 'bg-cobalt-700',
						)}
					/>
					<h2
						id='confirm-dialog-title'
						className='text-cobalt-900 m-0 font-serif text-[20px] font-light tracking-[-0.01em]'
					>
						{title}
					</h2>
				</div>

				<p className='text-cobalt-700 mb-6 text-sm leading-[1.55]'>{message}</p>

				<div className='flex justify-end gap-2.5'>
					<button
						type='button'
						onClick={onCancel}
						className='border-powder-300 text-cobalt-700 hover:bg-sand hover:border-cobalt-700 cursor-pointer rounded-md border bg-transparent px-[18px] py-2 font-mono text-[11px] tracking-[0.12em] uppercase transition-colors'
					>
						{cancelLabel}
					</button>
					<button
						type='button'
						onClick={onConfirm}
						autoFocus
						className={clsx(
							'text-paper cursor-pointer rounded-md border px-[18px] py-2 font-mono text-[11px] tracking-[0.12em] uppercase transition-colors',
							isDanger
								? 'border-terracotta-500 bg-terracotta-500 hover:bg-terracotta-600 hover:border-terracotta-600'
								: 'border-cobalt-700 bg-cobalt-700 hover:bg-cobalt-800 hover:border-cobalt-800',
						)}
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>
	);
}
