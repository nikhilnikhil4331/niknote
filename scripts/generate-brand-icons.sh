#!/usr/bin/env bash
# ============================================================
# NikNote — brand icon generator (letter logo edition)
# Builds every PWA / favicon / Android launcher + splash asset
# from the single official wordmark (public/niknote-logo.png).
#
# App icons carry the LETTER logo: the sparkle mark stacked
# above the "Niknote" script, so the APK home-screen icon
# actually says NikNote. Splash keeps the wide wordmark.
# Requires: imagemagick (`convert`)
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

LOGO="public/niknote-logo.png"
TMP="$(mktemp -d)"
WM="$TMP/wordmark.png"        # trimmed full wordmark (mark + letters)
MARK="$TMP/mark.png"          # sparkle only
LETTERS="$TMP/letters.png"    # "Niknote" script only
LOCKUP="$TMP/lockup.png"      # stacked square master (transparent)
ICONS="public/icons"
AND="android/app/src/main/res"
BG="#FFFFFF"

# 1. Trim the wordmark and split mark / letters at the natural gap
#    (measured on the trimmed artwork: mark 0–23% width, letters 35.5%+)
convert "$LOGO" -trim +repage -depth 8 "$WM"
W=$(identify -format "%w" "$WM"); H=$(identify -format "%h" "$WM")
MARK_W=$(( W * 23 / 100 )); LET_X=$(( W * 355 / 1000 )); LET_W=$(( W - LET_X ))
convert "$WM" -crop "${MARK_W}x${H}+0+0" +repage -trim +repage -depth 8 "$MARK"
convert "$WM" -crop "${LET_W}x${H}+${LET_X}+0" +repage -trim +repage -depth 8 "$LETTERS"

# 2. Stacked square master: sparkle on top, Niknote letters below
convert -size 1024x1024 xc:none \
  \( "$MARK" -resize 330x \) -gravity north -geometry +0+110 -composite \
  \( "$LETTERS" -resize 850x \) -gravity south -geometry +0+120 -composite \
  -depth 8 "$LOCKUP"

# make_icon <out> <canvas> <lockup-%> <background|none>
make_icon() {
  local out="$1" canvas="$2" ratio="$3" bg="${4:-$BG}"
  local inner=$(( canvas * ratio / 100 ))
  if [ "$bg" = "none" ]; then
    convert "$LOCKUP" -resize "${inner}x${inner}" -depth 8 -background none -gravity center -extent "${canvas}x${canvas}" "$out"
  else
    convert \( -size "${canvas}x${canvas}" "xc:$bg" \) \
      \( "$LOCKUP" -resize "${inner}x${inner}" -depth 8 \) \
      -gravity center -composite "$out"
  fi
}

mkdir -p "$ICONS"

# 3. PWA / browser icons (letter lockup on white)
for s in 72 96 128 144 152 192 384 512; do
  make_icon "$ICONS/icon-${s}x${s}.png" "$s" 100
done
make_icon "$ICONS/apple-touch-icon.png" 180 100
make_icon "$ICONS/icon-maskable-512.png" 512 78
make_icon "$ICONS/icon-maskable-192.png" 192 78
make_icon "$ICONS/favicon-32x32.png" 32 100
make_icon "$ICONS/favicon-16x16.png" 16 100
convert "$ICONS/favicon-16x16.png" "$ICONS/favicon-32x32.png" -define icon:auto-resize=48,32,16 public/favicon.ico

# 4. Android launcher icons (legacy square + round + adaptive foreground)
declare -A DPI=( [mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192 )
declare -A FG=( [mdpi]=108 [hdpi]=162 [xhdpi]=216 [xxhdpi]=324 [xxxhdpi]=432 )
for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  s=${DPI[$d]}
  make_icon "$AND/mipmap-$d/ic_launcher.png" "$s" 100
  # round icon: white disc with the letter lockup inside the circle
  convert -size "${s}x${s}" xc:none -fill white -draw "circle $((s/2)),$((s/2)) $((s/2)),2" "$TMP/round_bg.png"
  convert "$TMP/round_bg.png" \( "$LOCKUP" -resize "$((s*82/100))x$((s*82/100))" -depth 8 \) -gravity center -composite \
    "$AND/mipmap-$d/ic_launcher_round.png"
  # adaptive foreground (transparent; lockup kept inside the safe zone)
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
    <color name="ic_launcher_background">#FFFFFF</color>
</resources>
XML

# 5. Android splash screens — wide wordmark centred on white
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

rm -rf "$TMP"
echo "✔ Letter-logo brand icons + Android launcher/splash generated from $LOGO"
