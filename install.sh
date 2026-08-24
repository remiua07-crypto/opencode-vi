#!/bin/sh
set -e

REPO="remiua07-crypto/opencode-vi"
PREFIX="${OPENCODE_VI_PREFIX:-$HOME/.opencode-vi}"

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "$os" in
  linux) os="linux" ;;
  darwin) os="darwin" ;;
  *) echo "Hệ điều hành không hỗ trợ: $os (hãy tải file zip cho Windows từ trang Releases)" >&2; exit 1 ;;
esac

arch="$(uname -m)"
case "$arch" in
  x86_64) arch="x64" ;;
  aarch64|arm64) arch="arm64" ;;
  *) echo "Kiến trúc không hỗ trợ: $arch" >&2; exit 1 ;;
esac

asset="opencode-$os-$arch.zip"
dir="${asset%.zip}"
url="https://github.com/$REPO/releases/latest/download/$asset"

echo "Đang tải $url ..."
tmp="$(mktemp -d)"
curl -fL "$url" -o "$tmp/$asset"
unzip -oq "$tmp/$asset" -d "$tmp/x"
mkdir -p "$PREFIX/bin"
install -m 0755 "$tmp/x/$dir/bin/opencode" "$PREFIX/bin/opencode"
rm -rf "$tmp"

case ":$PATH:" in
  *":$PREFIX/bin:"*) ;;
  *)
    echo
    echo "Thêm dòng sau vào ~/.bashrc hoặc ~/.zshrc rồi mở lại terminal:"
    echo "  export PATH=\"\$PATH:$PREFIX/bin\""
    ;;
esac

echo "Cài xong! Thử chạy: $PREFIX/bin/opencode --version"
