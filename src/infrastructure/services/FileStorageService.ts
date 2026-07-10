import { StoredFile, UploadFile } from '../../domain/entities/StoredFile';
import { IFileStorageDataSource } from '../../domain/interfaces/IFileStorageDataSource';
import { IR2DataSource } from '../../domain/interfaces/IR2DataSource';
import { Logger } from '../../shared/Logger';
import { v4 as uuidv4 } from 'uuid';

export class FileStorageService implements IFileStorageDataSource {
  private r2: IR2DataSource;
  private logger: Logger;

  constructor(logger: Logger, r2: IR2DataSource) {
    this.logger = logger;
    this.r2 = r2;
  }

  async upload(tableName: string, entityId: number, file: UploadFile): Promise<StoredFile> {
    const ext = this.getExtension(file.name);
    const uuid = uuidv4();
    const key = `${tableName}/${entityId}-${uuid}.${ext}`;

    this.logger.logInfo(`Uploading file: ${key}`);

    const url = await this.r2.uploadFile(key, file.buffer, file.type);

    const storedFile: StoredFile = {
      name: file.name,
      type: file.type,
      key,
      url,
    };

    this.logger.logInfo(`File uploaded successfully: ${key}`);
    return storedFile;
  }

  async uploadToFolder(folder: string, file: UploadFile): Promise<StoredFile> {
    const ext = this.getExtension(file.name);
    const uuid = uuidv4();
    const key = `${folder}/${uuid}.${ext}`;

    this.logger.logInfo(`Uploading file to folder: ${key}`);

    const url = await this.r2.uploadFile(key, file.buffer, file.type);

    const storedFile: StoredFile = {
      name: file.name,
      type: file.type,
      key,
      url,
    };

    this.logger.logInfo(`File uploaded successfully: ${key}`);
    return storedFile;
  }

  async deleteMany(files: StoredFile[]): Promise<void> {
    if (!files || files.length === 0) {
      return;
    }

    this.logger.logInfo(`Deleting ${files.length} files from storage`);

    const deletePromises = files.map(file => this.r2.deleteFile(file.key));
    await Promise.all(deletePromises);

    this.logger.logInfo(`Successfully deleted ${files.length} files`);
  }

  buildPublicUrl(key: string): string {
    return this.r2.buildPublicUrl(key);
  }

  private getExtension(filename: string): string {
    const parts = filename.split('.');
    if (parts.length > 1) {
      return parts.pop() || 'bin';
    }
    return 'bin';
  }
}
