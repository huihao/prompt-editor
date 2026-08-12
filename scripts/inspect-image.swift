#!/usr/bin/env swift
import Foundation
import ImageIO
import CoreGraphics

let cornerAlpha = CommandLine.arguments.count >= 3 && CommandLine.arguments[1] == "--corner-alpha"
guard CommandLine.arguments.count == 2 || cornerAlpha else {
    fputs("usage: inspect-image.swift [--corner-alpha] IMAGE...\n", stderr)
    exit(2)
}

if cornerAlpha {
    for path in CommandLine.arguments.dropFirst(2) {
        let url = URL(fileURLWithPath: path)
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
            fputs("failed to decode \(url.path)\n", stderr)
            exit(1)
        }
        let width = image.width
        let height = image.height
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        guard let context = CGContext(
            data: &pixels,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            fputs("failed to create pixel context\n", stderr)
            exit(1)
        }
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        let points = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]
        let alphas = points.map { x, y in pixels[(y * width + x) * 4 + 3] }
        print("\(path):corner-alpha=\(alphas.map(String.init).joined(separator: ","))")
    }
    exit(0)
}

let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else {
    fputs("failed to read \(url.path)\n", stderr)
    exit(1)
}

print("count=\(CGImageSourceGetCount(source))")
for index in 0..<CGImageSourceGetCount(source) {
    guard let properties = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any],
          let width = properties[kCGImagePropertyPixelWidth],
          let height = properties[kCGImagePropertyPixelHeight] else {
        fputs("missing dimensions at index \(index)\n", stderr)
        exit(1)
    }
    print("image[\(index)]=\(width)x\(height)")
}
