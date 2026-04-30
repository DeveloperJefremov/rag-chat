'use client';
import { Fragment } from 'react';

interface Props {
	text: string;
	animate: boolean;
}

type Segment =
	| { kind: 'text'; value: string }
	| { kind: 'bold'; value: string }
	| { kind: 'code'; value: string };

function parseSegments(text: string): Segment[] {
	const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
	return parts.map(p => {
		if (p.startsWith('**') && p.endsWith('**')) {
			return { kind: 'bold' as const, value: p.slice(2, -2) };
		}
		if (p.startsWith('`') && p.endsWith('`')) {
			return { kind: 'code' as const, value: p.slice(1, -1) };
		}
		return { kind: 'text' as const, value: p };
	});
}

function splitTokens(value: string): string[] {
	const matches = value.match(/(\s+|\S+)/g);
	return matches ?? [];
}

function renderTokens(value: string, animate: boolean, keyPrefix: string) {
	if (!animate) return value;
	const tokens = splitTokens(value);
	return tokens.map((tok, i) =>
		/^\s+$/.test(tok) ? (
			<Fragment key={`${keyPrefix}-${i}`}>{tok}</Fragment>
		) : (
			<span key={`${keyPrefix}-${i}`} className='token-in'>
				{tok}
			</span>
		),
	);
}

export function StreamingText({ text, animate }: Props) {
	const segments = parseSegments(text);
	return (
		<>
			{segments.map((seg, i) => {
				if (seg.kind === 'bold') {
					return <strong key={i}>{renderTokens(seg.value, animate, `b${i}`)}</strong>;
				}
				if (seg.kind === 'code') {
					return (
						<code
							key={i}
							className='text-cobalt-700 rounded-[3px] bg-[rgba(26,46,92,0.08)] px-1.5 py-px font-mono text-[0.88em]'
						>
							{renderTokens(seg.value, animate, `c${i}`)}
						</code>
					);
				}
				return <Fragment key={i}>{renderTokens(seg.value, animate, `t${i}`)}</Fragment>;
			})}
		</>
	);
}
