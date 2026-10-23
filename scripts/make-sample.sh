#!/usr/bin/env bash
set -euo pipefail
# Rebuild the original, openly licensed sample. Requires ImageMagick and FFmpeg.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRAME="$(mktemp --suffix=.png)"
trap 'rm -f "$FRAME"' EXIT
convert -background none "$ROOT/scripts/sample.svg" "$FRAME"
ffmpeg -hide_banner -loglevel error -y -i "$FRAME" \
  -f lavfi -i 'sine=frequency=220:sample_rate=48000:duration=12' \
  -vf "zoompan=z='1+0.00035*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=288:s=960x540:fps=24,format=yuv420p" \
  -af 'volume=0.025,afade=t=in:d=1,afade=t=out:st=11:d=1' \
  -t 12 -c:v libx264 -crf 23 -preset fast -g 24 -keyint_min 24 -sc_threshold 0 \
  -c:a aac -b:a 64k -movflags +faststart "$ROOT/public/sample.mp4"
ffmpeg -hide_banner -loglevel error -y -ss 2 -i "$ROOT/public/sample.mp4" \
  -frames:v 1 -vf scale=800:-1 -q:v 3 "$ROOT/public/sample-poster.jpg"
