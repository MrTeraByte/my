import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
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
    console.log("Starting English-only stream transfer...");

    const response = await axios({
      method: 'get',
      url: videoUrl,
      responseType: 'stream'
    });

    const ffmpegOutputBridge = new PassThrough();

    const command = ffmpeg(response.data)
      .outputOptions([
        "-map 0:v:0",             // Keep the first video track
        "-map 0:a:m:language:eng", // ONLY keep English audio tracks
        "-c copy",                // Copying is fast and uses 0% CPU for re-encoding
        "-f mp4",
        "-movflags frag_keyframe+empty_moov+default_base_moof"
      ])
      .on("error", (err) => console.error("FFmpeg Error:", err))
      .on("end", () => console.log("Processing finished."));

    command.pipe(ffmpegOutputBridge);

    const upload = new Upload({
      client: r2Client,
      params: {
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: fileName,
        Body: ffmpegOutputBridge,
        ContentType: "video/mp4",
      },
    });

    upload.on("httpUploadProgress", (p) => console.log(`Uploaded: ${p.loaded} bytes`));

    await upload.done();
    console.log("Upload complete! All non-English tracks stripped.");
  } catch (err) {
    console.error("Transfer failed:", err);
    process.exit(1);
  }
}

const [videoUrl, fileName] = process.argv.slice(2);
uploadVideo(videoUrl, fileName);
