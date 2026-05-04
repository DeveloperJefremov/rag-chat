import Link from 'next/link';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono), monospace' };
const SERIF: React.CSSProperties = { fontFamily: 'var(--font-fraunces), serif' };

export default function NotFound() {
	return (
		<div
			style={{
				position: 'relative',
				width: '100%',
				height: '100%',
				background: 'var(--cobalt-950)',
				color: 'var(--paper)',
				overflow: 'hidden',
				display: 'flex',
				flexDirection: 'column',
			}}
		>
			{/* Top status bar */}
			<div
				style={{
					padding: '22px 32px',
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					borderBottom: '1px solid rgba(255,255,255,0.06)',
					flexShrink: 0,
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
					<div
						style={{
							width: 8,
							height: 8,
							borderRadius: '50%',
							background: 'var(--terracotta-500)',
							animation: 'pulse-dot 2.5s ease-in-out infinite',
						}}
					/>
					<span
						style={{
							...MONO,
							fontSize: 10,
							letterSpacing: '0.18em',
							textTransform: 'uppercase',
							color: 'var(--powder-400)',
						}}
					>
						SYSTEM · ERROR
					</span>
				</div>
				<span
					style={{
						...MONO,
						fontSize: 10,
						letterSpacing: '0.18em',
						textTransform: 'uppercase',
						color: 'var(--powder-600)',
					}}
				>
					STATUS_CODE / 404
				</span>
			</div>

			{/* Stage */}
			<div
				style={{
					flex: 1,
					position: 'relative',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					overflow: 'hidden',
				}}
			>
				{/* Background brutalist numerals */}
				<div
					aria-hidden
					style={{
						position: 'absolute',
						inset: 0,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						pointerEvents: 'none',
					}}
				>
					<div
						style={{
							...SERIF,
							fontStyle: 'italic',
							fontWeight: 300,
							fontSize: 'clamp(280px, 48vw, 620px)',
							lineHeight: 0.85,
							letterSpacing: '-0.06em',
							color: 'transparent',
							WebkitTextStroke: '1px var(--cobalt-800)',
							userSelect: 'none',
							whiteSpace: 'nowrap',
						}}
					>
						404
					</div>
				</div>

				{/* Diagonal terracotta accent */}
				<div
					aria-hidden
					style={{
						position: 'absolute',
						top: '50%',
						left: 0,
						right: 0,
						height: 1,
						background:
							'linear-gradient(90deg, transparent 0%, var(--terracotta-500) 50%, transparent 100%)',
						opacity: 0.35,
						transform: 'translateY(-50%) rotate(-4deg) scaleX(1.2)',
						pointerEvents: 'none',
					}}
				/>

				{/* Foreground content */}
				<div
					style={{
						position: 'relative',
						zIndex: 1,
						maxWidth: 560,
						padding: '0 32px',
						textAlign: 'center',
						animation: 'slide-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both',
					}}
				>
					<div
						style={{
							...MONO,
							fontSize: 10,
							letterSpacing: '0.22em',
							textTransform: 'uppercase',
							color: 'var(--terracotta-500)',
							marginBottom: 18,
						}}
					>
						— No document indexed at this route —
					</div>

					<h1
						style={{
							...SERIF,
							fontStyle: 'italic',
							fontWeight: 300,
							fontSize: 'clamp(48px, 7vw, 84px)',
							lineHeight: 1.05,
							letterSpacing: '-0.03em',
							color: 'var(--paper)',
							marginBottom: 18,
						}}
					>
						Page not found
					</h1>

					<p
						style={{
							fontSize: 14,
							lineHeight: 1.65,
							color: 'var(--powder-400)',
							marginBottom: 30,
							maxWidth: 440,
							marginLeft: 'auto',
							marginRight: 'auto',
						}}
					>
						The retrieval pipeline returned zero results for this URL. The page may have moved, or
						you may have followed a stale link.
					</p>

					<div
						style={{
							display: 'flex',
							gap: 12,
							justifyContent: 'center',
							flexWrap: 'wrap',
						}}
					>
						<Link
							href='/'
							style={{
								padding: '12px 22px',
								background: 'var(--terracotta-500)',
								color: 'var(--paper)',
								border: '1px solid var(--terracotta-500)',
								borderRadius: 8,
								fontFamily: 'inherit',
								fontSize: 13,
								fontWeight: 500,
								textDecoration: 'none',
								display: 'inline-flex',
								alignItems: 'center',
								gap: 8,
								transition: 'background 0.15s, transform 0.15s',
							}}
						>
							<svg
								width='14'
								height='14'
								viewBox='0 0 24 24'
								fill='none'
								stroke='currentColor'
								strokeWidth='2'
							>
								<line x1='19' y1='12' x2='5' y2='12' />
								<polyline points='12 19 5 12 12 5' />
							</svg>
							Back to chat
						</Link>
						<Link
							href='/documents'
							style={{
								padding: '12px 22px',
								background: 'transparent',
								color: 'var(--powder-300)',
								border: '1px solid var(--cobalt-700)',
								borderRadius: 8,
								fontFamily: 'inherit',
								fontSize: 13,
								fontWeight: 500,
								textDecoration: 'none',
								display: 'inline-flex',
								alignItems: 'center',
								gap: 8,
								transition: 'background 0.15s',
							}}
						>
							Browse documents
						</Link>
					</div>
				</div>
			</div>

			{/* Bottom strip */}
			<div
				style={{
					padding: '16px 32px',
					borderTop: '1px solid rgba(255,255,255,0.06)',
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					flexShrink: 0,
					gap: 16,
					flexWrap: 'wrap',
				}}
			>
				<span
					style={{
						...MONO,
						fontSize: 9,
						letterSpacing: '0.18em',
						textTransform: 'uppercase',
						color: 'var(--powder-600)',
					}}
				>
					RAG_CHAT · KNOWLEDGE_ASSISTANT
				</span>
				<span
					style={{
						...MONO,
						fontSize: 9,
						letterSpacing: '0.18em',
						textTransform: 'uppercase',
						color: 'var(--powder-600)',
					}}
				>
					trace_id / req_404_no_match
				</span>
			</div>
		</div>
	);
}
