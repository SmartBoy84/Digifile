echo "Building binaries for various platforms."
env CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -o fixup.exe
env CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -o fixup_mac
env CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o fixup_linux
CGO_ENABLED=1 GOARCH=arm64 GOOS=ios CC="/home/hamdan/iOS/DiyCompile/toolchain/linux/iphone/bin/clang  -isysroot /home/hamdan/iOS/DiyCompile/sdks/iPhoneOS14.5.sdk -target arm64-apple-ios14.5" go build -o fixup_ios
chmod +x fixup_*