import { ChatSession } from '@/domain/entities/ChatSession';

export interface SessionDto {
	id: string;
	title: string | null;
	createdAt: string;
	expiresAt: string;
}

export function toSessionDto(session: ChatSession): SessionDto {
	return {
		id: session.id,
		title: session.title,
		createdAt: session.createdAt.toISOString(),
		expiresAt: session.expiresAt.toISOString(),
	};
}
