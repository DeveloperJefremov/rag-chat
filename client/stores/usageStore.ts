'use client';
import { create } from 'zustand';
import { usageApi } from '../infrastructure/container';
import { UnauthenticatedError } from '../infrastructure/http/apiFetch';

interface UsageState {
	remaining: number | null;
	loaded: boolean;
	fetchUsage: () => Promise<void>;
	decrement: () => void;
	setExhausted: () => void;
}

export const useUsageStore = create<UsageState>(set => ({
	remaining: null,
	loaded: false,

	fetchUsage: async () => {
		try {
			const { remaining } = await usageApi.getUsage();
			set({ remaining, loaded: true });
		} catch (e) {
			if (e instanceof UnauthenticatedError) return;
			// Silent: badge просто не покажется, не критично для UX.
		}
	},

	decrement: () =>
		set(state => {
			if (state.remaining === null) return state;
			return { remaining: Math.max(0, state.remaining - 1) };
		}),

	setExhausted: () => set(state => (state.remaining === null ? state : { remaining: 0 })),
}));
