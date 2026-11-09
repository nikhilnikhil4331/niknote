#!/usr/bin/env bash
# ============================================================
# NikNote — primary pink/blue brand icon generator
# App icons use the pink/blue/yellow notebook mark for legibility;
# the full black NikNote wordmark is reserved for wider lockups/splashes.
# Requires: ImageMagick (`convert`).
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

LOGO="public/niknote-logo.png"
ICON_SOURCE="public/images/brand/niknote-primary-icon.png"
TMP="$(mktemp -d)"
ICON="$TMP/icon.png"
ICONS="public/icons"
AND="android/app/src/main/res"
BG="#FFFDF5"

cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

# Keep breathing room in the square mark so platform masks do not clip the star.
convert "$ICON_SOURCE" -resize 448x448 -gravity center -background none -extent 512x512 -depth 8 "$ICON"

# make_icon <out> <canvas-size> <artwork-percent> <background|none>
make_icon() {
  local out="$1" canvas="$2" ratio="$3" bg="${4:-$BG}"
  local inner=$(( canvas * ratio / 100 ))
  if [ "$bg" = "none" ]; then
    convert "$ICON" -resize "${inner}x${inner}" -depth 8 -background none -gravity center -extent "${canvas}x${canvas}" "$out"
  else
    convert \( -size "${canvas}x${canvas}" "xc:$bg" \) \
      \( "$ICON" -resize "${inner}x${inner}" -depth 8 \) \
      -gravity center -composite "$out"
  fi
}

mkdir -p "$ICONS"

# PWA/browser and Apple home-screen icons: mark-only, centered on warm paper.
for s in 72 96 128 144 152 192 384 512; do
  make_icon "$ICONS/icon-${s}x${s}.png" "$s" 100
done
make_icon "$ICONS/apple-touch-icon.png" 180 100
make_icon "$ICONS/icon-maskable-512.png" 512 78
make_icon "$ICONS/icon-maskable-192.png" 192 78
make_icon "$ICONS/favicon-32x32.png" 32 100
make_icon "$ICONS/favicon-16x16.png" 16 100
convert "$ICONS/favicon-16x16.png" "$ICONS/favicon-32x32.png" -define icon:auto-resize=48,32,16 public/favicon.ico

# Android launcher icons: same distinctive mark, safe-zone sized foreground.
declare -A DPI=( [mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192 )
declare -A FG=( [mdpi]=108 [hdpi]=162 [xhdpi]=216 [xxhdpi]=324 [xxxhdpi]=432 )
for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  s=${DPI[$d]}
  make_icon "$AND/mipmap-$d/ic_launcher.png" "$s" 100
  convert -size "${s}x${s}" xc:none -fill "$BG" -draw "circle $((s/2)),$((s/2)) $((s/2)),2" "$TMP/round_bg.png"
  convert "$TMP/round_bg.png" \( "$ICON" -resize "$((s*82/100))x$((s*82/100))" -depth 8 \) -gravity center -composite \
    "$AND/mipmap-$d/ic_launcher_round.png"
  f=${FG[$d]}
  make_icon "$AND/mipmap-$d/ic_launcher_foreground.png" "$f" 84 none
done
mkdir -p "$AND/mipmap-anydpi-v26"
cat > "$AND/mipmap-anydpi-v26/ic_launcher.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
XML
cp "$AND/mipmap-anydpi-v26/ic_launcher.xml" "$AND/mipmap-anydpi-v26/ic_launcher_round.xml"
cat > "$AND/values/ic_launcher_background.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#FFFDF5</color>
</resources>
XML

# Android splash screens retain the complete primary mark + black wordmark.
splash() {
  local out="$1" w="$2" h="$3"
  local min=$(( w < h ? w : h ))
  convert -size "${w}x${h}" "xc:$BG" \
    \( "$LOGO" -resize "$((min*66/100))x" -depth 8 \) -gravity center -composite "$out"
}
mkdir -p "$AND/drawable"
splash "$AND/drawable/splash.png" 720 1280
for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  case $d in
    mdpi) pw=320; ph=480 ;; hdpi) pw=480; ph=800 ;; xhdpi) pw=720; ph=1280 ;;
    xxhdpi) pw=960; ph=1600 ;; xxxhdpi) pw=1280; ph=1920 ;;
  esac
  mkdir -p "$AND/drawable-port-$d" "$AND/drawable-land-$d"
  splash "$AND/drawable-port-$d/splash.png" "$pw" "$ph"
  splash "$AND/drawable-land-$d/splash.png" "$ph" "$pw"
done

echo "✔ Pink/blue NikNote mark icons and full-logo Android splashes generated from $LOGO"
