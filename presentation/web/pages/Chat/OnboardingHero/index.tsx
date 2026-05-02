'use client';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

const STEPS: Array<{ n: string; title: string; body: string }> = [
	{
		n: '01',
		title: 'Upload a document',
		body: 'PDF, TXT, or DOCX — up to 10 MB. We index it locally on Neon, never sent anywhere else.',
	},
	{
		n: '02',
		title: 'Pick a chunking strategy',
		body: 'Recursive is the safe default. Switch later per upload if you want sentence- or paragraph-level granularity.',
	},
	{
		n: '03',
		title: 'Ask questions, get cited answers',
		body: 'Gemini 2.5 Flash answers grounded strictly in your documents. Every claim links back to a source chunk.',
	},
];

export function OnboardingHero() {
	const { data: session } = useSession();
	const firstName = session?.user?.name?.split(' ')[0] ?? null;

	return (
		<div className='flex flex-1 items-center justify-center overflow-y-auto px-4 py-8'>
			<div className='flex w-full max-w-[640px] animate-[fade-up_0.45s_ease_both] flex-col gap-6'>
				<div>
					<div className='text-terracotta-600 mb-2 font-mono text-[10px] tracking-[0.18em] uppercase'>
						{firstName ? `Welcome, ${firstName}` : 'Welcome'}
					</div>
					<h1 className='text-cobalt-900 desk:text-[40px] font-serif text-3xl leading-tight font-light tracking-[-0.01em] italic'>
						Let&rsquo;s ground your first chat
					</h1>
					<p className='text-smoke mt-2 max-w-[480px] text-[13px] leading-[1.6]'>
						This assistant only answers from documents you give it. Three steps and you&rsquo;re
						talking to your own knowledge base.
					</p>
				</div>

				<ol className='border-powder-200 bg-paper flex flex-col divide-y divide-[var(--powder-200)] overflow-hidden rounded-[10px] border'>
					{STEPS.map(s => (
						<li key={s.n} className='flex items-start gap-4 px-5 py-4'>
							<span className='text-terracotta-600 font-mono text-[11px] tracking-[0.12em]'>
								{s.n}
							</span>
							<div className='min-w-0 flex-1'>
								<div className='text-cobalt-900 mb-1 text-[14px] font-medium'>{s.title}</div>
								<p className='text-smoke m-0 text-[12.5px] leading-[1.55]'>{s.body}</p>
							</div>
						</li>
					))}
				</ol>

				<div className='flex flex-wrap items-center gap-3'>
					<Link
						href='/documents'
						className='bg-cobalt-900 text-paper hover:bg-cobalt-800 inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-[13px] font-medium no-underline transition-colors'
					>
						Upload your first document →
					</Link>
					<span className='text-smoke font-mono text-[10px] tracking-[0.12em] uppercase'>
						no documents yet
					</span>
				</div>
			</div>
		</div>
	);
}
