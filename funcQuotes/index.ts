import { Context, HttpRequest } from '@azure/functions';
import { getQuoteService } from '../src/shared/serviceProvider';
import { QuoteRequest, UpdateQuoteRequest } from '../src/application/services/QuoteService';
import { withApiHandler } from '../src/shared/apiHandler';
import { Logger } from '../src/shared/Logger';
import { ApiResponseBuilder } from '../src/shared/ApiResponse';
import { Service } from '../src/domain/interfaces/IQuoteDataSource';

const funcQuotes = async (
  _context: Context,
  req: HttpRequest,
  logger: Logger
): Promise<unknown> => {
  const quoteService = getQuoteService(logger);
  const method = req.method?.toUpperCase();
  const id = req.params.id ? parseInt(req.params.id, 10) : null;
  const clientId = req.query.clientId ? parseInt(req.query.clientId as string, 10) : null;

  // GET /quotes - List all quotes with pagination
  if (method === 'GET' && !id && !clientId) {
    logger.info('GET /quotes - Fetching all quotes');
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const search = req.query.search as string | undefined;

    let result;

    if (search) {
      result = await quoteService.searchQuotes(search, page, limit);
    } else {
      result = await quoteService.getAllQuotes(page, limit);
    }

    const totalPages = Math.ceil(result.total / limit);

    return ApiResponseBuilder.success(
      {
        count: result.quotes.length,
        quotes: result.quotes,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
      },
      search ? `Quotes found matching "${search}"` : 'Quotes retrieved successfully'
    );
  }

  // GET /quotes?clientId=X - Get quotes by client ID with pagination
  if (method === 'GET' && !id && clientId) {
    logger.info(`GET /quotes?clientId=${clientId} - Fetching quotes by client`);
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    if (isNaN(clientId)) {
      return ApiResponseBuilder.badRequest('Invalid client ID');
    }

    const result = await quoteService.getQuotesByClientId(clientId, page, limit);
    const totalPages = Math.ceil(result.total / limit);

    return ApiResponseBuilder.success(
      {
        count: result.quotes.length,
        quotes: result.quotes,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
      },
      'Client quotes retrieved successfully'
    );
  }

  // GET /quotes/{id} - Get specific quote
  if (method === 'GET' && id) {
    logger.info(`GET /quotes/${id} - Fetching quote by ID`);

    if (isNaN(id)) {
      return ApiResponseBuilder.badRequest('Invalid quote ID');
    }

    const quote = await quoteService.getQuoteById(id);

    return ApiResponseBuilder.success(quote, 'Quote retrieved successfully');
  }

  // POST /quotes - Create new quote
  if (method === 'POST') {
    logger.info('POST /quotes - Creating new quote');
    const { clientId: reqClientId, services } = req.body;

    // Validation
    const errors: string[] = [];
    if (!reqClientId) errors.push('clientId is required');
    if (!services || !Array.isArray(services) || services.length === 0) {
      errors.push('services array is required and must contain at least one service');
    }

    if (services && Array.isArray(services)) {
      services.forEach((service: Service, index: number) => {
        if (!service.name) errors.push(`services[${index}].name is required`);
        if (service.quantity === undefined || service.quantity <= 0) errors.push(`services[${index}].quantity must be greater than 0`);
        if (!service.billingType) errors.push(`services[${index}].billingType is required`);
        if (service.value === undefined || service.value <= 0) errors.push(`services[${index}].value must be greater than 0`);
      });
    }

    if (errors.length > 0) {
      return ApiResponseBuilder.validationError(errors);
    }

    const quoteRequest: QuoteRequest = {
      clientId: reqClientId,
      services,
    };

    const quote = await quoteService.createQuote(quoteRequest);

    return {
      success: true,
      message: 'Quote created successfully',
      data: quote,
      timestamp: new Date().toISOString(),
      statusCode: 201,
    };
  }

  // PATCH /quotes/{id} - Update quote
  if (method === 'PATCH' && id) {
    logger.info(`PATCH /quotes/${id} - Updating quote`);

    if (isNaN(id)) {
      return ApiResponseBuilder.badRequest('Invalid quote ID');
    }

    const { services } = req.body;

    // Validation
    const errors: string[] = [];
    if (services) {
      if (!Array.isArray(services) || services.length === 0) {
        errors.push('services array must contain at least one service');
      }

      if (Array.isArray(services)) {
        services.forEach((service: Service, index: number) => {
          if (!service.name) errors.push(`services[${index}].name is required`);
          if (service.quantity === undefined || service.quantity <= 0) errors.push(`services[${index}].quantity must be greater than 0`);
          if (!service.billingType) errors.push(`services[${index}].billingType is required`);
          if (service.value === undefined || service.value <= 0) errors.push(`services[${index}].value must be greater than 0`);
        });
      }
    }

    if (errors.length > 0) {
      return ApiResponseBuilder.validationError(errors);
    }

    const updateRequest: UpdateQuoteRequest = {
      services: services || undefined,
    };

    const quote = await quoteService.updateQuote(id, updateRequest);

    return ApiResponseBuilder.success(quote, 'Quote updated successfully');
  }

  // DELETE /quotes/{id} - Delete quote
  if (method === 'DELETE' && id) {
    logger.info(`DELETE /quotes/${id} - Deleting quote`);

    if (isNaN(id)) {
      return ApiResponseBuilder.badRequest('Invalid quote ID');
    }

    await quoteService.deleteQuote(id);

    return ApiResponseBuilder.success({ id }, 'Quote deleted successfully');
  }

  return ApiResponseBuilder.methodNotAllowed(`Method ${method} not allowed for this endpoint`);
};

export default withApiHandler(funcQuotes);
