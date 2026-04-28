'use client';
import { useSidebarStore } from '@/client/stores/sidebarStore';

export function MobileMenuButton() {
	const openMobile = useSidebarStore(s => s.openMobile);
	return (
		<button
			type='button'
			aria-label='Open sidebar'
			onClick={openMobile}
			className='text-cobalt-800 hover:bg-powder-200 desk:hidden -ml-1 flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-md'
		>
			<svg
				width='18'
				height='18'
				viewBox='0 0 24 24'
				fill='none'
				stroke='currentColor'
				strokeWidth='2'
			>
				<line x1='3' y1='6' x2='21' y2='6' />
				<line x1='3' y1='12' x2='21' y2='12' />
				<line x1='3' y1='18' x2='21' y2='18' />
			</svg>
		</button>
	);
}
