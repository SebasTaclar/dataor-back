import { Client } from '@prisma/client';
import { StoredFile } from '../entities/StoredFile';

export interface IClientDataSource {
  getAll(page?: number, limit?: number): Promise<{ clients: Client[]; total: number }>;
  getById(id: number): Promise<Client | null>;
  getByEmail(email: string): Promise<Client | null>;
  create(data: {
    name: string;
    email: string;
    phone: string;
    country: string;
    companyName?: string | null;
    notes?: string | null;
    isActive?: boolean;
    hasPaid?: boolean;
    monthlyAmount?: number | null;
    paymentDayMonth?: number | null;
    files?: unknown;
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
      isActive?: boolean;
      hasPaid?: boolean;
      monthlyAmount?: number | null;
      paymentDayMonth?: number | null;
    }
  ): Promise<Client>;
  updateFiles(id: number, files: StoredFile[]): Promise<void>;
  delete(id: number): Promise<void>;
  search(query: string, page: number, limit: number): Promise<{ clients: Client[]; total: number }>;
}
