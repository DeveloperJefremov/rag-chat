'use client';
import { create } from 'zustand';

export type ToastTone = 'error' | 'success' | 'info';

export interface Toast {
	id: string;
	tone: ToastTone;
	title: string;
	description?: string;
}

interface ToastState {
	toasts: Toast[];
	push: (t: Omit<Toast, 'id'> & { durationMs?: number }) => string;
	dismiss: (id: string) => void;
}

const DEFAULT_DURATION_MS = 5000;

export const useToastStore = create<ToastState>((set, get) => ({
	toasts: [],
	push: ({ durationMs = DEFAULT_DURATION_MS, ...rest }) => {
		const id =
			typeof crypto !== 'undefined' && 'randomUUID' in crypto
				? crypto.randomUUID()
				: `${Date.now()}-${Math.random()}`;
		set(state => ({ toasts: [...state.toasts, { id, ...rest }] }));
		if (durationMs > 0 && typeof window !== 'undefined') {
			window.setTimeout(() => get().dismiss(id), durationMs);
		}
		return id;
	},
	dismiss: id => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}));

export const toast = {
	error: (title: string, description?: string) =>
		useToastStore.getState().push({ tone: 'error', title, description }),
	success: (title: string, description?: string) =>
		useToastStore.getState().push({ tone: 'success', title, description }),
	info: (title: string, description?: string) =>
		useToastStore.getState().push({ tone: 'info', title, description }),
};
