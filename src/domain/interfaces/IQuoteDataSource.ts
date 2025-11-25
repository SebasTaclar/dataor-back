import { Quote } from '@prisma/client';

export interface Service {
  name: string;
  quantity: number;
  billingType: 'MONTHLY' | 'ANNUAL' | 'ONETIME';
  description?: string;
  value: number;
}

export interface IQuoteDataSource {
  getAll(page: number, limit: number): Promise<{ quotes: Quote[]; total: number }>;
  getById(id: number): Promise<Quote | null>;
  getByClientId(clientId: number, page: number, limit: number): Promise<{ quotes: Quote[]; total: number }>;
  create(data: {
    clientId: number;
    services: Service[];
    totalAmount: number;
  }): Promise<Quote>;
  update(
    id: number,
    data: {
      services?: Service[];
      totalAmount?: number;
    }
  ): Promise<Quote>;
  delete(id: number): Promise<void>;
  search(query: string, page: number, limit: number): Promise<{ quotes: Quote[]; total: number }>;
}
