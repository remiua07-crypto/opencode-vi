# opencode-vi trên Android (Termux)

Bản việt hóa opencode chạy **trực tiếp trong Termux**, không cần proot/chroot.

## Cài đặt (1 dòng)

Cần **Termux từ F-Droid** (bản Play Store bị lỗi thời, không dùng được) và máy Android 64-bit:

```bash
curl -fsSL https://raw.githubusercontent.com/remiua07-crypto/opencode-vi/dev/install-termux.sh | bash
```

Script tự làm hết: cài glibc + git + ripgrep qua `pkg`, tải binary arm64 (~60MB) từ Release, tạo lệnh `opencode`.

## Vì sao cần script riêng?

- Termux dùng libc **Bionic** của Android, còn opencode là binary **glibc** → không chạy trực tiếp được.
- Script cài gói `glibc` của Termux rồi khởi động opencode qua loader của nó (`ld-linux-aarch64.so.1`) — hiệu năng nguyên bản, không giả lập.
- Bun (runtime của opencode) chưa hỗ trợ chính thức Android nên đây là cách nhẹ nhất mà vẫn dùng đúng binary chuẩn từ GitHub Releases.

## Dùng

```bash
cd ~/du-an-cua-ban
opencode
```

Cấu hình provider AI bằng biến môi trường (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, ...) như bản gốc — xem tài liệu opencode.

## Gỡ cài đặt

```bash
rm -rf ~/.opencode-vi $PREFIX/bin/opencode
```

## So với các cách khác

| Cách | Dung lượng | Ghi chú |
|---|---|---|
| **install-termux.sh (này)** | ~150MB | Chạy thẳng, nhanh, dùng Release chính thức của opencode-vi |
| proot-distro Ubuntu | ~3GB | Nặng, chậm hơn |
| Cross-compile Bun cho Android | ~150MB | Phức tạp, tụt hậu phiên bản |
