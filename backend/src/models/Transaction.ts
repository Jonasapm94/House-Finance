import { BaseModel } from './BaseModel';
import type { RelationMappings } from 'objection';
import { Category } from './Category';
import { Account } from './Account';

export type TransactionType = 'income' | 'expense';
export type TransactionSource = 'ofx' | 'csv' | 'manual';

export class Transaction extends BaseModel {
  static tableName = 'transactions';

  external_id!: string | null;
  category_id!: number | null;
  account_id!: number | null;
  date!: string;
  amount!: string;
  description!: string;
  type!: TransactionType;
  source!: TransactionSource;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['date', 'amount', 'description', 'type'],
      properties: {
        id: { type: 'integer' },
        external_id: { type: ['string', 'null'] },
        category_id: { type: ['integer', 'null'] },
        account_id: { type: ['integer', 'null'] },
        date: { type: 'string', format: 'date' },
        amount: { type: 'string' },
        description: { type: 'string', minLength: 1 },
        type: { type: 'string', enum: ['income', 'expense'] },
        source: { type: 'string', enum: ['ofx', 'csv', 'manual'] },
      },
    };
  }

  static get relationMappings(): RelationMappings {
    return {
      category: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: Category,
        join: {
          from: 'transactions.category_id',
          to: 'categories.id',
        },
      },
      account: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: Account,
        join: {
          from: 'transactions.account_id',
          to: 'accounts.id',
        },
      },
    };
  }
}
