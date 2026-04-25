import { signIn } from '@/auth';
import { Aurora } from '@/presentation/web/components/Aurora';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono), monospace' };
const SERIF: React.CSSProperties = { fontFamily: 'var(--font-fraunces), serif' };

export default function SignInPage() {
	return (
		<div
			style={{
				position: 'relative',
				width: '100%',
				height: '100vh',
				background: 'var(--cobalt-950)',
				overflow: 'hidden',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
			}}
		>
			{/* Aurora WebGL backdrop */}
			<div style={{ position: 'absolute', inset: 0 }}>
				<Aurora
					colorStops={['#e06b38', '#4b6cb7', '#c85a2c']}
					amplitude={1.6}
					blend={0.18}
					speed={0.9}
				/>
			</div>

			{/* Subtle vignette only at edges so the aurora stays vivid */}
			<div
				style={{
					position: 'absolute',
					inset: 0,
					background:
						'radial-gradient(ellipse at center, rgba(10,20,40,0) 40%, rgba(10,20,40,0.45) 100%)',
					pointerEvents: 'none',
				}}
			/>

			{/* Card */}
			<div
				style={{
					position: 'relative',
					width: '100%',
					maxWidth: 380,
					padding: '36px 32px 32px',
					margin: '0 24px',
					background: 'var(--paper)',
					borderRadius: 14,
					border: '1px solid var(--powder-200)',
					boxShadow: '0 24px 60px -20px rgba(10, 20, 40, 0.55)',
					animation: 'slide-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both',
				}}
			>
				{/* Brand line */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 10,
						marginBottom: 24,
					}}
				>
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
							...SERIF,
							fontWeight: 300,
							fontSize: 18,
							color: 'var(--cobalt-800)',
							letterSpacing: '-0.01em',
						}}
					>
						RAG Chat
					</span>
				</div>

				{/* Heading */}
				<h1
					style={{
						...SERIF,
						fontWeight: 300,
						fontStyle: 'italic',
						fontSize: 30,
						lineHeight: 1.15,
						color: 'var(--cobalt-800)',
						letterSpacing: '-0.02em',
						marginBottom: 10,
					}}
				>
					Welcome back
				</h1>
				<p
					style={{
						fontSize: 13,
						lineHeight: 1.55,
						color: 'var(--smoke)',
						marginBottom: 28,
					}}
				>
					Sign in to chat with your documents — grounded answers, with citations, from your own
					knowledge base.
				</p>

				{/* Section label */}
				<div
					style={{
						...MONO,
						fontSize: 9,
						letterSpacing: '0.18em',
						textTransform: 'uppercase',
						color: 'var(--smoke)',
						marginBottom: 10,
					}}
				>
					Continue with
				</div>

				{/* Google sign-in */}
				<form
					action={async () => {
						'use server';
						await signIn('google', { redirectTo: '/' });
					}}
				>
					<button
						type='submit'
						style={{
							width: '100%',
							padding: '12px 16px',
							background: 'var(--cobalt-900)',
							color: 'var(--paper)',
							border: '1px solid var(--cobalt-800)',
							borderRadius: 8,
							fontFamily: 'inherit',
							fontSize: 13,
							fontWeight: 500,
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							gap: 10,
							transition: 'background 0.15s, transform 0.15s',
						}}
					>
						<svg width='16' height='16' viewBox='0 0 24 24' aria-hidden='true'>
							<path
								d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
								fill='#4285F4'
							/>
							<path
								d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
								fill='#34A853'
							/>
							<path
								d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
								fill='#FBBC05'
							/>
							<path
								d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
								fill='#EA4335'
							/>
						</svg>
						Continue with Google
					</button>
				</form>

				{/* Footer caption */}
				<div
					style={{
						marginTop: 22,
						paddingTop: 18,
						borderTop: '1px solid var(--powder-200)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						gap: 12,
					}}
				>
					<span
						style={{
							...MONO,
							fontSize: 9,
							letterSpacing: '0.15em',
							textTransform: 'uppercase',
							color: 'var(--smoke)',
						}}
					>
						Secured by OAuth
					</span>
					<span
						style={{
							...MONO,
							fontSize: 9,
							letterSpacing: '0.15em',
							textTransform: 'uppercase',
							color: 'var(--powder-600)',
						}}
					>
						v1.0
					</span>
				</div>
			</div>
		</div>
	);
}
