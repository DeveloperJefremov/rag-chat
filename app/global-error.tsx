'use client';
import { useEffect } from 'react';

export default function GlobalError({
	error,
	unstable_retry,
}: {
	error: Error & { digest?: string };
	unstable_retry: () => void;
}) {
	useEffect(() => {
		console.error('[global-error]', error);
	}, [error]);

	return (
		<html lang='en'>
			<body
				style={{
					minHeight: '100vh',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					padding: '24px',
					fontFamily: 'system-ui, sans-serif',
					background: '#f4f1ec',
					color: '#0a1428',
				}}
			>
				<div
					style={{
						maxWidth: 420,
						width: '100%',
						padding: 24,
						borderRadius: 10,
						border: '1px solid rgba(10,20,40,0.1)',
						background: '#fff',
						textAlign: 'center',
					}}
				>
					<div
						style={{
							fontSize: 10,
							letterSpacing: '0.16em',
							textTransform: 'uppercase',
							color: '#c85a2c',
							marginBottom: 12,
						}}
					>
						Application error
					</div>
					<h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 400 }}>The app crashed</h2>
					<p style={{ fontSize: 13, lineHeight: 1.55, color: '#555', margin: '0 0 20px' }}>
						{error.message || 'A fatal error occurred. Please try reloading.'}
						{error.digest && (
							<>
								<br />
								<span style={{ fontFamily: 'monospace', fontSize: 11 }}>ref: {error.digest}</span>
							</>
						)}
					</p>
					<button
						type='button'
						onClick={() => unstable_retry()}
						style={{
							padding: '8px 16px',
							borderRadius: 6,
							border: 'none',
							background: '#0a1f4f',
							color: '#fff',
							fontSize: 13,
							cursor: 'pointer',
						}}
					>
						Try again
					</button>
				</div>
			</body>
		</html>
	);
}
