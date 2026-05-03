export type AppErrorCode =
	| 'unauthenticated'
	| 'forbidden'
	| 'user_not_found'
	| 'session_not_found'
	| 'document_not_found'
	| 'documents_limit_reached'
	| 'attached_limit_reached'
	| 'limit_reached';

export class AppError extends Error {
	readonly code: AppErrorCode;
	readonly status: number;
	readonly extra?: Record<string, unknown>;

	constructor(code: AppErrorCode, status: number, extra?: Record<string, unknown>) {
		super(code);
		this.name = 'AppError';
		this.code = code;
		this.status = status;
		this.extra = extra;
	}
}

export const Unauthenticated = () => new AppError('unauthenticated', 401);
export const Forbidden = () => new AppError('forbidden', 403);
export const UserNotFound = () => new AppError('user_not_found', 404);
export const SessionNotFound = () => new AppError('session_not_found', 404);
export const DocumentNotFound = () => new AppError('document_not_found', 404);
export const DocumentsLimitReached = () => new AppError('documents_limit_reached', 403);
export const AttachedLimitReached = () => new AppError('attached_limit_reached', 403);
export const LimitReached = () => new AppError('limit_reached', 403);
