'use client';
import { ChangeEvent, DragEvent, useRef, useState } from 'react';

const ACCEPTED = '.pdf,.txt,.docx';
const MAX_MB = 10;

interface FileDropzoneProps {
	onFile: (file: File) => void;
	disabled?: boolean;
	uploading?: boolean;
	progress?: number;
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono), monospace' };

export function FileDropzone({
	onFile,
	disabled = false,
	uploading = false,
	progress = 0,
}: FileDropzoneProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragging, setDragging] = useState(false);
	const [validationError, setValidationError] = useState<string | null>(null);

	const validate = (file: File): string | null => {
		const ext = file.name.split('.').pop()?.toLowerCase();
		if (!['pdf', 'txt', 'docx'].includes(ext ?? '')) {
			return 'Only PDF, TXT, and DOCX files are supported.';
		}
		if (file.size > MAX_MB * 1024 * 1024) {
			return `File must be smaller than ${MAX_MB} MB.`;
		}
		return null;
	};

	const handleFile = (file: File) => {
		const err = validate(file);
		if (err) {
			setValidationError(err);
			return;
		}
		setValidationError(null);
		onFile(file);
	};

	const handleDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setDragging(false);
		const file = e.dataTransfer.files[0];
		if (file) handleFile(file);
	};

	const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) handleFile(file);
		e.target.value = '';
	};

	return (
		<div
			onDragOver={e => {
				e.preventDefault();
				setDragging(true);
			}}
			onDragLeave={() => setDragging(false)}
			onDrop={handleDrop}
			onClick={() => !disabled && !uploading && inputRef.current?.click()}
			style={{
				border: `2px dashed ${dragging ? 'var(--cobalt-500)' : 'var(--powder-300)'}`,
				borderRadius: 10,
				background: dragging ? 'var(--powder-100)' : 'var(--paper)',
				padding: '36px 24px',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				gap: 12,
				cursor: disabled || uploading ? 'default' : 'pointer',
				transition: 'border-color 0.15s, background 0.15s',
				minHeight: 160,
				opacity: disabled ? 0.5 : 1,
			}}
		>
			<input
				ref={inputRef}
				type='file'
				accept={ACCEPTED}
				onChange={handleChange}
				style={{ display: 'none' }}
			/>
			{uploading ? (
				<>
					<div
						style={{
							width: 36,
							height: 36,
							border: '3px solid var(--powder-200)',
							borderTopColor: 'var(--cobalt-700)',
							borderRadius: '50%',
							animation: 'spin 0.8s linear infinite',
						}}
					/>
					<div
						style={{
							fontFamily: 'inherit',
							fontSize: 13,
							color: 'var(--cobalt-800)',
							fontWeight: 500,
						}}
					>
						Indexing…
					</div>
					<div
						style={{
							width: 180,
							height: 4,
							background: 'var(--powder-200)',
							borderRadius: 2,
							overflow: 'hidden',
						}}
					>
						<div
							style={{
								height: '100%',
								background: 'var(--terracotta-500)',
								borderRadius: 2,
								width: `${progress}%`,
								transition: 'width 0.2s',
							}}
						/>
					</div>
					<div style={{ ...MONO, fontSize: 10, color: 'var(--smoke)', letterSpacing: '0.1em' }}>
						{progress}% · chunking · embedding
					</div>
				</>
			) : (
				<>
					<svg
						width='32'
						height='32'
						viewBox='0 0 24 24'
						fill='none'
						stroke='var(--powder-400)'
						strokeWidth='1.5'
					>
						<path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
						<polyline points='17 8 12 3 7 8' />
						<line x1='12' y1='3' x2='12' y2='15' />
					</svg>
					<div style={{ textAlign: 'center' }}>
						<div
							style={{
								fontFamily: 'inherit',
								fontSize: 14,
								color: 'var(--cobalt-800)',
								fontWeight: 500,
								marginBottom: 4,
							}}
						>
							Drop files here, or click to browse
						</div>
						<div
							style={{
								...MONO,
								fontSize: 10,
								color: 'var(--smoke)',
								letterSpacing: '0.1em',
								textTransform: 'uppercase',
							}}
						>
							PDF · TXT · DOCX — up to {MAX_MB} MB
						</div>
					</div>
					{validationError && (
						<div
							style={{
								...MONO,
								fontSize: 10,
								color: 'var(--terracotta-600)',
								letterSpacing: '0.08em',
							}}
						>
							{validationError}
						</div>
					)}
				</>
			)}
		</div>
	);
}
