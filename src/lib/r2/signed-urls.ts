import {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, getR2BucketName } from "./client";

export interface CreatePresignedPutOptions {
  objectKey: string;
  contentType: string;
  contentLength: number;
  expiresIn?: number; // seconds, default 900 (15 mins)
}

export interface CreatePresignedGetOptions {
  objectKey: string;
  expiresIn?: number; // seconds, default 3600 (1 hour)
  downloadFileName?: string;
}

export interface VerifyHeadResult {
  exists: boolean;
  valid: boolean;
  sizeBytes?: number;
  mimeType?: string;
  error?: string;
}

/**
 * Generates a presigned PUT URL for direct-to-R2 upload from the client browser.
 */
export async function createPresignedPutUrl({
  objectKey,
  contentType,
  contentLength,
  expiresIn = 900,
}: CreatePresignedPutOptions): Promise<string> {
  const client = getR2Client();
  const bucket = getR2BucketName();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Generates a short-lived presigned GET URL for viewing or downloading private files.
 */
export async function createPresignedGetUrl({
  objectKey,
  expiresIn = 3600,
  downloadFileName,
}: CreatePresignedGetOptions): Promise<string> {
  const client = getR2Client();
  const bucket = getR2BucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ...(downloadFileName
      ? {
          ResponseContentDisposition: `attachment; filename="${encodeURIComponent(
            downloadFileName
          )}"`,
        }
      : {
          ResponseContentDisposition: "inline",
        }),
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Performs a HEAD check on the R2 object to verify it was uploaded, matches expected size and MIME type.
 */
export async function verifyR2ObjectHead({
  objectKey,
  expectedSizeBytes,
  expectedMimeType,
}: {
  objectKey: string;
  expectedSizeBytes: number;
  expectedMimeType: string;
}): Promise<VerifyHeadResult> {
  const client = getR2Client();
  const bucket = getR2BucketName();

  try {
    const headCommand = new HeadObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    });

    const response = await client.send(headCommand);

    if (response.ContentLength === undefined) {
      return {
        exists: false,
        valid: false,
        error: "R2 object metadata does not contain ContentLength",
      };
    }

    if (response.ContentLength !== expectedSizeBytes) {
      return {
        exists: true,
        valid: false,
        sizeBytes: response.ContentLength,
        mimeType: response.ContentType,
        error: `Uploaded file size (${response.ContentLength} bytes) does not match expected size (${expectedSizeBytes} bytes)`,
      };
    }

    // MIME type check: normalize by removing parameters like charset
    const actualMime = (response.ContentType || "").split(";")[0].trim().toLowerCase();
    const expectedMime = expectedMimeType.split(";")[0].trim().toLowerCase();

    // If actual MIME is generic binary stream or matches expected
    if (
      actualMime &&
      expectedMime &&
      actualMime !== expectedMime &&
      actualMime !== "application/octet-stream"
    ) {
      return {
        exists: true,
        valid: false,
        sizeBytes: response.ContentLength,
        mimeType: response.ContentType,
        error: `Uploaded file MIME type (${actualMime}) does not match expected (${expectedMime})`,
      };
    }

    return {
      exists: true,
      valid: true,
      sizeBytes: response.ContentLength,
      mimeType: response.ContentType || expectedMimeType,
    };
  } catch (error: any) {
    if (
      error.name === "NotFound" ||
      error.$metadata?.httpStatusCode === 404 ||
      error.name === "NoSuchKey"
    ) {
      return {
        exists: false,
        valid: false,
        error: "Object does not exist in Cloudflare R2 storage",
      };
    }

    return {
      exists: false,
      valid: false,
      error: error.message || "Failed to query object metadata in Cloudflare R2",
    };
  }
}

/**
 * Deletes an object from Cloudflare R2.
 */
export async function deleteR2Object({ objectKey }: { objectKey: string }): Promise<void> {
  const client = getR2Client();
  const bucket = getR2BucketName();

  try {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    });
    await client.send(deleteCommand);
  } catch (error: any) {
    // If the object was already gone, treat as idempotent success
    if (
      error.name === "NotFound" ||
      error.$metadata?.httpStatusCode === 404 ||
      error.name === "NoSuchKey"
    ) {
      return;
    }
    console.error(`[SyncShelf R2] Failed to delete object ${objectKey}:`, error);
    throw error;
  }
}
