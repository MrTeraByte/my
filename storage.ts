import { S3Client } from "@aws-sdk/client-s3";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

export const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_API_ENDPOINT!, //`https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function getBucketUsage(bucketName: string) {
  let continuationToken: string | undefined = undefined;
  let totalSize = 0;

  do {
    const response = await r2.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      for (const object of response.Contents) {
        totalSize += object.Size ?? 0;
      }
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;

  } while (continuationToken);

  return {
    totalBytes: totalSize,
    totalMB: (totalSize / 1024 / 1024).toFixed(2),
    totalGB: (totalSize / 1024 / 1024 / 1024).toFixed(2),
  };
}

const usage = await getBucketUsage(process.env.R2_BUCKET_NAME);

console.log("Total Used (bytes):", usage.totalBytes);
console.log("Total Used (MB):", usage.totalMB);
console.log("Total Used (GB):", usage.totalGB);
