'use client';
import { MobileMenuButton } from '@/presentation/web/components/MobileMenuButton';
import { AccountSection } from './AccountSection';
import { RetrievalSection } from './RetrievalSection';

export function SettingsPage() {
	return (
		<div className='bg-paper flex h-full flex-col overflow-hidden'>
			<div className='border-powder-200 desk:px-7 desk:py-[18px] flex flex-shrink-0 items-center gap-3 border-b px-4 py-4'>
				<MobileMenuButton />
				<div>
					<h1 className='text-cobalt-800 desk:text-[22px] m-0 font-serif text-xl font-light tracking-[-0.01em] italic'>
						Settings
					</h1>
					<div className='text-smoke mt-0.5 font-mono text-[10px] tracking-[0.1em] uppercase'>
						Account · Retrieval defaults
					</div>
				</div>
			</div>

			<div className='desk:px-12 desk:py-8 desk:pb-20 flex-1 overflow-y-auto px-5 py-5 pb-16'>
				<div className='desk:gap-8 desk:[grid-template-columns:repeat(auto-fit,minmax(380px,1fr))] mx-auto grid max-w-[1400px] grid-cols-1 items-start gap-5'>
					<AccountSection />
					<RetrievalSection />
				</div>
			</div>
		</div>
	);
}
