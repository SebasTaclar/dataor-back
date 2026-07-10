export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

export interface IR2DataSource {
  getPresignedUploadUrl(key: string, contentType: string, expiresIn?: number): Promise<PresignedUploadResult>;
  getPresignedUrl(key: string, expiresIn?: number): Promise<string>;
  deleteFile(key: string): Promise<void>;
  uploadFile(key: string, fileBuffer: Buffer, contentType: string): Promise<string>;
  buildPublicUrl(key: string): string;
}
