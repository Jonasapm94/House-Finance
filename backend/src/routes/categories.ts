import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { Category } from '../models/Category';
import { Transaction } from '../models/Transaction';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  IdParamSchema,
} from '../validators/schemas';
import { DEFAULT_CATEGORY_NAME } from '../constants';

export async function categoryRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /api/categories — List all categories
  app.get('/', async () => {
    return Category.query().orderBy('name');
  });

  // GET /api/categories/:id — Get single category
  app.get(
    '/:id',
    {
      schema: {
        params: IdParamSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const category = await Category.query().findById(id);

      if (!category) {
        return reply.status(404).send({
          error: true,
          message: 'Category not found',
          statusCode: 404,
        });
      }

      return category;
    },
  );

  // POST /api/categories — Create category
  app.post(
    '/',
    {
      schema: {
        body: CreateCategorySchema,
      },
    },
    async (request, reply) => {
      const { name, color } = request.body;

      // Check for duplicate name
      const existing = await Category.query().where('name', name).first();

      if (existing) {
        return reply.status(409).send({
          error: true,
          message: 'A category with this name already exists',
          statusCode: 409,
        });
      }

      const category = await Category.query().insert({ name, color });
      return reply.status(201).send(category);
    },
  );

  // PUT /api/categories/:id — Update category
  app.put(
    '/:id',
    {
      schema: {
        params: IdParamSchema,
        body: UpdateCategorySchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      const category = await Category.query().findById(id);
      if (!category) {
        return reply.status(404).send({
          error: true,
          message: 'Category not found',
          statusCode: 404,
        });
      }

      // Check duplicate name if changing name
      if (updates.name && updates.name !== category.name) {
        const duplicate = await Category.query()
          .where('name', updates.name)
          .whereNot('id', id)
          .first();

        if (duplicate) {
          return reply.status(409).send({
            error: true,
            message: 'A category with this name already exists',
            statusCode: 409,
          });
        }
      }

      const updated = await Category.query().patchAndFetchById(id, updates);
      return updated;
    },
  );

  // DELETE /api/categories/:id — Delete category
  app.delete(
    '/:id',
    {
      schema: {
        params: IdParamSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const category = await Category.query().findById(id);
      if (!category) {
        return reply.status(404).send({
          error: true,
          message: 'Category not found',
          statusCode: 404,
        });
      }

      // Prevent deleting "Uncategorized"
      if (category.name === DEFAULT_CATEGORY_NAME) {
        return reply.status(400).send({
          error: true,
          message: `Cannot delete the ${DEFAULT_CATEGORY_NAME} category`,
          statusCode: 400,
        });
      }

      // Reassign orphaned transactions to null (will show as uncategorized)
      await Transaction.query().where('category_id', id).patch({ category_id: null });

      await Category.query().deleteById(id);

      return reply.status(200).send({
        message: 'Category deleted',
        orphanedTransactions: `reassigned to ${DEFAULT_CATEGORY_NAME}`,
      });
    },
  );
}
