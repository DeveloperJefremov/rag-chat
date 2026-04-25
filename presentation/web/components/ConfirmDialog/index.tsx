'use client';
import { useEffect } from 'react';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono), monospace' };

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

	const accent = tone === 'danger' ? 'var(--terracotta-500)' : 'var(--cobalt-700)';
	const accentHover = tone === 'danger' ? 'var(--terracotta-600)' : 'var(--cobalt-800)';

	return (
		<div
			role='dialog'
			aria-modal='true'
			aria-labelledby='confirm-dialog-title'
			onClick={onCancel}
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 1000,
				background: 'rgba(10, 14, 26, 0.62)',
				backdropFilter: 'blur(4px)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				padding: 24,
				animation: 'confirm-fade-in 0.18s ease-out',
			}}
		>
			<div
				onClick={e => e.stopPropagation()}
				style={{
					background: 'var(--paper)',
					border: '1px solid var(--powder-200)',
					borderRadius: 12,
					boxShadow: '0 24px 64px -16px rgba(10, 14, 26, 0.4)',
					maxWidth: 420,
					width: '100%',
					padding: 28,
					animation: 'confirm-slide-up 0.22s ease-out',
				}}
			>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 10,
						marginBottom: 14,
					}}
				>
					<div
						style={{
							width: 8,
							height: 8,
							borderRadius: '50%',
							background: accent,
							flexShrink: 0,
						}}
					/>
					<h2
						id='confirm-dialog-title'
						style={{
							margin: 0,
							fontFamily: 'var(--font-fraunces), serif',
							fontWeight: 300,
							fontSize: 20,
							color: 'var(--cobalt-900)',
							letterSpacing: '-0.01em',
						}}
					>
						{title}
					</h2>
				</div>

				<p
					style={{
						margin: '0 0 24px',
						fontFamily: 'inherit',
						fontSize: 14,
						lineHeight: 1.55,
						color: 'var(--cobalt-700)',
					}}
				>
					{message}
				</p>

				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
					<button
						onClick={onCancel}
						style={{
							...MONO,
							padding: '8px 18px',
							fontSize: 11,
							letterSpacing: '0.12em',
							textTransform: 'uppercase',
							background: 'transparent',
							border: '1px solid var(--powder-300)',
							borderRadius: 7,
							color: 'var(--cobalt-700)',
							cursor: 'pointer',
							transition: 'background 0.15s, border-color 0.15s',
						}}
						onMouseEnter={e => {
							e.currentTarget.style.background = 'var(--sand)';
							e.currentTarget.style.borderColor = 'var(--cobalt-700)';
						}}
						onMouseLeave={e => {
							e.currentTarget.style.background = 'transparent';
							e.currentTarget.style.borderColor = 'var(--powder-300)';
						}}
					>
						{cancelLabel}
					</button>
					<button
						onClick={onConfirm}
						autoFocus
						style={{
							...MONO,
							padding: '8px 18px',
							fontSize: 11,
							letterSpacing: '0.12em',
							textTransform: 'uppercase',
							background: accent,
							border: `1px solid ${accent}`,
							borderRadius: 7,
							color: 'var(--paper)',
							cursor: 'pointer',
							transition: 'background 0.15s, border-color 0.15s',
						}}
						onMouseEnter={e => {
							e.currentTarget.style.background = accentHover;
							e.currentTarget.style.borderColor = accentHover;
						}}
						onMouseLeave={e => {
							e.currentTarget.style.background = accent;
							e.currentTarget.style.borderColor = accent;
						}}
					>
						{confirmLabel}
					</button>
				</div>
			</div>

			<style>{`
				@keyframes confirm-fade-in {
					from { opacity: 0; }
					to { opacity: 1; }
				}
				@keyframes confirm-slide-up {
					from { transform: translateY(8px); opacity: 0; }
					to { transform: translateY(0); opacity: 1; }
				}
			`}</style>
		</div>
	);
}
