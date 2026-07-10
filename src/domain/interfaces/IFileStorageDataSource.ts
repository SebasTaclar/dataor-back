import { StoredFile, UploadFile } from '../entities/StoredFile';

export interface IFileStorageDataSource {
  upload(tableName: string, entityId: number, file: UploadFile): Promise<StoredFile>;
  deleteMany(files: StoredFile[]): Promise<void>;
  buildPublicUrl(key: string): string;
}
