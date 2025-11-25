import { NotFoundError, ConflictError } from '../../shared/exceptions';
import { Logger } from '../../shared/Logger';
import { IClientDataSource } from '../../domain/interfaces/IClientDataSource';
import { Decimal } from '@prisma/client/runtime/library';

export interface ClientRequest {
  name: string;
  email: string;
  phone: string;
  country: string;
  companyName?: string;
  notes?: string;
  monthlyAmount?: number | null;
  paymentDayMonth?: number | null;
}

export interface ClientResponse {
  id: number;
  name: string;
  email: string;
  phone: string;
  country: string;
  companyName?: string | null;
  notes?: string | null;
  monthlyAmount?: Decimal | number | null;
  paymentDayMonth?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateClientRequest {
  name?: string;
  email?: string;
  phone?: string;
  country?: string;
  companyName?: string | null;
  notes?: string | null;
  monthlyAmount?: number | null;
  paymentDayMonth?: number | null;
}

export class ClientService {
  private logger: Logger;
  private clientDataSource: IClientDataSource;

  constructor(logger: Logger, clientDataSource: IClientDataSource) {
    this.logger = logger;
    this.clientDataSource = clientDataSource;
  }

  /**
   * Create a new client
   */
  async createClient(data: ClientRequest): Promise<ClientResponse> {
    this.logger.info(`Creating new client with email: ${data.email}`);

    const existingClient = await this.clientDataSource.getByEmail(data.email);

    if (existingClient) {
      throw new ConflictError(`Client with email ${data.email} already exists`);
    }

    const client = await this.clientDataSource.create(data);

    this.logger.info(`Client created with ID: ${client.id}`);
    return client;
  }

  /**
   * Get all clients with pagination
   */
  async getAllClients(page: number = 1, limit: number = 10): Promise<{ clients: ClientResponse[]; total: number }> {
    this.logger.info(`Fetching all clients - Page: ${page}, Limit: ${limit}`);

    return await this.clientDataSource.getAll(page, limit);
  }

  /**
   * Get client by ID
   */
  async getClientById(id: number): Promise<ClientResponse> {
    this.logger.info(`Fetching client by ID: ${id}`);

    const client = await this.clientDataSource.getById(id);

    if (!client) {
      throw new NotFoundError(`Client with ID ${id} not found`);
    }

    return client;
  }

  /**
   * Get client by email
   */
  async getClientByEmail(email: string): Promise<ClientResponse | null> {
    this.logger.info(`Fetching client by email: ${email}`);

    return await this.clientDataSource.getByEmail(email);
  }

  /**
   * Update client
   */
  async updateClient(id: number, data: UpdateClientRequest): Promise<ClientResponse> {
    this.logger.info(`Updating client with ID: ${id}`);

    const existingClient = await this.clientDataSource.getById(id);

    if (!existingClient) {
      throw new NotFoundError(`Client with ID ${id} not found`);
    }

    // Check if email is being updated and if it's unique
    if (data.email && data.email !== existingClient.email) {
      const emailExists = await this.clientDataSource.getByEmail(data.email);

      if (emailExists) {
        throw new ConflictError(`Email ${data.email} is already in use`);
      }
    }

    const updatedClient = await this.clientDataSource.update(id, data);

    this.logger.info(`Client ${id} updated successfully`);
    return updatedClient;
  }

  /**
   * Delete client
   */
  async deleteClient(id: number): Promise<void> {
    this.logger.info(`Deleting client with ID: ${id}`);

    const existingClient = await this.clientDataSource.getById(id);

    if (!existingClient) {
      throw new NotFoundError(`Client with ID ${id} not found`);
    }

    await this.clientDataSource.delete(id);

    this.logger.info(`Client ${id} deleted successfully`);
  }

  /**
   * Search clients by name or email
   */
  async searchClients(query: string, page: number = 1, limit: number = 10): Promise<{ clients: ClientResponse[]; total: number }> {
    this.logger.info(`Searching clients with query: ${query}`);

    return await this.clientDataSource.search(query, page, limit);
  }
}
