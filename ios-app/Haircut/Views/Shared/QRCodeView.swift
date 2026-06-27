import CoreImage.CIFilterBuiltins
import SwiftUI
import UIKit

struct QRCodeView: View {
    let text: String

    var body: some View {
        if let image = makeQRCode(from: text) {
            Image(uiImage: image)
                .interpolation(.none)
                .resizable()
                .scaledToFit()
        } else {
            RoundedRectangle(cornerRadius: 8)
                .fill(.gray.opacity(0.2))
                .overlay(Text("Không tạo được QR"))
        }
    }

    private func makeQRCode(from string: String) -> UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)

        guard
            let outputImage = filter.outputImage,
            let cgImage = context.createCGImage(outputImage, from: outputImage.extent)
        else {
            return nil
        }

        return UIImage(cgImage: cgImage)
    }
}
