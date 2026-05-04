'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChunkingStrategy } from '@/domain/value-objects/ChunkingStrategy';

interface ControlsState {
	chunkingStrategy: ChunkingStrategy;
	topK: number;
	rerankingEnabled: boolean;
	setStrategy: (s: ChunkingStrategy) => void;
	setTopK: (k: number) => void;
	setReranking: (v: boolean) => void;
}

export const useControlsStore = create<ControlsState>()(
	persist(
		set => ({
			chunkingStrategy: 'RECURSIVE',
			topK: 5,
			rerankingEnabled: true,
			setStrategy: chunkingStrategy => set({ chunkingStrategy }),
			setTopK: topK => set({ topK }),
			setReranking: rerankingEnabled => set({ rerankingEnabled }),
		}),
		{ name: 'rag-controls' },
	),
);
