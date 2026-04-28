'use client';
import { MobileMenuButton } from '@/presentation/web/components/MobileMenuButton';
import { AccountSection } from './AccountSection';
import { RetrievalSection } from './RetrievalSection';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono), monospace' };
const SERIF: React.CSSProperties = { fontFamily: 'var(--font-fraunces), serif' };

export function SettingsPage() {
	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				overflow: 'hidden',
				background: 'var(--paper)',
			}}
		>
			{/* Header */}
			<div
				style={{
					padding: '18px 28px',
					borderBottom: '1px solid var(--powder-200)',
					flexShrink: 0,
					display: 'flex',
					alignItems: 'center',
					gap: 12,
				}}
			>
				<MobileMenuButton />
				<div>
					<h1
						style={{
							...SERIF,
							fontWeight: 300,
							fontStyle: 'italic',
							fontSize: 22,
							color: 'var(--cobalt-800)',
							letterSpacing: '-0.01em',
							margin: 0,
						}}
					>
						Settings
					</h1>
					<div
						style={{
							...MONO,
							fontSize: 10,
							color: 'var(--smoke)',
							letterSpacing: '0.1em',
							textTransform: 'uppercase',
							marginTop: 2,
						}}
					>
						Account · Retrieval defaults
					</div>
				</div>
			</div>

			{/* Scrollable content */}
			<div
				style={{
					flex: 1,
					overflowY: 'auto',
					padding: '32px 48px 80px',
				}}
			>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
						gap: 32,
						alignItems: 'start',
						maxWidth: 1400,
						margin: '0 auto',
					}}
				>
					<AccountSection />
					<RetrievalSection />
				</div>
			</div>
		</div>
	);
}
