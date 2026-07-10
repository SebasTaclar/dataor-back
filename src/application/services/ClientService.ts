import { NotFoundError, ConflictError } from '../../shared/exceptions';
import { Logger } from '../../shared/Logger';
import { IClientDataSource } from '../../domain/interfaces/IClientDataSource';
import { Decimal } from '@prisma/client/runtime/library';
import { ClientFile } from '../../domain/entities/Client';
import { StoredFile, UploadFile } from '../../domain/entities/StoredFile';
import { IFileStorageDataSource } from '../../domain/interfaces/IFileStorageDataSource';
import { Client } from '@prisma/client';

export interface ClientRequest {
  name: string;
  email: string;
  phone: string;
  country: string;
  companyName?: string;
  notes?: string;
  isActive?: boolean;
  hasPaid?: boolean;
  monthlyAmount?: number | null;
  paymentDayMonth?: number | null;
  files?: ClientFile[];
}

export interface ClientResponse {
  id: number;
  name: string;
  email: string;
  phone: string;
  country: string;
  companyName?: string | null;
  notes?: string | null;
  isActive: boolean;
  hasPaid: boolean;
  monthlyAmount?: Decimal | number | null;
  paymentDayMonth?: number | null;
  files?: ClientFile[] | null;
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
  isActive?: boolean;
  hasPaid?: boolean;
  monthlyAmount?: number | null;
  paymentDayMonth?: number | null;
}

function toClientResponse(client: Client): ClientResponse {
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    country: client.country,
    companyName: client.companyName,
    notes: client.notes,
    isActive: client.isActive,
    hasPaid: client.hasPaid,
    monthlyAmount: client.monthlyAmount,
    paymentDayMonth: client.paymentDayMonth,
    files: (client.files as ClientFile[]) || null,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

export class ClientService {
  private logger: Logger;
  private clientDataSource: IClientDataSource;
  private fileStorage: IFileStorageDataSource;

  constructor(logger: Logger, clientDataSource: IClientDataSource, fileStorage: IFileStorageDataSource) {
    this.logger = logger;
    this.clientDataSource = clientDataSource;
    this.fileStorage = fileStorage;
  }

  /**
   * Create a new client
   */
  async createClient(data: ClientRequest, files?: UploadFile[]): Promise<ClientResponse> {
    this.logger.info(`Creating new client with email: ${data.email}`);

    const existingClient = await this.clientDataSource.getByEmail(data.email);

    if (existingClient) {
      throw new ConflictError(`Client with email ${data.email} already exists`);
    }

    const client = await this.clientDataSource.create(data);

    if (files && files.length > 0) {
      const uploadedFiles: StoredFile[] = [];
      for (const file of files) {
        const storedFile = await this.fileStorage.upload('clients', client.id, file);
        uploadedFiles.push(storedFile);
      }
      await this.clientDataSource.updateFiles(client.id, uploadedFiles);
    }

    this.logger.info(`Client created with ID: ${client.id}`);
    return this.getClientById(client.id);
  }

  /**
   * Get all clients with optional pagination
   */
  async getAllClients(
    page?: number,
    limit?: number
  ): Promise<{ clients: ClientResponse[]; total: number }> {
    this.logger.info(`Fetching all clients - Page: ${page || 'all'}, Limit: ${limit || 'all'}`);

    const result = await this.clientDataSource.getAll(page, limit);
    return {
      clients: result.clients.map(toClientResponse),
      total: result.total,
    };
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

    return toClientResponse(client);
  }

  /**
   * Get client by email
   */
  async getClientByEmail(email: string): Promise<ClientResponse | null> {
    this.logger.info(`Fetching client by email: ${email}`);

    const client = await this.clientDataSource.getByEmail(email);
    return client ? toClientResponse(client) : null;
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

    await this.clientDataSource.update(id, data);

    this.logger.info(`Client ${id} updated successfully`);
    return this.getClientById(id);
  }

  /**
   * Add files to client
   */
  async addFilesToClient(clientId: number, files: UploadFile[]): Promise<ClientResponse> {
    this.logger.info(`Adding files to client ${clientId}`);

    const existingClient = await this.clientDataSource.getById(clientId);

    if (!existingClient) {
      throw new NotFoundError(`Client with ID ${clientId} not found`);
    }

    const currentFiles = (existingClient.files as StoredFile[]) || [];

    const uploadedFiles: StoredFile[] = [];
    for (const file of files) {
      const storedFile = await this.fileStorage.upload('clients', clientId, file);
      uploadedFiles.push(storedFile);
    }

    const updatedFiles = [...currentFiles, ...uploadedFiles];
    await this.clientDataSource.updateFiles(clientId, updatedFiles);

    this.logger.info(`Files added to client ${clientId} successfully`);
    return this.getClientById(clientId);
  }

  /**
   * Remove a file from client by key
   */
  async removeFileFromClient(clientId: number, fileKey: string): Promise<ClientResponse> {
    this.logger.info(`Removing file ${fileKey} from client ${clientId}`);

    const existingClient = await this.clientDataSource.getById(clientId);

    if (!existingClient) {
      throw new NotFoundError(`Client with ID ${clientId} not found`);
    }

    const currentFiles = (existingClient.files as StoredFile[]) || [];
    const fileToRemove = currentFiles.find(f => f.key === fileKey);

    if (!fileToRemove) {
      throw new NotFoundError(`File with key ${fileKey} not found in client ${clientId}`);
    }

    await this.fileStorage.deleteMany([fileToRemove]);

    const updatedFiles = currentFiles.filter(f => f.key !== fileKey);
    await this.clientDataSource.updateFiles(clientId, updatedFiles);

    this.logger.info(`File removed from client ${clientId} successfully`);
    return this.getClientById(clientId);
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

    const files = (existingClient.files as StoredFile[]) || [];
    if (files.length > 0) {
      await this.fileStorage.deleteMany(files);
    }

    await this.clientDataSource.delete(id);

    this.logger.info(`Client ${id} deleted successfully`);
  }

  /**
   * Search clients by name or email
   */
  async searchClients(
    query: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ clients: ClientResponse[]; total: number }> {
    this.logger.info(`Searching clients with query: ${query}`);

    const result = await this.clientDataSource.search(query, page, limit);
    return {
      clients: result.clients.map(toClientResponse),
      total: result.total,
    };
  }
}
