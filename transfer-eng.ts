import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { spawn } from "child_process";
import { PassThrough } from "stream";

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function uploadVideo(videoUrl: string, fileName: string) {
  try {
    console.log("Starting FFmpeg processing stream...");

    // PassThrough stream acts as a bridge between FFmpeg output and R2 upload
    const uploadStream = new PassThrough();

    /**
     * FFmpeg Command Explained:
     * -i: Input URL
     * -map 0: Copy all streams (video, all audio, subtitles)
     * -c copy: Do not re-encode (super fast, preserves quality)
     * -disposition:a 0: Clear 'default' status from all audio tracks
     * -disposition:a:m:language:eng default: Set track with language 'eng' to default
     * -f mp4: Force MP4 output format
     * -movflags frag_keyframe+empty_moov+default_base_moof: Allows streaming MP4 output
     */
    const ffmpeg = spawn("ffmpeg", [
      "-i", videoUrl,
      "-map", "0",
      "-c", "copy",
      "-disposition:a", "0", 
      "-disposition:a:m:language:eng", "default",
      "-f", "mp4",
      "-movflags", "frag_keyframe+empty_moov+default_base_moof",
      "pipe:1", // Output to stdout
    ]);

    // Pipe FFmpeg output to our PassThrough stream
    ffmpeg.stdout.pipe(uploadStream);

    // Log FFmpeg errors for debugging
    ffmpeg.stderr.on("data", (data) => {
      if (data.toString().includes("Error")) {
        console.error(`FFmpeg Log: ${data}`);
      }
    });

    const upload = new Upload({
      client: r2Client,
      params: {
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileName,
        Body: uploadStream,
        ContentType: "video/mp4",
      },
    });

    upload.on("httpUploadProgress", (progress) => {
      console.log(`Uploaded: ${(progress.loaded / (1024 * 1024)).toFixed(2)} MB`);
    });

    await upload.done();
    console.log("Upload complete! English is now the default audio.");
  } catch (err) {
    console.error("Transfer failed:", err);
    process.exit(1);
  }
}

const [videoUrl, fileName] = process.argv.slice(2);
if (!videoUrl || !fileName) {
  console.error("Usage: ts-node transfer.ts <url> <filename>");
  process.exit(1);
}

uploadVideo(videoUrl, fileName);
