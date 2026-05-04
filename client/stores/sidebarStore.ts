import { create } from 'zustand';

interface SidebarStore {
	mobileOpen: boolean;
	openMobile: () => void;
	closeMobile: () => void;
	toggleMobile: () => void;
}

export const useSidebarStore = create<SidebarStore>(set => ({
	mobileOpen: false,
	openMobile: () => set({ mobileOpen: true }),
	closeMobile: () => set({ mobileOpen: false }),
	toggleMobile: () => set(s => ({ mobileOpen: !s.mobileOpen })),
}));
