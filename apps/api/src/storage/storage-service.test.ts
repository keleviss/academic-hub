import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';

import {
  createStorageService,
  StorageObjectBodyError,
  type StorageEnvironment,
} from './storage-service.js';

const baseStorageConfig: StorageEnvironment = {
  NODE_ENV: 'development',
  S3_ACCESS_KEY_ID: 'minioadmin',
  S3_BUCKET: 'course-materials',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_FORCE_PATH_STYLE: true,
  S3_REGION: 'us-east-1',
  S3_SECRET_ACCESS_KEY: 'minioadmin123',
};

class MockS3Client {
  public readonly commands: object[] = [];

  constructor(
    private readonly handleCommand: (
      command: object,
      callNumber: number,
    ) => Promise<unknown> | unknown,
  ) {}

  async send(command: object): Promise<unknown> {
    this.commands.push(command);
    return this.handleCommand(command, this.commands.length);
  }
}

describe('createStorageService', () => {
  it('reports ok when the configured bucket exists', async () => {
    const client = new MockS3Client(() => ({}));
    const service = createStorageService({
      client,
      config: baseStorageConfig,
    });

    await expect(service.ensureBucketReady()).resolves.toEqual({
      status: 'ok',
    });

    expect(client.commands).toHaveLength(1);
    expect(client.commands[0]).toBeInstanceOf(HeadBucketCommand);
    expect((client.commands[0] as HeadBucketCommand).input).toMatchObject({
      Bucket: 'course-materials',
    });
  });

  it('creates a missing bucket in development', async () => {
    const client = new MockS3Client((_command, callNumber) => {
      if (callNumber === 1) {
        throw createS3Error('NotFound', 404);
      }

      return {};
    });
    const service = createStorageService({
      client,
      config: baseStorageConfig,
    });

    await expect(service.ensureBucketReady()).resolves.toEqual({
      status: 'ok',
    });

    expect(client.commands).toHaveLength(2);
    expect(client.commands[0]).toBeInstanceOf(HeadBucketCommand);
    expect(client.commands[1]).toBeInstanceOf(CreateBucketCommand);
    expect((client.commands[1] as CreateBucketCommand).input).toMatchObject({
      Bucket: 'course-materials',
    });
  });

  it('does not create a missing bucket in production', async () => {
    const client = new MockS3Client(() => {
      throw createS3Error('NoSuchBucket', 404);
    });
    const service = createStorageService({
      client,
      config: {
        ...baseStorageConfig,
        NODE_ENV: 'production',
      },
    });

    await expect(service.ensureBucketReady()).resolves.toEqual({
      reason: 'bucket_missing',
      status: 'degraded',
    });

    expect(client.commands).toHaveLength(1);
    expect(client.commands[0]).toBeInstanceOf(HeadBucketCommand);
  });

  it('normalizes unexpected storage failures for readiness checks', async () => {
    const client = new MockS3Client(() => {
      throw createS3Error('InternalError', 500);
    });
    const service = createStorageService({
      client,
      config: baseStorageConfig,
    });

    await expect(service.ensureBucketReady()).resolves.toEqual({
      reason: 'storage_unavailable',
      status: 'degraded',
    });
  });

  it('normalizes access-denied bucket checks separately', async () => {
    const client = new MockS3Client(() => {
      throw createS3Error('Forbidden', 403);
    });
    const service = createStorageService({
      client,
      config: baseStorageConfig,
    });

    await expect(service.ensureBucketReady()).resolves.toEqual({
      reason: 'bucket_unavailable',
      status: 'degraded',
    });
  });

  it('sends minimal object operation commands', async () => {
    const body = new Uint8Array([1, 2, 3]);
    const client = new MockS3Client((command) => {
      if (command instanceof GetObjectCommand) {
        return {
          Body: {
            transformToByteArray: () => Promise.resolve(body),
          },
          ContentLength: 3,
          ContentType: 'application/pdf',
          ETag: '"etag"',
          Metadata: { checksum: 'sha256-demo' },
        };
      }

      if (command instanceof HeadObjectCommand) {
        return {
          ContentLength: 3,
          ContentType: 'application/pdf',
          ETag: '"etag"',
          LastModified: new Date('2026-09-01T00:00:00.000Z'),
          Metadata: { checksum: 'sha256-demo' },
        };
      }

      return {};
    });
    const service = createStorageService({
      client,
      config: baseStorageConfig,
    });

    await service.putObject({
      body: Buffer.from('%PDF'),
      contentLength: 4,
      contentType: 'application/pdf',
      key: 'courses/demo/document.pdf',
      metadata: { checksum: 'sha256-demo' },
    });
    await expect(
      service.getObject('courses/demo/document.pdf'),
    ).resolves.toEqual({
      body,
      contentLength: 3,
      contentType: 'application/pdf',
      etag: '"etag"',
      key: 'courses/demo/document.pdf',
      metadata: { checksum: 'sha256-demo' },
    });
    await expect(
      service.headObject('courses/demo/document.pdf'),
    ).resolves.toMatchObject({
      contentLength: 3,
      contentType: 'application/pdf',
      etag: '"etag"',
      key: 'courses/demo/document.pdf',
      lastModified: new Date('2026-09-01T00:00:00.000Z'),
      metadata: { checksum: 'sha256-demo' },
    });
    await service.deleteObject('courses/demo/document.pdf');

    expect(client.commands.map((command) => command.constructor.name)).toEqual([
      'PutObjectCommand',
      'GetObjectCommand',
      'HeadObjectCommand',
      'DeleteObjectCommand',
    ]);
    expect((client.commands[0] as PutObjectCommand).input).toMatchObject({
      Bucket: 'course-materials',
      ContentLength: 4,
      ContentType: 'application/pdf',
      Key: 'courses/demo/document.pdf',
      Metadata: { checksum: 'sha256-demo' },
    });
    expect((client.commands[1] as GetObjectCommand).input).toMatchObject({
      Bucket: 'course-materials',
      Key: 'courses/demo/document.pdf',
    });
    expect((client.commands[2] as HeadObjectCommand).input).toMatchObject({
      Bucket: 'course-materials',
      Key: 'courses/demo/document.pdf',
    });
    expect((client.commands[3] as DeleteObjectCommand).input).toMatchObject({
      Bucket: 'course-materials',
      Key: 'courses/demo/document.pdf',
    });
  });

  it('throws when a retrieved object has no readable body', async () => {
    const client = new MockS3Client(() => ({}));
    const service = createStorageService({
      client,
      config: baseStorageConfig,
    });

    await expect(service.getObject('missing-body.pdf')).rejects.toBeInstanceOf(
      StorageObjectBodyError,
    );
  });
});

function createS3Error(name: string, httpStatusCode: number): Error {
  const error = new Error(name);
  error.name = name;
  return Object.assign(error, {
    $metadata: {
      httpStatusCode,
    },
  });
}
