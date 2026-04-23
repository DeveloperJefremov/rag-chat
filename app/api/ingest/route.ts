import { NextRequest, NextResponse } from 'next/server';
import {
	authContext,
	ingestionService,
	chatSessionRepo,
} from '@/server/infrastructure/http/container';
import { FileType } from '@/domain/value-objects/FileType';
import { ChunkingStrategy } from '@/domain/value-objects/ChunkingStrategy';
import { MAX_FILE_SIZE_MB, SUPPORTED_FILE_TYPES } from '@/shared/config/constants';

const EXT_TO_FILE_TYPE: Record<string, FileType> = {
	pdf: 'PDF',
	txt: 'TXT',
	docx: 'DOCX',
};

export async function POST(req: NextRequest) {
	try {
		const user = await authContext.requireUser();

		const formData = await req.formData();
		const file = formData.get('file') as File | null;
		const sessionId = formData.get('sessionId') as string | null;
		const chunkingStrategy =
			(formData.get('chunkingStrategy') as ChunkingStrategy | null) ?? 'RECURSIVE';

		if (!file) {
			return NextResponse.json({ error: 'no_file' }, { status: 400 });
		}

		if (!sessionId) {
			return NextResponse.json({ error: 'no_session_id' }, { status: 400 });
		}

		// Verify the user owns this session
		const session = await chatSessionRepo.findById(sessionId, user.id);
		if (!session) {
			return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
		}

		const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
		if (!SUPPORTED_FILE_TYPES.includes(ext as (typeof SUPPORTED_FILE_TYPES)[number])) {
			return NextResponse.json(
				{ error: 'unsupported_file_type', supported: SUPPORTED_FILE_TYPES },
				{ status: 400 },
			);
		}

		const sizeMB = file.size / (1024 * 1024);
		if (sizeMB > MAX_FILE_SIZE_MB) {
			return NextResponse.json(
				{ error: 'file_too_large', maxMB: MAX_FILE_SIZE_MB },
				{ status: 400 },
			);
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		const fileType = EXT_TO_FILE_TYPE[ext];

		const result = await ingestionService.ingest({
			buffer,
			fileName: file.name,
			fileType,
			sessionId,
			userId: user.id,
			chunkingStrategy,
		});

		return NextResponse.json(result, { status: 201 });
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		return NextResponse.json({ error: 'internal_error' }, { status: 500 });
	}
}
