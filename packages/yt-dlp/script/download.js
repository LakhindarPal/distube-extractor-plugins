/* eslint-disable no-console, @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */

const { YTDLP_DISABLE_DOWNLOAD, download } = require("..");

if (!YTDLP_DISABLE_DOWNLOAD) download().then(v => console.log(`[yt-dlp] Downloaded ${v} version!`));
