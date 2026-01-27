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
  // Fetch files from R2
  const response = await s3Client.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME }));
  const movies = response.Contents?.filter(f => !f.Key?.endsWith('/')) || [];
  
  const movieLinks = movies.map(m => {
    const videoUrl = `${process.env.R2_PUBLIC_URL}/${m.Key}`;
    const fileName = m.Key || "Unknown File";
    
    // We can still try to guess the MIME type for better TV support
    const ext = m.Key?.split('.').pop()?.toLowerCase();
    let type = "video/mp4"; // Default fallback
    if (ext === 'mkv') type = "video/x-matroska";
    if (ext === 'webm') type = "video/webm";

    return `<a href="${videoUrl}" data-type="${type}" class="movie-link" onclick="playVideo(this.href, this.getAttribute('data-type')); return false;">${fileName}</a>`;
  }).join('<br>');

  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>TV Movie Portal</title>
    <style>
        body { 
            background: #1a1a1a; 
            color: #ffffff; 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding-top: 20px; 
        }
        #player-wrapper {
            margin-bottom: 30px;
        }
        /* Fixed width as requested */
        video { 
            width: 800px; 
            background: #000; 
            border: 2px solid #444;
        }
        .link-container {
            text-align: left;
            display: inline-block;
            max-width: 800px;
            width: 100%;
        }
        .movie-link {
            display: block;
            padding: 15px;
            color: #00bfff;
            text-decoration: none;
            font-size: 1.2rem;
            border-bottom: 1px solid #333;
        }
        /* Critical for TV remote navigation */
        .movie-link:focus {
            background: #ffffff;
            color: #000000;
            outline: none;
        }
    </style>
</head>
<body>

    <div id="player-wrapper">
        <video id="tvPlayer" controls>
            Your TV browser is too old to support the HTML5 video tag.
        </video>
    </div>

    <div class="link-container">
        <h3>Select a Movie:</h3>
        ${movieLinks}
    </div>

    <script>
        function playVideo(url) {
            var player = document.getElementById('tvPlayer');
            player.src = url;
            player.load(); // Forces the player to update
            player.play();
            // Scroll back to top so user sees the video
            window.scrollTo(0,0);
        }
    </script>

</body>
</html>`;

  if (!fs.existsSync('dist')) fs.mkdirSync('dist');
  fs.writeFileSync('dist/index.html', html);
  console.log("Website generated in /dist");
}

build();
