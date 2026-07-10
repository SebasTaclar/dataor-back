import { Context, HttpRequest } from '@azure/functions';
import { getClientService } from '../src/shared/serviceProvider';
import { ClientRequest, UpdateClientRequest } from '../src/application/services/ClientService';
import { withApiHandler } from '../src/shared/apiHandler';
import { Logger } from '../src/shared/Logger';
import { ApiResponseBuilder } from '../src/shared/ApiResponse';
import { UploadFile } from '../src/domain/entities/StoredFile';
import { validateAuthToken } from '../src/shared/authHelper';
import Busboy from 'busboy';

interface ParsedMultipartData {
  fields: Record<string, string>;
  files: UploadFile[];
}

function parseMultipartData(req: HttpRequest): Promise<ParsedMultipartData> {
  return new Promise((resolve, reject) => {
    const fields: Record<string, string> = {};
    const files: UploadFile[] = [];

    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      reject(new Error('Content-Type must be multipart/form-data'));
      return;
    }

    const busboy = Busboy({
      headers: { 'content-type': contentType },
      limits: { fileSize: 10 * 1024 * 1024, files: 5, fields: 10, fieldSize: 1024 },
    });

    busboy.on('field', (name: string, value: string) => {
      fields[name] = value;
    });

    busboy.on('file', (name: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
      const chunks: Buffer[] = [];
      
      file.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      file.on('end', () => {
        const buffer = Buffer.concat(chunks);
        files.push({
          buffer,
          name: info.filename,
          type: info.mimeType,
        });
      });

      file.on('error', (err: Error) => {
        reject(err);
      });
    });

    busboy.on('finish', () => {
      resolve({ fields, files });
    });

    busboy.on('error', (error: Error) => {
      reject(error);
    });

    if (req.body) {
      if (Buffer.isBuffer(req.body)) {
        busboy.end(req.body);
      } else if (typeof req.body === 'string') {
        busboy.end(Buffer.from(req.body));
      } else if (typeof req.body === 'object') {
        const bodyObj = req.body as Record<string, unknown>;
        if (bodyObj.data && Buffer.isBuffer(bodyObj.data)) {
          busboy.end(bodyObj.data);
        } else {
          busboy.end(Buffer.from(JSON.stringify(req.body)));
        }
      } else {
        reject(new Error('Unsupported body type'));
      }
    } else {
      reject(new Error('No body provided'));
    }
  });
}

const funcClients = async (
  _context: Context,
  req: HttpRequest,
  logger: Logger
): Promise<unknown> => {
  const clientService = getClientService(logger);
  const method = req.method?.toUpperCase();
  const id = req.params.id ? parseInt(req.params.id, 10) : null;

  // GET /clients - List all clients (público)
  if (method === 'GET' && !id) {
    logger.info('GET /clients - Fetching all clients');
    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const search = req.query.search as string | undefined;

    let result;

    if (search) {
      result = await clientService.searchClients(search, page || 1, limit || 10);
    } else if (page || limit) {
      result = await clientService.getAllClients(page || 1, limit || 10);
    } else {
      result = await clientService.getAllClients();
    }

    const effectiveLimit = limit || result.total;
    const effectivePage = page || 1;
    const totalPages = Math.ceil(result.total / effectiveLimit);

    return ApiResponseBuilder.success(
      {
        count: result.clients.length,
        clients: result.clients,
        pagination: limit || page ? {
          page: effectivePage,
          limit: effectiveLimit,
          total: result.total,
          totalPages,
          hasNext: effectivePage < totalPages,
          hasPrevious: effectivePage > 1,
        } : undefined,
      },
      search ? `Clients found matching "${search}"` : 'Clients retrieved successfully'
    );
  }

  // Endpoints protegidos requieren JWT
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) {
    return ApiResponseBuilder.error('Unauthorized: Missing authorization header', 401);
  }

  try {
    const token = validateAuthToken(authHeader);
    logger.logInfo(`User authenticated`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    logger.logError(`Authentication failed: ${errorMessage}`);
    return ApiResponseBuilder.error('Unauthorized: Invalid or expired token', 401);
  }

  // GET /clients/{id} - Get specific client
  if (method === 'GET' && id) {
    logger.info(`GET /clients/${id} - Fetching client by ID`);

    if (isNaN(id)) {
      return ApiResponseBuilder.badRequest('Invalid client ID');
    }

    const client = await clientService.getClientById(id);

    return ApiResponseBuilder.success(client, 'Client retrieved successfully');
  }

  // POST /clients - Create new client
  if (method === 'POST') {
    logger.info('POST /clients - Creating new client');

    let parsedData: ParsedMultipartData;
    try {
      parsedData = await parseMultipartData(req);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse multipart data';
      logger.logError(errorMessage);
      return ApiResponseBuilder.badRequest(errorMessage);
    }

    const { fields, files } = parsedData;
    const {
      name,
      email,
      phone,
      country,
      companyName,
      notes,
      isActive,
      hasPaid,
      monthlyAmount,
      paymentDayMonth,
    } = fields;

    // Validation
    const errors: string[] = [];
    if (!name) errors.push('name is required');
    if (!email) errors.push('email is required');
    if (!phone) errors.push('phone is required');
    if (!country) errors.push('country is required');

    if (errors.length > 0) {
      return ApiResponseBuilder.validationError(errors);
    }

    const clientRequest: ClientRequest = {
      name,
      email,
      phone,
      country,
      companyName: companyName || undefined,
      notes: notes || undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      hasPaid: hasPaid !== undefined ? Boolean(hasPaid) : undefined,
      monthlyAmount: monthlyAmount !== undefined ? Number(monthlyAmount) : null,
      paymentDayMonth: paymentDayMonth !== undefined ? Number(paymentDayMonth) : null,
    };

    const client = await clientService.createClient(clientRequest, files.length > 0 ? files : undefined);

    return {
      success: true,
      message: 'Client created successfully',
      data: client,
      timestamp: new Date().toISOString(),
      statusCode: 201,
    };
  }

  // PATCH /clients/{id} - Update client
  if (method === 'PATCH' && id) {
    logger.info(`PATCH /clients/${id} - Updating client`);

    if (isNaN(id)) {
      return ApiResponseBuilder.badRequest('Invalid client ID');
    }

    const body = req.body as Record<string, unknown>;

    const updateRequest: UpdateClientRequest = {
      name: body.name as string | undefined,
      email: body.email as string | undefined,
      phone: body.phone as string | undefined,
      country: body.country as string | undefined,
      companyName: body.companyName as string | undefined,
      notes: body.notes as string | undefined,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
      hasPaid: body.hasPaid !== undefined ? Boolean(body.hasPaid) : undefined,
      monthlyAmount: body.monthlyAmount !== undefined ? Number(body.monthlyAmount) : undefined,
      paymentDayMonth: body.paymentDayMonth !== undefined ? Number(body.paymentDayMonth) : undefined,
    };

    const client = await clientService.updateClient(id, updateRequest);

    return ApiResponseBuilder.success(client, 'Client updated successfully');
  }

  // DELETE /clients/{id} - Delete client
  if (method === 'DELETE' && id) {
    logger.info(`DELETE /clients/${id} - Deleting client`);

    if (isNaN(id)) {
      return ApiResponseBuilder.badRequest('Invalid client ID');
    }

    await clientService.deleteClient(id);

    return ApiResponseBuilder.success({ id }, 'Client deleted successfully');
  }

  return ApiResponseBuilder.methodNotAllowed(`Method ${method} not allowed for this endpoint`);
};

export default withApiHandler(funcClients);
