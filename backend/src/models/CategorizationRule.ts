import { BaseModel } from './BaseModel';
import type { RelationMappings } from 'objection';

export type RuleMatchType = 'substring' | 'regex' | 'exact';

export class CategorizationRule extends BaseModel {
  static tableName = 'categorization_rules';

  category_id!: number;
  pattern!: string;
  match_type!: RuleMatchType;
  priority!: number;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['category_id', 'pattern'],
      properties: {
        id: { type: 'integer' },
        category_id: { type: 'integer' },
        pattern: { type: 'string', minLength: 1 },
        match_type: {
          type: 'string',
          enum: ['substring', 'regex', 'exact'],
        },
        priority: { type: 'integer' },
      },
    };
  }

  static get relationMappings(): RelationMappings {
    const { Category } = require('./Category');

    return {
      category: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: Category,
        join: {
          from: 'categorization_rules.category_id',
          to: 'categories.id',
        },
      },
    };
  }
}
