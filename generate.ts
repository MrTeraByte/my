import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import * as fs from 'fs';

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function build() {
  const response = await s3Client.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME }));
  const movies = response.Contents?.filter(f => !f.Key?.endsWith('/')) || [];
  
  const movieLinks = movies.map(m => {
    const videoUrl = `${process.env.R2_PUBLIC_URL}/${m.Key}`;
    const fileName = m.Key || "Unknown File";
    return `<a href="${videoUrl}" class="movie-link" onclick="playVideo('${videoUrl}'); return false;">${fileName}</a>`;
  }).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>TV Movie Portal</title>
    <style>
        body { background: #1a1a1a; color: #fff; font-family: sans-serif; margin: 0; padding: 20px; }
        .container { width: 100%; }
        .video-section { float: left; width: 65%; }
        .list-section { float: right; width: 30%; background: #222; padding: 10px; border: 1px solid #444; height: 85vh; overflow-y: auto; }
        video { width: 100%; background: #000; border: 1px solid #555; }
        .seek-box { margin-top: 20px; padding: 15px; background: #333; }
        input { padding: 15px; font-size: 20px; width: 100px; vertical-align: middle; }
        button { padding: 15px 25px; font-size: 20px; background: #00bfff; color: #fff; border: none; vertical-align: middle; }
        .movie-link { display: block; padding: 15px; color: #00bfff; text-decoration: none; border-bottom: 1px solid #333; font-size: 18px; }
        .movie-link:focus, button:focus, input:focus { background: yellow; color: #000; outline: none; }
        .clearfix:after { content: ""; display: table; clear: both; }
    </style>
</head>
<body>

    <div class="container clearfix">
        <div class="video-section">
            <video id="tvPlayer" controls preload="auto">
                <p>HTML5 Video not supported</p>
            </video>

            <div class="seek-box">
                <input type="number" id="seekMin" placeholder="Min" value="0">
                <button onclick="manualSeek()">Seek to Minute</button>
            </div>
        </div>

        <div class="list-section">
            <h3 style="margin: 0 0 10px 0;">Movie List</h3>
            ${movieLinks}
        </div>
    </div>

    <script type="text/javascript">
        var player = document.getElementById('tvPlayer');

        function playVideo(url) {
            player.src = url;
            player.load();
            player.play();
        }

        function manualSeek() {
            var min = document.getElementById('seekMin').value;
            var targetSeconds = parseInt(min) * 60;
            
            if (isNaN(targetSeconds)) return;

            // Tizen 2.1 logic: 
            // 1. Ensure the video is in a 'playing' state before seeking
            // 2. Try fastSeek if available, otherwise use currentTime
            
            if (player.readyState > 0) {
                try {
                    if (player.fastSeek) {
                        player.fastSeek(targetSeconds);
                    } else {
                        player.currentTime = targetSeconds;
                    }
                } catch (e) {
                    // Fallback: If direct seek fails, re-load with time fragment
                    var currentSrc = player.currentSrc.split('#')[0];
                    player.src = currentSrc + "#t=" + targetSeconds;
                    player.load();
                    player.play();
                }
            } else {
                alert("Wait for video to start before seeking.");
            }
        }
    </script>

</body>
</html>`;

  if (!fs.existsSync('dist')) fs.mkdirSync('dist');
  fs.writeFileSync('dist/index.html', html);
  console.log("Website generated in /dist");
}

build();
