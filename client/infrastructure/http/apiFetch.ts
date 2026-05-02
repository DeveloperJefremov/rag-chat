let redirecting = false;

export class UnauthenticatedError extends Error {
	constructor() {
		super('unauthenticated');
		this.name = 'UnauthenticatedError';
	}
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	const res = await fetch(input, init);
	if (res.status === 401) {
		if (typeof window !== 'undefined' && !redirecting) {
			redirecting = true;
			const from = window.location.pathname + window.location.search;
			window.location.href = `/signin?from=${encodeURIComponent(from)}`;
		}
		throw new UnauthenticatedError();
	}
	return res;
}
