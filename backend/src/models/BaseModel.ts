import { Model } from 'objection';

export class BaseModel extends Model {
  id!: number;
  created_at!: string;
  updated_at!: string;

  $beforeUpdate(): void {
    this.updated_at = new Date().toISOString();
  }
}
