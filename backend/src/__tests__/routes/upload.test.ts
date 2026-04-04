import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import multipart from '@fastify/multipart';
import Knex from 'knex';
import { Model } from 'objection';
import FormData from 'form-data';
import { databasePlugin } from '../../plugins/database';
import { Transaction, Category, Account, CategorizationRule, ImportLog } from '../../models';
import { uploadRoutes } from '../../routes/upload';
import { testDbConfig } from '../config';

describe('Upload API', () => {
  let app: FastifyInstance;
  let knex: ReturnType<typeof Knex>;

  beforeAll(async () => {
    knex = Knex({
      client: 'pg',
      connection: testDbConfig.connection,
      pool: { min: 1, max: 2 },
    });
    Model.knex(knex);

    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(databasePlugin);
    await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
    await app.register(uploadRoutes, { prefix: '/api/upload' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await knex.destroy();
  });

  beforeEach(async () => {
    await knex('transactions').del();
    await knex('import_logs').del();
  });

  describe('POST /api/upload', () => {
    it('should return 400 when no files uploaded', async () => {
      const form = new FormData();
      const response = await app.inject({
        method: 'POST',
        url: '/api/upload',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe(true);
      expect(body.message).toBe('No files uploaded');
    });

    it('should return 400 for unsupported file type', async () => {
      const form = new FormData();
      form.append('file', Buffer.from('test content'), 'test.txt');

      const response = await app.inject({
        method: 'POST',
        url: '/api/upload',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(400);
    });

    it('should upload a single OFX file', async () => {
      const ofxContent = `<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240101
<TRNAMT>-50.00
<FITID>OFX001
<NAME>Test Transaction
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

      const form = new FormData();
      form.append('file', Buffer.from(ofxContent), 'test.ofx');

      const response = await app.inject({
        method: 'POST',
        url: '/api/upload',
        payload: form,
        headers: form.getHeaders(),
      });

      console.log('single OFX response:', response.statusCode, response.body);
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.files).toHaveLength(1);
      expect(body.files[0].filename).toBe('test.ofx');
      expect(body.files[0].totalCount).toBe(1);
      expect(body.totalTotalCount).toBe(1);
    });

    it('should upload multiple OFX files', async () => {
      const ofxContent = `<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240101
<TRNAMT>-50.00
<FITID>OFX_MULTI_001
<NAME>Test Transaction 1
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

      const form = new FormData();
      form.append('file', Buffer.from(ofxContent), 'test1.ofx');
      form.append('file', Buffer.from(ofxContent.replace('OFX_MULTI_001', 'OFX_MULTI_002')), 'test2.ofx');

      const response = await app.inject({
        method: 'POST',
        url: '/api/upload',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.files).toHaveLength(2);
      expect(body.files[0].filename).toBe('test1.ofx');
      expect(body.files[1].filename).toBe('test2.ofx');
      expect(body.totalTotalCount).toBe(2);
    });

    it('should upload multiple CSV files with shared mapping', async () => {
      const csvContent = `Date,Amount,Description
2024-01-01,-50.00,Groceries
2024-01-02,-25.00,Gas`;

      const mapping = JSON.stringify({
        date: 'Date',
        amount: 'Amount',
        description: 'Description',
      });

      const form = new FormData();
      form.append('file', Buffer.from(csvContent), 'test1.csv');
      form.append('file', Buffer.from(csvContent.replace('Groceries', 'Restaurant').replace('-25.00', '-30.00')), 'test2.csv');
      form.append('mapping', mapping);

      const response = await app.inject({
        method: 'POST',
        url: '/api/upload',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.files).toHaveLength(2);
      expect(body.totalTotalCount).toBe(4);
    });

    it('should deduplicate transactions across multiple files', async () => {
      const csvContent = `Date,Amount,Description
2024-01-01,-50.00,Groceries`;

      const mapping = JSON.stringify({
        date: 'Date',
        amount: 'Amount',
        description: 'Description',
      });

      const form = new FormData();
      form.append('file', Buffer.from(csvContent), 'test1.csv');
      form.append('file', Buffer.from(csvContent), 'test2.csv');
      form.append('mapping', mapping);

      const response = await app.inject({
        method: 'POST',
        url: '/api/upload',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.files).toHaveLength(2);
      expect(body.files[0].newCount).toBe(1);
      expect(body.files[1].duplicateCount).toBe(1);
      expect(body.totalNewCount).toBe(1);
      expect(body.totalDuplicateCount).toBe(1);
    });

    it('should return 400 for invalid CSV mapping', async () => {
      const csvContent = `Date,Amount,Description
2024-01-01,-50.00,Groceries`;

      const invalidMapping = JSON.stringify({ date: 'Date' });

      const form = new FormData();
      form.append('file', Buffer.from(csvContent), 'test.csv');
      form.append('mapping', invalidMapping);

      const response = await app.inject({
        method: 'POST',
        url: '/api/upload',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe(true);
      expect(body.message).toContain('Invalid CSV mapping');
    });

    it('should handle mixed OFX and CSV files', async () => {
      const ofxContent = `<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240101
<TRNAMT>-50.00
<FITID>MIXED_OFX_001
<NAME>OFX Transaction
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

      const csvContent = `Date,Amount,Description
2024-01-01,-25.00,CSV Transaction`;

      const mapping = JSON.stringify({
        date: 'Date',
        amount: 'Amount',
        description: 'Description',
      });

      const form = new FormData();
      form.append('file', Buffer.from(ofxContent), 'test.ofx');
      form.append('file', Buffer.from(csvContent), 'test.csv');
      form.append('mapping', mapping);

      const response = await app.inject({
        method: 'POST',
        url: '/api/upload',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.files).toHaveLength(2);
      expect(body.totalTotalCount).toBe(2);
    });
  });
});
