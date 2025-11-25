import { Context, HttpRequest } from '@azure/functions';
import { getClientService } from '../src/shared/serviceProvider';
import { ClientRequest, UpdateClientRequest } from '../src/application/services/ClientService';
import { withApiHandler } from '../src/shared/apiHandler';
import { Logger } from '../src/shared/Logger';
import { ApiResponseBuilder } from '../src/shared/ApiResponse';

const funcClients = async (
  _context: Context,
  req: HttpRequest,
  logger: Logger
): Promise<unknown> => {
  const clientService = getClientService(logger);
  const method = req.method?.toUpperCase();
  const id = req.params.id ? parseInt(req.params.id, 10) : null;

  // GET /clients - List all clients with pagination and search
  if (method === 'GET' && !id) {
    logger.info('GET /clients - Fetching all clients');
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const search = req.query.search as string | undefined;

    let result;

    if (search) {
      result = await clientService.searchClients(search, page, limit);
    } else {
      result = await clientService.getAllClients(page, limit);
    }

    const totalPages = Math.ceil(result.total / limit);

    return ApiResponseBuilder.success(
      {
        count: result.clients.length,
        clients: result.clients,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
      },
      search ? `Clients found matching "${search}"` : 'Clients retrieved successfully'
    );
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
    const { name, email, phone, country, companyName, notes, monthlyAmount, paymentDayMonth } = req.body;

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
      monthlyAmount: monthlyAmount !== undefined ? monthlyAmount : null,
      paymentDayMonth: paymentDayMonth !== undefined ? paymentDayMonth : null,
    };

    const client = await clientService.createClient(clientRequest);

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

    const updateRequest: UpdateClientRequest = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      country: req.body.country,
      companyName: req.body.companyName !== undefined ? req.body.companyName : undefined,
      notes: req.body.notes !== undefined ? req.body.notes : undefined,
      monthlyAmount: req.body.monthlyAmount !== undefined ? req.body.monthlyAmount : undefined,
      paymentDayMonth: req.body.paymentDayMonth !== undefined ? req.body.paymentDayMonth : undefined,
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
