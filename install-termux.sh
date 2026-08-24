#!/bin/sh
# Cài opencode bản Việt hóa lên Termux (Android aarch64) — không cần proot
set -e

REPO="remiua07-crypto/opencode-vi"

if [ -z "$TERMUX_VERSION" ]; then
  echo "❌ Script này chỉ chạy trong Termux. Hãy cài Termux từ F-Droid (không dùng bản Play Store)."
  exit 1
fi

if [ "$(uname -m)" != "aarch64" ]; then
  echo "❌ Chỉ hỗ trợ máy Android 64-bit (aarch64). Kiến trúc hiện tại: $(uname -m)"
  exit 1
fi

echo "== [1/4] Cài gói phụ thuộc (glibc, git, ripgrep) =="
pkg install -y glibc-repo >/dev/null 2>&1 || true
pkg install -y glibc git ripgrep curl unzip

LOADER="$PREFIX/glibc/lib/ld-linux-aarch64.so.1"
if [ ! -f "$LOADER" ]; then
  echo "❌ Không tìm thấy glibc loader tại $LOADER. Thử: pkg install glibc rồi chạy lại."
  exit 1
fi

DEST="$HOME/.opencode-vi"
ASSET="opencode-linux-arm64.zip"
DIR="${ASSET%.zip}"
URL="https://github.com/$REPO/releases/latest/download/$ASSET"

echo "== [2/4] Tải opencode-vi (~60MB) =="
TMP="$(mktemp -d)"
curl -fL "$URL" -o "$TMP/$ASSET"
unzip -oq "$TMP/$ASSET" -d "$TMP/x"
mkdir -p "$DEST/bin"
install -m 0755 "$TMP/x/$DIR/bin/opencode" "$DEST/bin/opencode"
rm -rf "$TMP"

echo "== [3/4] Tạo lệnh 'opencode' =="
WRAPPER="$PREFIX/bin/opencode"
cat > "$WRAPPER" <<EOF
#!$PREFIX/bin/sh
unset LD_PRELOAD LD_LIBRARY_PATH
exec "$LOADER" --library-path "\$PREFIX/glibc/lib" "$DEST/bin/opencode" "\$@"
EOF
chmod +x "$WRAPPER"

echo "== [4/4] Hoàn tất =="
"$DEST/bin/opencode" --version && echo "" || true
cat <<'MUI'

✅ Đã cài xong opencode bản Việt hóa!

Cách dùng:
  cd ~/thu-muc-du-an
  opencode            # mở giao diện TUI tiếng Việt
  opencode run "..."  # chạy một câu lệnh

Cấu hình AI provider (ví dụ):
  export ANTHROPIC_API_KEY="sk-..."
  export OPENAI_API_KEY="sk-..."

Gõ 'opencode' trong bất kỳ thư mục dự án nào để bắt đầu.
MUI
