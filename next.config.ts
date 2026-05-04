import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

// CSP rationale:
//   - 'self' covers same-origin assets (Next chunks, Tailwind CSS, /api/*).
//   - script-src needs 'unsafe-inline' for the small inline runtime that Next
//     injects (RSC payload, theme bootstrap). 'unsafe-eval' is required only
//     in dev (HMR) — strict in prod.
//   - style-src needs 'unsafe-inline' because Tailwind v4 + shadcn emit
//     inline styles for CSS variables and animations.
//   - img-src allows Google avatar URLs (lh3.googleusercontent.com) for the
//     NextAuth user picture, plus data: for inline icons.
//   - connect-src allows fetch to Upstash REST (rate limiter), Google AI,
//     Cohere, and same-origin API routes.
//   - frame-ancestors 'none' = clickjacking off (mirrors X-Frame-Options).
const csp = [
	"default-src 'self'",
	`script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: https://lh3.googleusercontent.com https://*.googleusercontent.com",
	"font-src 'self' data:",
	"connect-src 'self' https://*.upstash.io https://generativelanguage.googleapis.com https://api.cohere.com https://api.cohere.ai",
	"frame-ancestors 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"object-src 'none'",
	...(isProd ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
	{ key: 'Content-Security-Policy', value: csp },
	{ key: 'X-Frame-Options', value: 'DENY' },
	{ key: 'X-Content-Type-Options', value: 'nosniff' },
	{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
	{
		key: 'Permissions-Policy',
		value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
	},
	...(isProd
		? [
				{
					key: 'Strict-Transport-Security',
					value: 'max-age=63072000; includeSubDomains; preload',
				},
			]
		: []),
];

const nextConfig: NextConfig = {
	serverExternalPackages: ['@huggingface/transformers', 'onnxruntime-node'],
	images: {
		remotePatterns: [
			{ protocol: 'https', hostname: 'lh3.googleusercontent.com' },
			{ protocol: 'https', hostname: '*.googleusercontent.com' },
		],
	},
	async headers() {
		return [
			{
				source: '/:path*',
				headers: securityHeaders,
			},
		];
	},
};

export default nextConfig;
