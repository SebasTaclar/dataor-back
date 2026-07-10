import { Context, HttpRequest } from '@azure/functions';
import { Logger } from '../src/shared/Logger';
import { ApiResponseBuilder } from '../src/shared/ApiResponse';
import { getFileStorageService, getClientService } from '../src/shared/serviceProvider';
import { withApiHandler } from '../src/shared/apiHandler';
import { validateAuthToken } from '../src/shared/authHelper';
import { verifyToken } from '../src/shared/jwtHelper';
import { UploadFile } from '../src/domain/entities/StoredFile';
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
      limits: { fileSize: 50 * 1024 * 1024, files: 10, fields: 5, fieldSize: 1024 },
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

const funcFiles = async (_context: Context, req: HttpRequest, log: Logger): Promise<unknown> => {
  const method = req.method?.toUpperCase();
  const folder = req.params?.folder;
  const entityId = req.params?.entityId ? parseInt(req.params.entityId, 10) : null;
  const fileKey = req.params?.fileKey;

  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) {
    return ApiResponseBuilder.error('Unauthorized: Missing authorization header', 401);
  }

  try {
    const token = validateAuthToken(authHeader);
    const userPayload = verifyToken(token);
    log.logInfo(`User authenticated: ${userPayload.email}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    log.logError(`Authentication failed: ${errorMessage}`);
    return ApiResponseBuilder.error('Unauthorized: Invalid or expired token', 401);
  }

  if (!folder || !entityId) {
    return ApiResponseBuilder.badRequest('folder and entityId are required');
  }

  // POST /v1/files/{folder}/{entityId} - Upload file to entity
  if (method === 'POST') {
    log.logInfo(`Processing POST request for ${folder}/${entityId}`);

    let parsedData: ParsedMultipartData;
    try {
      parsedData = await parseMultipartData(req);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse multipart data';
      log.logError(errorMessage);
      return ApiResponseBuilder.badRequest(errorMessage);
    }

    if (parsedData.files.length === 0) {
      return ApiResponseBuilder.validationError(['No files provided']);
    }

    try {
      if (folder === 'clients') {
        const clientService = getClientService(log);
        const updatedClient = await clientService.addFilesToClient(entityId, parsedData.files);
        return ApiResponseBuilder.success(updatedClient, 'Files uploaded successfully');
      }

      // Default: upload to folder without entity association
      const fileStorageService = getFileStorageService(log);
      const uploadedFiles = [];
      for (const file of parsedData.files) {
        const storedFile = await fileStorageService.uploadToFolder(folder, file);
        uploadedFiles.push(storedFile);
      }
      return ApiResponseBuilder.success(uploadedFiles, 'Files uploaded successfully');
    } catch (error) {
      log.logError('Error uploading files', error);
      return ApiResponseBuilder.error('Error uploading files', 500);
    }
  }

  // DELETE /v1/files/{folder}/{entityId}/{fileKey} - Delete file from entity
  if (method === 'DELETE' && fileKey) {
    log.logInfo(`Processing DELETE request for ${folder}/${entityId}/${fileKey}`);

    try {
      if (folder === 'clients') {
        const clientService = getClientService(log);
        const updatedClient = await clientService.removeFileFromClient(entityId, fileKey);
        return ApiResponseBuilder.success(updatedClient, 'File deleted successfully');
      }

      // Default: delete by key
      const fileStorageService = getFileStorageService(log);
      await fileStorageService.deleteMany([{ name: '', type: '', key: fileKey, url: '' }]);
      return ApiResponseBuilder.success(null, 'File deleted successfully');
    } catch (error) {
      log.logError('Error deleting file', error);
      return ApiResponseBuilder.error('File not found or could not be deleted', 404);
    }
  }

  return ApiResponseBuilder.methodNotAllowed(`HTTP method ${method} not supported`);
};

export default withApiHandler(funcFiles);
