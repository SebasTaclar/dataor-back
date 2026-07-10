import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IR2DataSource, PresignedUploadResult } from '../../domain/interfaces/IR2DataSource';
import { Logger } from '../../shared/Logger';

export class CloudflareR2Service implements IR2DataSource {
  private client: S3Client;
  private bucketName: string;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.bucketName = process.env.R2_BUCKET_NAME || '';

    const accountId = process.env.R2_ACCOUNT_ID || '';
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 900
  ): Promise<PresignedUploadResult> {
    this.logger.logInfo(`Generating presigned upload URL for: ${key}`);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });

    this.logger.logInfo(`Presigned upload URL generated for: ${key} (expires in ${expiresIn}s)`);

    return {
      uploadUrl,
      key,
      expiresIn,
    };
  }

  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    this.logger.logInfo(`Generating presigned download URL for: ${key}`);

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn });

    this.logger.logInfo(`Presigned download URL generated for: ${key}`);

    return url;
  }

  async deleteFile(key: string): Promise<void> {
    this.logger.logInfo(`Deleting file from R2: ${key}`);

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.client.send(command);

    this.logger.logInfo(`File deleted successfully: ${key}`);
  }

  async uploadFile(key: string, fileBuffer: Buffer, contentType: string): Promise<string> {
    this.logger.logInfo(`Uploading file to R2: ${key}`);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await this.client.send(command);

    const publicUrl = this.buildPublicUrl(key);
    this.logger.logInfo(`File uploaded successfully: ${key}`);

    return publicUrl;
  }

  buildPublicUrl(key: string): string {
    const publicUrl = process.env.R2_PUBLIC_URL || '';
    return `${publicUrl}/${key}`;
  }
}
