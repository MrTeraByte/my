import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function processAndUpload(videoUrl: string, fileName: string) {
  // Use the 'runner' temp directory which usually has the most space
  const localTempFile = path.join(process.cwd(), `temp_output.mp4`);

  try {
    console.log(`Starting processing for: ${fileName}`);

    await new Promise((resolve, reject) => {
      ffmpeg(videoUrl) // FFmpeg reads directly from the URL (saves 5GB disk space)
        .outputOptions([
          "-map 0:v:0",
          "-map 0:a:m:language:eng", // Select English
          "-c copy",                  // Fast, no CPU heat
          "-disposition:a:0 default", 
          "-movflags +faststart"      // Essential for TV/Web seeking
        ])
        .on("start", (cmd) => console.log("FFmpeg started..."))
        .on("progress", (p) => console.log(`Processing: ${p.percent}% done`))
        .on("error", (err) => reject(err))
        .on("end", () => resolve(true))
        .save(localTempFile); // Only THIS file takes up disk space
    });

    console.log("Processing finished. Starting upload to R2...");
    
    const fileStream = fs.createReadStream(localTempFile);
    const upload = new Upload({
      client: r2Client,
      params: {
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: fileName.endsWith('.mp4') ? fileName : `${fileName}.mp4`,
        Body: fileStream,
        ContentType: "video/mp4",
      },
      queueSize: 4, // Upload parts in parallel
      partSize: 10 * 1024 * 1024, // 10MB chunks
    });

    upload.on("httpUploadProgress", (p) => {
      console.log(`Uploaded: ${((p.loaded || 0) / 1024 / 1024).toFixed(2)} MB`);
    });

    await upload.done();
    console.log("🚀 Success! Uploaded to R2.");

  } catch (err) {
    console.error("Workflow failed:", err);
    process.exit(1);
  } finally {
    if (fs.existsSync(localTempFile)) {
      fs.unlinkSync(localTempFile);
      console.log("Cleaned up local temp file.");
    }
  }
}

const [videoUrl, fileName] = process.argv.slice(2);
processAndUpload(videoUrl, fileName);
