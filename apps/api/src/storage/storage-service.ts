import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  type GetObjectCommandOutput,
  HeadBucketCommand,
  HeadObjectCommand,
  type HeadObjectCommandOutput,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';

import { env, type Env } from '../config/env.js';

export type StorageEnvironment = Pick<
  Env,
  | 'NODE_ENV'
  | 'S3_ACCESS_KEY_ID'
  | 'S3_BUCKET'
  | 'S3_ENDPOINT'
  | 'S3_FORCE_PATH_STYLE'
  | 'S3_REGION'
  | 'S3_SECRET_ACCESS_KEY'
>;

export type StorageReadinessResult =
  | { status: 'ok' }
  | { reason: StorageFailureReason; status: 'degraded' };

export type StorageFailureReason =
  | 'bucket_missing'
  | 'bucket_unavailable'
  | 'storage_unavailable';

export type StorageObjectBody = Buffer | Uint8Array | string;

export interface PutStorageObjectInput {
  body: StorageObjectBody;
  contentLength?: number;
  contentType?: string;
  key: string;
  metadata?: Record<string, string>;
}

export interface GetStorageObjectResult {
  body: Uint8Array;
  contentLength?: number;
  contentType?: string;
  etag?: string;
  key: string;
  metadata: Record<string, string>;
}

export interface HeadStorageObjectResult {
  contentLength?: number;
  contentType?: string;
  etag?: string;
  key: string;
  lastModified?: Date;
  metadata: Record<string, string>;
}

export interface StorageService {
  checkBucketReadiness(): Promise<StorageReadinessResult>;
  deleteObject(key: string): Promise<void>;
  ensureBucketReady(): Promise<StorageReadinessResult>;
  getObject(key: string): Promise<GetStorageObjectResult>;
  headObject(key: string): Promise<HeadStorageObjectResult>;
  putObject(input: PutStorageObjectInput): Promise<void>;
}

interface S3CommandClient {
  send(command: object): Promise<unknown>;
}

export interface CreateStorageServiceOptions {
  client?: S3CommandClient;
  config?: StorageEnvironment;
}

export function createStorageService(
  options: CreateStorageServiceOptions = {},
): StorageService {
  const storageConfig = options.config ?? env;
  const client = options.client ?? createS3Client(storageConfig);

  async function checkBucketReadiness(): Promise<StorageReadinessResult> {
    try {
      await client.send(
        new HeadBucketCommand({
          Bucket: storageConfig.S3_BUCKET,
        }),
      );

      return { status: 'ok' };
    } catch (error) {
      return {
        reason: isMissingBucketError(error)
          ? 'bucket_missing'
          : classifyStorageFailure(error),
        status: 'degraded',
      };
    }
  }

  return {
    checkBucketReadiness,

    async deleteObject(key: string): Promise<void> {
      await client.send(
        new DeleteObjectCommand({
          Bucket: storageConfig.S3_BUCKET,
          Key: key,
        }),
      );
    },

    async ensureBucketReady(): Promise<StorageReadinessResult> {
      const readiness = await checkBucketReadiness();
      if (
        readiness.status === 'ok' ||
        readiness.reason !== 'bucket_missing' ||
        !canCreateBucket(storageConfig)
      ) {
        return readiness;
      }

      try {
        await client.send(
          new CreateBucketCommand({
            Bucket: storageConfig.S3_BUCKET,
          }),
        );

        return { status: 'ok' };
      } catch {
        return {
          reason: 'bucket_unavailable',
          status: 'degraded',
        };
      }
    },

    async getObject(key: string): Promise<GetStorageObjectResult> {
      const output = (await client.send(
        new GetObjectCommand({
          Bucket: storageConfig.S3_BUCKET,
          Key: key,
        }),
      )) as GetObjectCommandOutput;

      if (!('Body' in output) || !output.Body) {
        throw new StorageObjectBodyError(key);
      }

      return {
        body: await output.Body.transformToByteArray(),
        contentLength: output.ContentLength,
        contentType: output.ContentType,
        etag: output.ETag,
        key,
        metadata: output.Metadata ?? {},
      };
    },

    async headObject(key: string): Promise<HeadStorageObjectResult> {
      const output = (await client.send(
        new HeadObjectCommand({
          Bucket: storageConfig.S3_BUCKET,
          Key: key,
        }),
      )) as HeadObjectCommandOutput;

      return {
        contentLength: output.ContentLength,
        contentType: output.ContentType,
        etag: output.ETag,
        key,
        lastModified: output.LastModified,
        metadata: output.Metadata ?? {},
      };
    },

    async putObject(input: PutStorageObjectInput): Promise<void> {
      await client.send(
        new PutObjectCommand({
          Body: input.body,
          Bucket: storageConfig.S3_BUCKET,
          ContentLength: input.contentLength,
          ContentType: input.contentType,
          Key: input.key,
          Metadata: input.metadata,
        }),
      );
    },
  };
}

export function createS3Client(
  storageConfig: StorageEnvironment = env,
): S3Client {
  const clientConfig: S3ClientConfig = {
    credentials: {
      accessKeyId: storageConfig.S3_ACCESS_KEY_ID,
      secretAccessKey: storageConfig.S3_SECRET_ACCESS_KEY,
    },
    endpoint: storageConfig.S3_ENDPOINT,
    forcePathStyle: storageConfig.S3_FORCE_PATH_STYLE,
    region: storageConfig.S3_REGION,
  };

  return new S3Client(clientConfig);
}

export class StorageObjectBodyError extends Error {
  constructor(key: string) {
    super(`Storage object ${key} did not include a readable body`);
    this.name = 'StorageObjectBodyError';
  }
}

function canCreateBucket(storageConfig: StorageEnvironment): boolean {
  return (
    storageConfig.NODE_ENV === 'development' ||
    storageConfig.NODE_ENV === 'test'
  );
}

function classifyStorageFailure(error: unknown): StorageFailureReason {
  if (getErrorStatusCode(error) === 403) {
    return 'bucket_unavailable';
  }

  return 'storage_unavailable';
}

function isMissingBucketError(error: unknown): boolean {
  const errorName = getErrorName(error);
  return (
    errorName === 'NotFound' ||
    errorName === 'NoSuchBucket' ||
    getErrorStatusCode(error) === 404
  );
}

function getErrorName(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.name;
  }

  if (isRecord(error) && typeof error.name === 'string') {
    return error.name;
  }

  return undefined;
}

function getErrorStatusCode(error: unknown): number | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  const metadata = error.$metadata;
  if (isRecord(metadata) && typeof metadata.httpStatusCode === 'number') {
    return metadata.httpStatusCode;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
