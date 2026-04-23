'use client';
import { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';

const ACCEPTED = '.pdf,.txt,.docx';
const MAX_MB = 10;

interface FileDropzoneProps {
	onFile: (file: File) => void;
	disabled?: boolean;
}

export function FileDropzone({ onFile, disabled = false }: FileDropzoneProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isDragging, setIsDragging] = useState(false);
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
		setIsDragging(false);
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
				setIsDragging(true);
			}}
			onDragLeave={() => setIsDragging(false)}
			onDrop={handleDrop}
			className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
				isDragging
					? 'border-primary bg-primary/5'
					: 'border-border hover:border-primary/50 hover:bg-muted/20'
			} ${disabled ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
			onClick={() => !disabled && inputRef.current?.click()}
		>
			<Upload className='text-muted-foreground mb-3 h-8 w-8' />
			<p className='text-sm font-medium'>Drop a file here or click to upload</p>
			<p className='text-muted-foreground mt-1 text-xs'>PDF, TXT, DOCX — up to {MAX_MB} MB</p>

			{validationError && <p className='mt-2 text-xs text-red-500'>{validationError}</p>}

			<Button variant='outline' size='sm' className='pointer-events-none mt-4' tabIndex={-1}>
				Choose file
			</Button>

			<input
				ref={inputRef}
				type='file'
				accept={ACCEPTED}
				onChange={handleChange}
				className='hidden'
			/>
		</div>
	);
}
