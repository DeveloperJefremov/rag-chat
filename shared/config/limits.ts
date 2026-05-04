export type UserRole = 'USER' | 'ADMIN';

export interface RoleLimits {
	queriesPerDay: number;
	maxDocumentsPerUser: number;
	maxChatSessions: number;
	maxAttachedPerSession: number;
}

export const LIMITS_BY_ROLE: Record<UserRole, RoleLimits> = {
	USER: {
		queriesPerDay: 100,
		maxDocumentsPerUser: 20,
		maxChatSessions: 10,
		maxAttachedPerSession: 10,
	},
	ADMIN: {
		queriesPerDay: Infinity,
		maxDocumentsPerUser: Infinity,
		maxChatSessions: Infinity,
		maxAttachedPerSession: Infinity,
	},
};
