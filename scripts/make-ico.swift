#!/usr/bin/env swift
import Foundation
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count >= 3 else {
    fputs("usage: make-ico.swift OUTPUT.ico INPUT.png...\n", stderr)
    exit(2)
}

let outputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let inputs = CommandLine.arguments.dropFirst(2).map { URL(fileURLWithPath: $0) }
guard let destination = CGImageDestinationCreateWithURL(
    outputURL as CFURL,
    UTType.ico.identifier as CFString,
    inputs.count,
    nil
) else {
    fputs("failed to create ICO destination\n", stderr)
    exit(1)
}

for input in inputs {
    guard let source = CGImageSourceCreateWithURL(input as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        fputs("failed to decode \(input.path)\n", stderr)
        exit(1)
    }
    CGImageDestinationAddImage(destination, image, nil)
}

guard CGImageDestinationFinalize(destination) else {
    fputs("failed to finalize ICO\n", stderr)
    exit(1)
}
