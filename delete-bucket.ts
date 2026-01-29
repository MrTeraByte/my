import { S3Client, ListObjectsV2Command, DeleteObjectsCommand, ObjectIdentifier } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_API_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function emptyBucket() {
  let truncated = true;
  let continuationToken: string | undefined;
  let bucketName = process.env.R2_BUCKET_NAME!;

  console.log(`Emptying bucket: ${bucketName}`);

  while (truncated) {
    const listResponse = await s3.send(new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: continuationToken,
    }));

    if (listResponse.Contents && listResponse.Contents.length > 0) {
      const objectsToDelete: ObjectIdentifier[] = listResponse.Contents.map((obj) => ({ Key: obj.Key }));

      await s3.send(new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: { Objects: objectsToDelete },
      }));
      
      console.log(`Deleted ${objectsToDelete.length} objects...`);
    }

    truncated = listResponse.IsTruncated || false;
    continuationToken = listResponse.NextContinuationToken;
  }

  console.log("Bucket is now empty.");
}

emptyBucket().catch(console.error);
