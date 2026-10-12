# Cognitive-Dissonance

Brain in a rat, 2026

Static implementation of the supplied 2560 × 1440 SVG composition. Desktop coordinates, original artwork, and the mobile layout are preserved.

The deployed page uses lossless WebP images, embedded as data URLs, with inline CSS. The visual first screen requires only the HTML document; it also starts a low-priority background download of the first film. The WebP source images and original SVG artwork remain in `dist/assets/` for future edits; the browser does not load those standalone files.

The main logo is 1455 × 403 pixels; navigation labels are rendered at twice the supplied natural width. Raster images are larger than the original vectors (59,522 bytes versus 28,846 bytes, excluding favicon). Reduced request count does not establish an improvement in real-world load time.

The main menu links to `2d-view.html`, `photo.html`, and `uihyun-oh.html`. RETURN on each subpage opens the main page. The reference artwork frames now contain the supplied media. PHOTO starts with the eleven process screenshots from the supplied Drive archive, followed by the three attached subway images. It supports circular previous/next navigation, arrow keys, and touch swipes. Images use responsive WebP files and preserve their complete composition within the original black frames; only nearby slides are loaded. The artist page contains the supplied Korean text in a scrollable panel using the specified Bookk Gothic typeface.

2D VIEW contains the four supplied films, beginning with `시퀀스 02.mp4`, followed by `confirm.mp4`, `confirm 5.mp4`, and `confirm 7.mp4`. The native video player supports playback, seeking, sound, and fullscreen. Previous/next arrows select a film. The home page immediately registers the project-scoped media worker and asks it to cache the first film in the background. Its download can continue during page navigation. 2D VIEW uses `preload="auto"` for that first film, with a WebP poster until ready; the other three films load on selection/play. Completed cached video is reused through HTTP byte-range responses, including Safari-style `bytes=0-1` probes and seeking. Early navigation and storage/network failures fall back to normal network playback without waiting for a full prefetch. H.264 MP4 delivery copies are at most 1920 × 1080, preserve source frame rates and audio presence, and use fast-start metadata. The originals remain in the user-supplied archive, not in the deployment.

`design-reference/` retains the uploaded SVG references. `scripts/build-pages.py` regenerates the three subpages from those references, `media.json`, the WebP navigation assets, `dist/pages.css`, `dist/gallery.js`, and `dist/video.js`. Styles, scripts, and small navigation artwork are inline; gallery photos and films are separate cacheable assets. The artist page embeds both unmodified Bookk Gothic font files directly, using the exact `BookkGothic-Lt` and `BookkGothic-Bd` faces specified in the design. Font swapping and synthetic bold are disabled. Desktop text scales from the original 27 px at 2560 px viewport width; mobile retains its readable text layout. Only the artist document includes the font payload. Font source: https://bookk.co.kr/font (WebP conversion does not apply to live text or CSS geometry).

Media source: the user-supplied Drive archive `으으웹_사진소스.zip`, file ID `1HDyKxlIKCrUXKOn4vs69HM_RkY_U5lUg`, and attachments `IMG_9560(1).jpeg`, `IMG_9563(1).jpeg`, and `IMG_9562(1).jpeg`. To reproduce delivery assets with Pillow and FFmpeg, extract the archive into a local directory and run `python scripts/prepare-media.py --source-dir <extracted-web-directory> --uploads-dir <attachment-directory>`, then `python scripts/build-pages.py`. The manifest records the original filenames and output metadata.

Public files are in `dist/`; no runtime dependencies or deployment build step are required.

## GitHub Pages

Repository: `uihyunoh/Cognitive-Dissonance`. All public links and the media-worker scope are relative, so the same `dist/` works at the domain root and at a GitHub project path. `.github/workflows/pages.yml` runs the media tests, uploads `dist/`, and publishes it with GitHub Pages. Enable GitHub Actions as the repository Pages source. No server, API keys, or runtime installation is needed.

Run `node --test tests/*.test.mjs` to verify home-page prefetch, cross-page cache reuse, concurrent requests, range handling, failure fallback, source fingerprints, and project-path links. These are automated logic and file tests, not measured browser startup latency. The original browser player still needs a real-browser check on the final GitHub Pages URL.
