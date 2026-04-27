'use client';
import { useEffect, useState } from 'react';
import { AccountSection } from './AccountSection';
import { RetrievalSection } from './RetrievalSection';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono), monospace' };
const SERIF: React.CSSProperties = { fontFamily: 'var(--font-fraunces), serif' };

const SECTIONS: Array<{ id: string; label: string }> = [
	{ id: 'account', label: 'Account' },
	{ id: 'retrieval', label: 'Retrieval' },
];

export function SettingsPage() {
	const [activeId, setActiveId] = useState<string>('account');

	useEffect(() => {
		const scroller = document.getElementById('settings-scroll');
		if (!scroller) return;
		const elements = SECTIONS.map(s => document.getElementById(s.id)).filter(
			(el): el is HTMLElement => el !== null,
		);
		if (!elements.length) return;

		const observer = new IntersectionObserver(
			entries => {
				const visible = entries
					.filter(e => e.isIntersecting)
					.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
				if (visible[0]) setActiveId(visible[0].target.id);
			},
			{ root: scroller, rootMargin: '-20% 0px -60% 0px', threshold: 0 },
		);
		elements.forEach(el => observer.observe(el));
		return () => observer.disconnect();
	}, []);

	const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
		e.preventDefault();
		setActiveId(id);
		const target = document.getElementById(id);
		target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

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
				}}
			>
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

			{/* Body: nav + content */}
			<div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
				{/* Anchor nav */}
				<aside
					style={{
						width: 200,
						minWidth: 200,
						padding: '24px 16px 24px 28px',
						borderRight: '1px solid var(--powder-200)',
						flexShrink: 0,
					}}
				>
					<div
						style={{
							...MONO,
							fontSize: 9,
							color: 'var(--smoke)',
							letterSpacing: '0.18em',
							textTransform: 'uppercase',
							marginBottom: 12,
							opacity: 0.7,
						}}
					>
						On this page
					</div>
					<nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
						{SECTIONS.map(s => {
							const active = activeId === s.id;
							return (
								<a
									key={s.id}
									href={`#${s.id}`}
									onClick={e => handleNavClick(e, s.id)}
									style={{
										display: 'block',
										padding: '7px 12px',
										borderRadius: 7,
										borderLeft: active
											? '2px solid var(--terracotta-500)'
											: '2px solid transparent',
										fontFamily: 'inherit',
										fontSize: 13,
										color: active ? 'var(--cobalt-900)' : 'var(--smoke)',
										fontWeight: active ? 500 : 400,
										background: active ? 'var(--sand)' : 'transparent',
										textDecoration: 'none',
										transition: 'all 0.15s',
									}}
								>
									{s.label}
								</a>
							);
						})}
					</nav>
				</aside>

				{/* Scrollable content */}
				<div
					id='settings-scroll'
					style={{
						flex: 1,
						overflowY: 'auto',
						padding: '32px 48px 80px',
					}}
				>
					<div style={{ maxWidth: 720 }}>
						<AccountSection />
						<RetrievalSection />
					</div>
				</div>
			</div>
		</div>
	);
}
