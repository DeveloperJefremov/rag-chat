'use client';
import clsx from 'clsx';
import { Toast, useToastStore } from '@/client/stores/toastStore';

const TONE_STYLE: Record<Toast['tone'], string> = {
	error: 'border-terracotta-500/40 bg-terracotta-500/[0.08] text-terracotta-700',
	success: 'border-[#2d8a4e]/35 bg-[rgba(45,138,78,0.08)] text-[#2d8a4e]',
	info: 'border-cobalt-700/30 bg-cobalt-700/[0.06] text-cobalt-800',
};

const TONE_DOT: Record<Toast['tone'], string> = {
	error: 'bg-terracotta-500',
	success: 'bg-[#2d8a4e]',
	info: 'bg-cobalt-700',
};

export function Toaster() {
	const toasts = useToastStore(s => s.toasts);
	const dismiss = useToastStore(s => s.dismiss);

	return (
		<div
			aria-live='polite'
			aria-atomic='false'
			className='pointer-events-none fixed right-4 bottom-4 z-[1000] flex w-full max-w-sm flex-col gap-2'
		>
			{toasts.map(t => (
				<div
					key={t.id}
					role={t.tone === 'error' ? 'alert' : 'status'}
					className={clsx(
						'bg-paper pointer-events-auto animate-[fade-up_0.25s_ease_both] rounded-lg border p-3 shadow-[0_12px_32px_-12px_rgba(10,20,40,0.25)]',
						TONE_STYLE[t.tone],
					)}
				>
					<div className='flex items-start gap-2.5'>
						<span
							className={clsx('mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full', TONE_DOT[t.tone])}
						/>
						<div className='min-w-0 flex-1'>
							<div className='text-cobalt-900 text-[13px] leading-tight font-medium'>{t.title}</div>
							{t.description && (
								<div className='text-smoke mt-1 text-[12px] leading-[1.45]'>{t.description}</div>
							)}
						</div>
						<button
							type='button'
							onClick={() => dismiss(t.id)}
							aria-label='Dismiss'
							className='text-smoke hover:text-cobalt-800 -mt-1 -mr-1 flex-shrink-0 rounded p-1 transition-colors'
						>
							<svg
								width='12'
								height='12'
								viewBox='0 0 24 24'
								fill='none'
								stroke='currentColor'
								strokeWidth='2'
							>
								<line x1='18' y1='6' x2='6' y2='18' />
								<line x1='6' y1='6' x2='18' y2='18' />
							</svg>
						</button>
					</div>
				</div>
			))}
		</div>
	);
}
