import { getPrismaClient } from '../../config/PrismaClient';
import { IClientDataSource } from '../../domain/interfaces/IClientDataSource';
import { StoredFile } from '../../domain/entities/StoredFile';
import { Client, Prisma } from '@prisma/client';

export class ClientPrismaAdapter implements IClientDataSource {
  private prisma = getPrismaClient();

  async getAll(
    page?: number,
    limit?: number
  ): Promise<{ clients: Client[]; total: number }> {
    const shouldPaginate = page !== undefined && limit !== undefined;
    const skip = shouldPaginate ? (page! - 1) * limit! : undefined;
    const take = shouldPaginate ? limit : undefined;

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.count(),
    ]);

    return { clients, total };
  }

  async getById(id: number): Promise<Client | null> {
    return await this.prisma.client.findUnique({
      where: { id },
    });
  }

  async getByEmail(email: string): Promise<Client | null> {
    return await this.prisma.client.findUnique({
      where: { email },
    });
  }

  async create(data: {
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
  }): Promise<Client> {
    return await this.prisma.client.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        country: data.country,
        companyName: data.companyName || null,
        notes: data.notes || null,
        isActive: data.isActive ?? true,
        hasPaid: data.hasPaid ?? false,
        monthlyAmount: data.monthlyAmount || null,
        paymentDayMonth: data.paymentDayMonth || null,
        files: (data.files as Prisma.InputJsonValue) || null,
      },
    });
  }

  async update(
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
  ): Promise<Client> {
    return await this.prisma.client.update({
      where: { id },
      data,
    });
  }

  async updateFiles(id: number, files: StoredFile[]): Promise<void> {
    await this.prisma.client.update({
      where: { id },
      data: {
        files: files as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async delete(id: number): Promise<void> {
    await this.prisma.client.delete({
      where: { id },
    });
  }

  async search(
    query: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ clients: Client[]; total: number }> {
    const skip = (page - 1) * limit;

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.count({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
      }),
    ]);

    return { clients, total };
  }
}
