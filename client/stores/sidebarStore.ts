import { create } from 'zustand';

interface TodayStats {
	requests: number;
	avgLatencyMs: number;
	citationRate: number;
}

interface SidebarStore {
	todayStats: TodayStats | null;
	mobileOpen: boolean;
	setTodayStats: (stats: TodayStats) => void;
	openMobile: () => void;
	closeMobile: () => void;
	toggleMobile: () => void;
}

export const useSidebarStore = create<SidebarStore>(set => ({
	todayStats: null,
	mobileOpen: false,
	setTodayStats: stats => set({ todayStats: stats }),
	openMobile: () => set({ mobileOpen: true }),
	closeMobile: () => set({ mobileOpen: false }),
	toggleMobile: () => set(s => ({ mobileOpen: !s.mobileOpen })),
}));
