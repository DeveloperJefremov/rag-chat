export interface ChatSession {
	id: string;
	title: string | null;
	userId: string;
	createdAt: Date;
	expiresAt: Date;
}
