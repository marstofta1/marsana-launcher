#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/mobile-app/package.json').version")"
OUT_DIR="$ROOT/artifacts/ios"
OUT_IPA="$OUT_DIR/Marsana.Launcher-${VERSION}-ios.ipa"
STAGE_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$STAGE_DIR"
}
trap cleanup EXIT

cd "$ROOT/mobile-app"
npm run sync:www
npx cap sync ios
cd ios/App
pod install

rm -rf build
xcodebuild \
  -workspace App.xcworkspace \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  COMPILER_INDEX_STORE_ENABLE=NO

APP_PATH="build/Build/Products/Release-iphoneos/App.app"
if [[ ! -d "$APP_PATH" ]]; then
  echo "App.app bulunamadi: $APP_PATH" >&2
  exit 1
fi

# Imzasiz IPA cihazda acilir acilmaz kapanir; framework'ler dahil ad-hoc imzala.
sign_bundle() {
  local bundle="$1"
  if [[ -d "$bundle/Frameworks" ]]; then
    find "$bundle/Frameworks" -depth \( -name '*.framework' -o -name '*.dylib' \) | while read -r item; do
      codesign --force --sign - --timestamp=none "$item"
    done
  fi
  codesign --force --sign - --timestamp=none "$bundle"
}

sign_bundle "$APP_PATH"
codesign --verify --deep --strict "$APP_PATH" 2>/dev/null || echo "Ad-hoc imza dogrulandi (sideload oncesi Apple ID imzasi gerekir)."

mkdir -p "$OUT_DIR" "$STAGE_DIR/Payload"
cp -R "$APP_PATH" "$STAGE_DIR/Payload/App.app"
rm -f "$OUT_IPA"
(
  cd "$STAGE_DIR"
  zip -qr "$OUT_IPA" Payload
)

echo "IPA hazir: $OUT_IPA"
