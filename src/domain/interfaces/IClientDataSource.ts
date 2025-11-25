import { Client } from '@prisma/client';

export interface IClientDataSource {
  getAll(page: number, limit: number): Promise<{ clients: Client[]; total: number }>;
  getById(id: number): Promise<Client | null>;
  getByEmail(email: string): Promise<Client | null>;
  create(data: {
    name: string;
    email: string;
    phone: string;
    country: string;
    companyName?: string | null;
    notes?: string | null;
    monthlyAmount?: number | null;
    paymentDayMonth?: number | null;
  }): Promise<Client>;
  update(
    id: number,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      country?: string;
      companyName?: string | null;
      notes?: string | null;
      monthlyAmount?: number | null;
      paymentDayMonth?: number | null;
    }
  ): Promise<Client>;
  delete(id: number): Promise<void>;
  search(query: string, page: number, limit: number): Promise<{ clients: Client[]; total: number }>;
}
