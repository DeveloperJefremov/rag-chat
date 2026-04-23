export type UserRole = 'USER' | 'ADMIN';

export interface RoleLimits {
	queriesPerDay: number;
	maxDocumentsPerSession: number;
	maxChatSessions: number;
}

export const LIMITS_BY_ROLE: Record<UserRole, RoleLimits> = {
	USER: { queriesPerDay: 100, maxDocumentsPerSession: 5, maxChatSessions: 10 },
	ADMIN: {
		queriesPerDay: Infinity,
		maxDocumentsPerSession: Infinity,
		maxChatSessions: Infinity,
	},
};
