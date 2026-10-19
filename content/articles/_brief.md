# Brief for I Need Save articles (Indonesian)

Site: https://ineedsave.com — free web tool to download videos, photos and audio from social media. No app, no login.

## Facts you may state (and nothing beyond these)
- Works with public posts from: TikTok, Instagram (public posts; sometimes Instagram blocks requests or asks for login), Facebook, X (Twitter), Pinterest, Snapchat Spotlight, Tumblr, LinkedIn, Bluesky, Twitch clips, SoundCloud, Dailymotion, Imgur, 9GAG, Streamable.
- Does NOT currently work with YouTube, Reddit or Vimeo (those platforms block the server). Never claim YouTube support. Do not mention them unless you say they are not supported.
- How to use: in the app tap Share (Bagikan) -> Copy link (Salin tautan) -> open ineedsave.com -> paste in the box (or tap "Tempel") -> press "Unduh" -> choose an option.
- Options shown: Video in several qualities (e.g. 360p, 720p, 1080p depending on the post), Audio (original quality, and MP3 192 kbps converted from the video), Photo / Thumbnail.
- TikTok: the version without watermark is preferred when available; options that include a watermark are labeled "Watermark".
- Some videos need processing first (video and audio are joined, or a stream is converted to MP4): the button shows "Menyiapkan…" and the download starts automatically when ready.
- Files are streamed from the original platform to the user's device and are not stored on the I Need Save server.
- Private content, content that needs login, or region-restricted content cannot be downloaded.
- Android/computer: files go to the Downloads folder (Unduhan); the Gallery app may take a moment to show them.
- iPhone/iPad (Safari): files go to the Files app -> Downloads (Unduhan); to put a video into Photos, open it in Files -> Share -> Save Video (Simpan Video).
- Downloaded MP4s have a proper duration and play in gallery apps. Some TikTok videos use the HEVC (H.265) codec, which very old phones may not play smoothly; H.264 options play everywhere.
- The site is available in 93 languages and follows the device's light/dark theme.

## Writing rules
- Indonesian, friendly casual "kamu" style (like the site). Clear and practical, short paragraphs.
- 650–900 words of body text. Structure with <h2> sections (and <h3> if needed). Include a step-by-step <ol> where it fits and a short "Pertanyaan umum" section at the end with 2–4 Q&As as <h3> + <p>.
- SEO: put the main keyword naturally in the title, the first paragraph and at least one <h2>. No keyword stuffing. No competitor names. No made-up statistics. No promises like "100% always works".
- Legal/ethics: remind readers once, briefly, to download only for personal use and respect creators' copyright (ask permission before reposting, give credit).
- Internal links (use these exact hrefs): the tool "/" (anchor text like "I Need Save" or "halaman pengunduh"), and 1–2 related articles from the list below as "/artikel/<slug>/".
- Allowed HTML in "body" only: <h2> <h3> <p> <ul> <ol> <li> <strong> <em> <a href="..."> and <div class="tip"><p>…</p></div> for one optional tip box. No inline styles, no images, no <h1> (the page adds the H1 from "title").

## Output: one JSON file per article at C:/Users/ASUS/ineedsave/content/articles/<slug>.json
{
  "slug": "...",
  "title": "...",                        // max ~65 characters, includes the main keyword
  "description": "...",                  // meta description, 120–155 characters
  "tags": ["Panduan", "TikTok"],         // 1–2 short category tags
  "date": "2026-10-xx",                  // given below
  "icon": "...",                         // given below (used for the cover image)
  "body": "<p>…</p><h2>…</h2>…"
}
UTF-8, no BOM, valid JSON (escape quotes inside HTML properly).

## The 10 articles (slug | title idea | date | icon)
1. cara-download-video-tiktok-tanpa-watermark | Cara Download Video TikTok Tanpa Watermark (Gratis, Tanpa Aplikasi) | 2026-10-18 | tiktok
2. cara-download-video-reels-instagram | Cara Download Video dan Reels Instagram di HP dan Laptop | 2026-10-17 | instagram
3. cara-download-video-facebook | Cara Download Video Facebook ke Galeri HP | 2026-10-16 | facebook
4. cara-download-video-twitter-x | Cara Download Video dari X (Twitter) dengan Mudah | 2026-10-15 | x
5. cara-ubah-video-jadi-mp3 | Cara Mengubah Video Media Sosial Jadi MP3 Tanpa Aplikasi | 2026-10-14 | mp3
6. cara-download-video-pinterest | Cara Menyimpan Video dan Foto Pinterest ke Galeri | 2026-10-13 | pinterest
7. lokasi-file-download-android-iphone | Di Mana File Hasil Download Tersimpan? Panduan Android dan iPhone | 2026-10-12 | folder
8. perbedaan-kualitas-video-360p-720p-1080p | Perbedaan Kualitas Video 360p, 720p, dan 1080p: Pilih yang Mana? | 2026-10-11 | quality
9. video-hasil-download-tidak-bisa-diputar | Video Hasil Download Tidak Bisa Diputar? Ini Penyebab dan Solusinya | 2026-10-10 | play
10. etika-dan-hak-cipta-download-konten | Bolehkah Download Konten Media Sosial? Etika dan Hak Cipta yang Perlu Diketahui | 2026-10-09 | copyright
