#!/usr/bin/env bash
# ============================================================
# NikNote — brand icon generator
# Rebuilds every PWA / favicon / Android launcher + splash asset
# from the single official website logo (public/niknote-logo.png)
# so the website and the phone APK can never drift apart.
# Requires: imagemagick (`convert`)
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

LOGO="public/niknote-logo.png"
MARK_TMP="$(mktemp -d)/niknote-mark.png"
ICONS="public/icons"
AND="android/app/src/main/res"
BG="#FFFFFF"

# 1. Extract the sparkle mark (left half of the wordmark) with transparency
convert "$LOGO" -crop 255x240+245+248 +repage -fuzz 8% -trim +repage -depth 8 "$MARK_TMP"
MARK_W=$(identify -format "%w" "$MARK_TMP")

# make_icon <out> <canvas> <mark-width-ratio> <background|none>
make_icon() {
  local out="$1" canvas="$2" ratio="$3" bg="${4:-$BG}"
  local w=$(( canvas * ratio / 100 ))
  local h=$(( w * 198 / 228 ))
  local mark="$MARK_TMP"
  if [ "$bg" = "none" ]; then
    convert "$mark" -resize "${w}x${h}" -depth 8 -background none -gravity center -extent "${canvas}x${canvas}" "$out"
  else
    convert "$mark" -resize "${w}x${h}" -depth 8 \
      \( -size "${canvas}x${canvas}" "xc:$bg" \) +swap \
      -gravity center -composite "$out"
  fi
}

mkdir -p "$ICONS"

# 2. PWA / browser icons (opaque white, mark at 76%)
for s in 72 96 128 144 152 192 384 512; do
  make_icon "$ICONS/icon-${s}x${s}.png" "$s" 76
done
# Apple touch icon (180, no transparency — iOS requirement)
make_icon "$ICONS/apple-touch-icon.png" 180 76
# Maskable icon (safe zone: mark at 54%)
make_icon "$ICONS/icon-maskable-512.png" 512 54
make_icon "$ICONS/icon-maskable-192.png" 192 54
# Browser tab favicons
make_icon "$ICONS/favicon-32x32.png" 32 80
make_icon "$ICONS/favicon-16x16.png" 16 84
convert "$ICONS/favicon-16x16.png" "$ICONS/favicon-32x32.png" -define icon:auto-resize=48,32,16 public/favicon.ico

# 3. Android launcher icons (legacy + round + adaptive foreground)
declare -A DPI=( [mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192 )
declare -A FG=( [mdpi]=108 [hdpi]=162 [xhdpi]=216 [xxhdpi]=324 [xxxhdpi]=432 )
for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  s=${DPI[$d]}
  make_icon "$AND/mipmap-$d/ic_launcher.png" "$s" 76
  # round icon: circular white plate
  make_icon "$AND/mipmap-$d/ic_launcher_round.png" "$s" 64 none
  convert -size "${s}x${s}" xc:none -fill white -draw "circle $((s/2)),$((s/2)) $((s/2)),2" \
    "$AND/mipmap-$d/_round_bg.png"
  convert "$AND/mipmap-$d/_round_bg.png" \
    \( "$MARK_TMP" -resize "$((s*66/100))x" \) -gravity center -composite \
    "$AND/mipmap-$d/ic_launcher_round.png"
  rm -f "$AND/mipmap-$d/_round_bg.png"
  # adaptive foreground (transparent, artwork inside the 66/108 safe zone)
  f=${FG[$d]}
  convert "$MARK_TMP" -resize "$((f*58/100))x" -background none -gravity center -extent "${f}x${f}" \
    "$AND/mipmap-$d/ic_launcher_foreground.png"
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
    <color name="ic_launcher_background">#FFFFFF</color>
</resources>
XML

# 4. Android splash screens — official NikNote wordmark centred on white
splash() { # out width height
  local out="$1" w="$2" h="$3"
  local min=$(( w < h ? w : h ))
  convert -size "${w}x${h}" xc:white \
    \( public/niknote-logo.png -resize "$((min*66/100))x" -depth 8 \) -gravity center -composite "$out"
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

echo "✔ Brand icons + Android launcher/splash generated from $LOGO"
