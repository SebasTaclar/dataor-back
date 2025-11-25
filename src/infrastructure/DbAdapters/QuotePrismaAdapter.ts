import { getPrismaClient } from '../../config/PrismaClient';
import { IQuoteDataSource, Service } from '../../domain/interfaces/IQuoteDataSource';
import { Quote, Prisma } from '@prisma/client';

export class QuotePrismaAdapter implements IQuoteDataSource {
  private prisma = getPrismaClient();

  async getAll(page: number = 1, limit: number = 10): Promise<{ quotes: Quote[]; total: number }> {
    const skip = (page - 1) * limit;

    const [quotes, total] = await Promise.all([
      this.prisma.quote.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { client: true },
      }),
      this.prisma.quote.count(),
    ]);

    return { quotes, total };
  }

  async getById(id: number): Promise<Quote | null> {
    return await this.prisma.quote.findUnique({
      where: { id },
      include: { client: true },
    });
  }

  async getByClientId(clientId: number, page: number = 1, limit: number = 10): Promise<{ quotes: Quote[]; total: number }> {
    const skip = (page - 1) * limit;

    const [quotes, total] = await Promise.all([
      this.prisma.quote.findMany({
        where: { clientId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { client: true },
      }),
      this.prisma.quote.count({
        where: { clientId },
      }),
    ]);

    return { quotes, total };
  }

  async create(data: {
    clientId: number;
    services: Service[];
    totalAmount: number;
  }): Promise<Quote> {
    return await this.prisma.quote.create({
      data: {
        clientId: data.clientId,
        services: data.services as unknown as Prisma.InputJsonValue,
        totalAmount: data.totalAmount,
      },
      include: { client: true },
    });
  }

  async update(
    id: number,
    data: {
      services?: Service[];
      totalAmount?: number;
    }
  ): Promise<Quote> {
    return await this.prisma.quote.update({
      where: { id },
      data: {
        services: data.services as unknown as Prisma.InputJsonValue,
        totalAmount: data.totalAmount,
      },
      include: { client: true },
    });
  }

  async delete(id: number): Promise<void> {
    await this.prisma.quote.delete({
      where: { id },
    });
  }

  async search(query: string, page: number = 1, limit: number = 10): Promise<{ quotes: Quote[]; total: number }> {
    const skip = (page - 1) * limit;

    const [quotes, total] = await Promise.all([
      this.prisma.quote.findMany({
        where: {
          OR: [
            { client: { name: { contains: query, mode: 'insensitive' } } },
            { client: { email: { contains: query, mode: 'insensitive' } } },
          ],
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { client: true },
      }),
      this.prisma.quote.count({
        where: {
          OR: [
            { client: { name: { contains: query, mode: 'insensitive' } } },
            { client: { email: { contains: query, mode: 'insensitive' } } },
          ],
        },
      }),
    ]);

    return { quotes, total };
  }
}
