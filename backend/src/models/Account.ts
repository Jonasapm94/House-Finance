import { BaseModel } from './BaseModel';

export class Account extends BaseModel {
  static tableName = 'accounts';

  name!: string;
  bank_name!: string | null;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['name'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string', minLength: 1, maxLength: 100 },
        bank_name: { type: ['string', 'null'], maxLength: 100 },
      },
    };
  }
}
