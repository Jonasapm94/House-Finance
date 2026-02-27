import { FastifyInstance } from 'fastify';
import { ImportService } from '../services/ImportService';
import { CSVMappingSchema } from '../validators/schemas';

export async function uploadRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/upload — Upload an OFX or CSV file
  fastify.post('/', async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({
        error: true,
        message: 'No file uploaded',
        statusCode: 400,
      });
    }

    const filename = data.filename;
    const buffer = await data.toBuffer();
    const content = buffer.toString('utf-8');

    // Determine file type from extension
    const ext = filename.toLowerCase().split('.').pop();

    if (ext === 'ofx') {
      const result = await ImportService.importFile(filename, content, 'ofx');
      return reply.status(200).send(result);
    } else if (ext === 'csv') {
      // For CSV, we need column mapping from the fields
      const fields = data.fields;

      let csvMapping;
      try {
        // Expect mapping to come as form fields
        const mappingField = fields?.mapping;
        if (!mappingField || !('value' in mappingField)) {
          return reply.status(400).send({
            error: true,
            message:
              'CSV uploads require a "mapping" field with JSON column mapping',
            statusCode: 400,
          });
        }
        const rawMapping = JSON.parse(mappingField.value as string);
        csvMapping = CSVMappingSchema.parse(rawMapping);
      } catch (err) {
        return reply.status(400).send({
          error: true,
          message: `Invalid CSV mapping: ${err instanceof Error ? err.message : 'unknown error'}`,
          statusCode: 400,
        });
      }

      const result = await ImportService.importFile(
        filename,
        content,
        'csv',
        csvMapping,
      );
      return reply.status(200).send(result);
    } else {
      return reply.status(400).send({
        error: true,
        message: 'Unsupported file type. Please upload .ofx or .csv files.',
        statusCode: 400,
      });
    }
  });
}
