import { NotFoundError, ConflictError } from '../../shared/exceptions';
import { Logger } from '../../shared/Logger';
import { IQuoteDataSource, Service } from '../../domain/interfaces/IQuoteDataSource';
import { IClientDataSource } from '../../domain/interfaces/IClientDataSource';
import { Decimal } from '@prisma/client/runtime/library';

export interface QuoteRequest {
  clientId: number;
  services: Service[];
}

export interface QuoteResponse {
  id: number;
  clientId: number;
  client: {
    id: number;
    name: string;
    email: string;
    phone: string;
    country: string;
    companyName?: string | null;
    notes?: string | null;
  };
  services: Service[];
  totalAmount: Decimal | number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateQuoteRequest {
  services?: Service[];
}

export class QuoteService {
  private logger: Logger;
  private quoteDataSource: IQuoteDataSource;
  private clientDataSource: IClientDataSource;

  constructor(logger: Logger, quoteDataSource: IQuoteDataSource, clientDataSource: IClientDataSource) {
    this.logger = logger;
    this.quoteDataSource = quoteDataSource;
    this.clientDataSource = clientDataSource;
  }

  /**
   * Get all quotes with pagination
   */
  async getAllQuotes(page: number = 1, limit: number = 10): Promise<{ quotes: QuoteResponse[]; total: number }> {
    this.logger.info(`Fetching all quotes - Page: ${page}, Limit: ${limit}`);
    const result = await this.quoteDataSource.getAll(page, limit);
    return result as unknown as { quotes: QuoteResponse[]; total: number };
  }

  /**
   * Get quotes by client ID with pagination
   */
  async getQuotesByClientId(clientId: number, page: number = 1, limit: number = 10): Promise<{ quotes: QuoteResponse[]; total: number }> {
    this.logger.info(`Fetching quotes for client ${clientId} - Page: ${page}, Limit: ${limit}`);
    const result = await this.quoteDataSource.getByClientId(clientId, page, limit);
    return result as unknown as { quotes: QuoteResponse[]; total: number };
  }

  /**
   * Get quote by ID
   */
  async getQuoteById(id: number): Promise<QuoteResponse> {
    this.logger.info(`Fetching quote ${id}`);
    const quote = await this.quoteDataSource.getById(id);

    if (!quote) {
      throw new NotFoundError(`Quote with ID ${id} not found`);
    }

    return quote as unknown as QuoteResponse;
  }

  /**
   * Create new quote
   */
  async createQuote(request: QuoteRequest): Promise<QuoteResponse> {
    this.logger.info(`Creating quote for client ${request.clientId}`);

    // Validate client exists
    const client = await this.clientDataSource.getById(request.clientId);
    if (!client) {
      throw new NotFoundError(`Client with ID ${request.clientId} not found`);
    }

    if (!request.services || request.services.length === 0) {
      throw new ConflictError('At least one service is required');
    }

    // Calculate total amount
    const totalAmount = request.services.reduce((sum, service) => {
      return sum + service.value * service.quantity;
    }, 0);

    const quote = await this.quoteDataSource.create({
      clientId: request.clientId,
      services: request.services,
      totalAmount,
    });

    this.logger.info(`Quote ${quote.id} created successfully`);
    return quote as unknown as QuoteResponse;
  }

  /**
   * Update quote
   */
  async updateQuote(id: number, request: UpdateQuoteRequest): Promise<QuoteResponse> {
    this.logger.info(`Updating quote ${id}`);

    const existingQuote = await this.quoteDataSource.getById(id);
    if (!existingQuote) {
      throw new NotFoundError(`Quote with ID ${id} not found`);
    }

    const updateData: {
      services?: Service[];
      totalAmount?: number;
    } = {};

    if (request.services) {
      if (request.services.length === 0) {
        throw new ConflictError('At least one service is required');
      }

      updateData.services = request.services;
      updateData.totalAmount = request.services.reduce((sum, service) => {
        return sum + service.value * service.quantity;
      }, 0);
    }

    const updatedQuote = await this.quoteDataSource.update(id, updateData);

    this.logger.info(`Quote ${id} updated successfully`);
    return updatedQuote as unknown as QuoteResponse;
  }

  /**
   * Delete quote
   */
  async deleteQuote(id: number): Promise<void> {
    this.logger.info(`Deleting quote ${id}`);

    const existingQuote = await this.quoteDataSource.getById(id);
    if (!existingQuote) {
      throw new NotFoundError(`Quote with ID ${id} not found`);
    }

    await this.quoteDataSource.delete(id);
    this.logger.info(`Quote ${id} deleted successfully`);
  }

  /**
   * Search quotes
   */
  async searchQuotes(query: string, page: number = 1, limit: number = 10): Promise<{ quotes: QuoteResponse[]; total: number }> {
    this.logger.info(`Searching quotes with query: ${query} - Page: ${page}, Limit: ${limit}`);
    const result = await this.quoteDataSource.search(query, page, limit);
    return result as unknown as { quotes: QuoteResponse[]; total: number };
  }
}
