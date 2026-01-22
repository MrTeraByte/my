// transfer.ts
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import axios from "axios";

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function uploadVideo(videoUrl: string, fileName: string) {
  try {
    console.log("Starting download stream...");
    
    const response = await axios({
      method: 'get',
      url: videoUrl,
      responseType: 'stream'
    });

    const upload = new Upload({
      client: r2Client,
      params: {
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileName,
        Body: response.data, // This is the stream
        ContentType: "video/mp4", 
      },
    });

    upload.on("httpUploadProgress", (progress) => {
      console.log(`Uploaded: ${progress.loaded} bytes`);
    });

    await upload.done();
    console.log("Upload complete!");
  } catch (err) {
    console.error("Transfer failed:", err);
    process.exit(1);
  }
}

// Get arguments from the GitHub Action workflow
const [videoUrl, fileName] = process.argv.slice(2);
uploadVideo(videoUrl, fileName);