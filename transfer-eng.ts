import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { spawn } from "child_process";
import axios from "axios";
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

// Helper to run FFmpeg as a Promise
const runFFmpeg = (args: string[]) => {
  return new Promise((resolve, reject) => {
    const process = spawn("ffmpeg", args);
    process.stderr.on("data", (data) => console.log(`FFmpeg: ${data.toString().trim()}`));
    process.on("close", (code) => (code === 0 ? resolve(true) : reject(`FFmpeg failed with code ${code}`)));
  });
};

async function uploadVideo(videoUrl: string, fileName: string) {
  const tempInput = path.join(__dirname, "input_video.mp4");
  const tempOutput = path.join(__dirname, "output_video.mp4");

  try {
    // 1. Download the file to disk
    console.log("--- Step 1: Downloading file to disk ---");
    const response = await axios({
      method: 'get',
      url: videoUrl,
      responseType: 'stream',
    });
    
    const writer = fs.createWriteStream(tempInput);
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    console.log("Download finished.");

    // 2. Process with FFmpeg
    console.log("--- Step 2: Setting English as default audio ---");
    /**
     * -disposition:a 0 -> Clears all default flags
     * -disposition:a:m:language:eng default -> Sets any 'eng' track to default
     * -movflags +faststart -> Optimizes for web/TV playback
     */
    await runFFmpeg([
      "-i", tempInput,
      "-map", "0",
      "-c", "copy",
      "-disposition:a", "0",
      "-disposition:a:m:language:eng", "default",
      "-movflags", "+faststart",
      tempOutput
    ]);

    // 3. Upload to R2
    console.log("--- Step 3: Uploading to R2 ---");
    const fileStream = fs.createReadStream(tempOutput);
    const upload = new Upload({
      client: r2Client,
      params: {
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileName,
        Body: fileStream,
        ContentType: "video/mp4",
      },
    });

    upload.on("httpUploadProgress", (progress) => {
      const mb = (progress.loaded || 0) / 1024 / 1024;
      console.log(`Uploaded: ${mb.toFixed(2)} MB`);
    });

    await upload.done();
    console.log("Upload complete!");

  } catch (err) {
    console.error("Transfer failed:", err);
  } finally {
    // Cleanup temporary files to keep the runner clean
    if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
    if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
  }
}

const [videoUrl, fileName] = process.argv.slice(2);
uploadVideo(videoUrl, fileName);
