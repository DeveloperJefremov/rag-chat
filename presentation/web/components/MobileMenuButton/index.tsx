'use client';
import { useSidebarStore } from '@/client/stores/sidebarStore';
import { IconButton } from '@/presentation/web/components/ui/IconButton';

export function MobileMenuButton() {
	const openMobile = useSidebarStore(s => s.openMobile);
	return (
		<IconButton
			aria-label='Open sidebar'
			onClick={openMobile}
			size='lg'
			className='desk:hidden -ml-1'
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
		</IconButton>
	);
}
