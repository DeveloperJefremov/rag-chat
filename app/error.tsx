'use client';
import { useEffect } from 'react';

export default function Error({
	error,
	unstable_retry,
}: {
	error: Error & { digest?: string };
	unstable_retry: () => void;
}) {
	useEffect(() => {
		console.error('[route-error]', error);
	}, [error]);

	return (
		<div className='bg-paper flex h-full w-full items-center justify-center px-6 py-10'>
			<div className='border-powder-200 bg-paper w-full max-w-md rounded-[10px] border p-6 text-center'>
				<div className='text-terracotta-600 mb-3 font-mono text-[10px] tracking-[0.16em] uppercase'>
					Something went wrong
				</div>
				<h2 className='text-cobalt-900 mb-2 font-serif text-2xl font-light italic'>
					This view crashed
				</h2>
				<p className='text-smoke mb-5 text-[13px] leading-[1.55]'>
					{error.message || 'An unexpected error occurred while rendering this page.'}
					{error.digest && (
						<>
							<br />
							<span className='font-mono text-[11px]'>ref: {error.digest}</span>
						</>
					)}
				</p>
				<button
					type='button'
					onClick={() => unstable_retry()}
					className='bg-cobalt-900 text-paper hover:bg-cobalt-800 rounded-md px-4 py-2 text-[13px] font-medium transition-colors'
				>
					Try again
				</button>
			</div>
		</div>
	);
}
