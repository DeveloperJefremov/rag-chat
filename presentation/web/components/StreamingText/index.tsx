'use client';
import { Fragment } from 'react';
import { CitationDto } from '@/shared/dtos/CitationDto';

interface Props {
	text: string;
	animate: boolean;
	citations?: CitationDto[];
}

type Segment =
	| { kind: 'text'; value: string }
	| { kind: 'bold'; value: string }
	| { kind: 'code'; value: string }
	| { kind: 'block'; lang: string; value: string }
	| { kind: 'cite'; index: number; raw: string };

const FENCE_RE = /```([\w-]*)\n([\s\S]*?)```/g;
const INLINE_RE = /(\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g;

function parseInline(text: string): Segment[] {
	const parts = text.split(INLINE_RE);
	return parts.map(p => {
		if (p.startsWith('**') && p.endsWith('**')) {
			return { kind: 'bold' as const, value: p.slice(2, -2) };
		}
		if (p.startsWith('`') && p.endsWith('`')) {
			return { kind: 'code' as const, value: p.slice(1, -1) };
		}
		const citeMatch = /^\[(\d+)\]$/.exec(p);
		if (citeMatch) {
			return { kind: 'cite' as const, index: Number(citeMatch[1]), raw: p };
		}
		return { kind: 'text' as const, value: p };
	});
}

function parseSegments(text: string): Segment[] {
	const result: Segment[] = [];
	let lastIndex = 0;
	FENCE_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = FENCE_RE.exec(text)) !== null) {
		if (m.index > lastIndex) {
			result.push(...parseInline(text.slice(lastIndex, m.index)));
		}
		result.push({ kind: 'block', lang: m[1] ?? '', value: m[2] ?? '' });
		lastIndex = m.index + m[0].length;
	}
	if (lastIndex < text.length) {
		result.push(...parseInline(text.slice(lastIndex)));
	}
	return result;
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

function CiteChip({ name, animate }: { name: string; animate: boolean }) {
	return (
		<span className={animate ? 'token-in' : undefined} style={{ display: 'inline-block' }}>
			<span
				className='border-cobalt-700/30 bg-cobalt-700/8 text-cobalt-800 mx-0.5 inline-flex items-center rounded-full border px-1.5 py-px align-baseline font-mono text-[10px] font-medium tracking-[0.02em]'
				title={name}
			>
				{name}
			</span>
		</span>
	);
}

const SQL_KEYWORDS = new Set([
	'select',
	'from',
	'where',
	'and',
	'or',
	'not',
	'null',
	'true',
	'false',
	'as',
	'on',
	'in',
	'is',
	'create',
	'index',
	'table',
	'using',
	'with',
	'into',
	'insert',
	'update',
	'set',
	'delete',
	'alter',
	'drop',
	'join',
	'inner',
	'outer',
	'left',
	'right',
	'full',
	'cross',
	'group',
	'order',
	'by',
	'limit',
	'offset',
	'having',
	'distinct',
	'union',
	'all',
	'case',
	'when',
	'then',
	'else',
	'end',
	'returning',
	'primary',
	'foreign',
	'key',
	'references',
	'cascade',
	'unique',
	'default',
	'values',
]);

function highlightSqlLine(line: string, keyPrefix: string) {
	const commentIdx = line.indexOf('--');
	const codePart = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
	const commentPart = commentIdx >= 0 ? line.slice(commentIdx) : '';

	const tokens = codePart.match(/(\s+|[A-Za-z_][A-Za-z0-9_]*|.)/g) ?? [];
	const nodes = tokens.map((tok, i) => {
		if (SQL_KEYWORDS.has(tok.toLowerCase())) {
			return (
				<span key={`${keyPrefix}-k-${i}`} className='text-terracotta-400 font-medium'>
					{tok}
				</span>
			);
		}
		return <Fragment key={`${keyPrefix}-t-${i}`}>{tok}</Fragment>;
	});

	if (commentPart) {
		nodes.push(
			<span key={`${keyPrefix}-c`} className='text-powder-500 italic'>
				{commentPart}
			</span>,
		);
	}
	return nodes;
}

function CodeBlock({ lang, value }: { lang: string; value: string }) {
	const isSql = lang.toLowerCase() === 'sql';
	const trimmed = value.replace(/\n$/, '');
	const lines = trimmed.split('\n');

	return (
		<div className='bg-cobalt-950 my-2.5 overflow-hidden rounded-md'>
			{lang && (
				<div className='border-cobalt-800 text-powder-500 border-b px-3.5 py-1.5 font-mono text-[9px] tracking-[0.15em] uppercase'>
					{lang}
				</div>
			)}
			<pre className='text-paper m-0 overflow-x-auto px-3.5 py-3 font-mono text-[12px] leading-[1.55] whitespace-pre-wrap'>
				<code>
					{lines.map((line, i) => (
						<Fragment key={i}>
							{isSql ? highlightSqlLine(line, `l${i}`) : line}
							{i < lines.length - 1 ? '\n' : ''}
						</Fragment>
					))}
				</code>
			</pre>
		</div>
	);
}

export function StreamingText({ text, animate, citations }: Props) {
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
				if (seg.kind === 'block') {
					return <CodeBlock key={i} lang={seg.lang} value={seg.value} />;
				}
				if (seg.kind === 'cite') {
					const cite = citations?.[seg.index - 1];
					if (!cite) {
						return <Fragment key={i}>{renderTokens(seg.raw, animate, `r${i}`)}</Fragment>;
					}
					return <CiteChip key={i} name={cite.documentName} animate={animate} />;
				}
				return <Fragment key={i}>{renderTokens(seg.value, animate, `t${i}`)}</Fragment>;
			})}
		</>
	);
}
