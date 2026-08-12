#!/usr/bin/env swift
import Foundation
import ImageIO

guard CommandLine.arguments.count == 2 else {
    fputs("usage: inspect-image.swift IMAGE\n", stderr)
    exit(2)
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
