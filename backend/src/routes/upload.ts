import { FastifyInstance } from 'fastify';
import { ImportService } from '../services/ImportService';
import { CSVMappingSchema } from '../validators/schemas';
import type { ImportResult } from '../services/ImportService';

interface FileUpload {
  filename: string;
  content: string;
  fileType: 'ofx' | 'csv';
  csvMapping?: {
    date: string;
    amount: string;
    description: string;
    type?: string;
    external_id?: string;
  };
}

async function processFile(file: FileUpload): Promise<ImportResult> {
  const { filename, content, fileType, csvMapping } = file;

  if (fileType === 'ofx') {
    return ImportService.importFile(filename, content, 'ofx');
  } else if (fileType === 'csv') {
    if (!csvMapping) {
      throw new Error('CSV column mapping is required for CSV files');
    }
    return ImportService.importFile(filename, content, 'csv', csvMapping);
  } else {
    throw new Error('Unsupported file type. Please upload .ofx or .csv files.');
  }
}

export async function uploadRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/', async (request, reply) => {
    const parts = request.parts();

    let sharedCsvMapping: FileUpload['csvMapping'] | undefined;
    const fileBuffers: {
      filename: string;
      content: string;
      fileType: FileUpload['fileType'];
    }[] = [];

    for await (const part of parts) {
      if (part.type === 'file') {
        const filename = part.filename;
        const buffer = await part.toBuffer();
        const content = buffer.toString('utf-8');

        const ext = filename.toLowerCase().split('.').pop();
        let fileType: FileUpload['fileType'];

        if (ext === 'ofx') {
          fileType = 'ofx';
        } else if (ext === 'csv') {
          fileType = 'csv';
        } else {
          return reply.status(400).send({
            error: true,
            message: `Unsupported file type: ${filename}. Please upload .ofx or .csv files.`,
            statusCode: 400,
          });
        }

        fileBuffers.push({ filename, content, fileType });
      } else if (part.fieldname === 'mapping') {
        try {
          const rawMapping = JSON.parse(part.value as string);
          sharedCsvMapping = CSVMappingSchema.parse(rawMapping);
        } catch (err) {
          return reply.status(400).send({
            error: true,
            message: `Invalid CSV mapping: ${err instanceof Error ? err.message : 'unknown error'}`,
            statusCode: 400,
          });
        }
      }
    }

    if (fileBuffers.length === 0) {
      return reply.status(400).send({
        error: true,
        message: 'No files uploaded',
        statusCode: 400,
      });
    }

    const results: ImportResult[] = [];
    let totalTotalCount = 0;
    let totalNewCount = 0;
    let totalDuplicateCount = 0;
    let totalCategorizedCount = 0;

    for (const file of fileBuffers) {
      const result = await processFile({
        filename: file.filename,
        content: file.content,
        fileType: file.fileType,
        csvMapping: file.fileType === 'csv' ? sharedCsvMapping : undefined,
      });

      results.push(result);
      totalTotalCount += result.totalCount;
      totalNewCount += result.newCount;
      totalDuplicateCount += result.duplicateCount;
      totalCategorizedCount += result.categorizedCount;
    }

    return reply.status(200).send({
      files: results,
      totalTotalCount,
      totalNewCount,
      totalDuplicateCount,
      totalCategorizedCount,
    });
  });
}
