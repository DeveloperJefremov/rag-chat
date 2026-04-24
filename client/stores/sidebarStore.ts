import { create } from 'zustand';

interface TodayStats {
	requests: number;
	avgLatencyMs: number;
	citationRate: number;
}

interface SidebarStore {
	todayStats: TodayStats | null;
	setTodayStats: (stats: TodayStats) => void;
}

export const useSidebarStore = create<SidebarStore>(set => ({
	todayStats: null,
	setTodayStats: stats => set({ todayStats: stats }),
}));
