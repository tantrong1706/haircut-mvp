const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type SquareImageOptions = {
  subject: string;
  maxSourceBytes?: number;
  maxOutputBytes?: number;
  size?: number;
  quality?: number;
};

export function validateSquareImageFile(
  file: File,
  { subject, maxSourceBytes = 10 * 1024 * 1024 }: SquareImageOptions,
) {
  if (!file) {
    throw new Error(`Vui lòng chọn ${subject}`);
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error(`${subject} chỉ hỗ trợ ảnh JPG, PNG hoặc WebP`);
  }
  if (file.size > maxSourceBytes) {
    throw new Error(`${subject} gốc quá lớn. Vui lòng chọn ảnh dưới 10MB.`);
  }

  return file;
}

export async function prepareSquareImage(file: File, options: SquareImageOptions): Promise<Blob> {
  const { subject, maxOutputBytes = 3 * 1024 * 1024, size = 512, quality = 0.86 } = options;
  validateSquareImageFile(file, options);
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(imageUrl, subject);
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    if (!sourceSize) {
      throw new Error(`Không đọc được kích thước ${subject}`);
    }

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error(`Thiết bị không thể xử lý ${subject}. Vui lòng thử ảnh khác.`);
    }

    const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
    const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);
    context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

    const output = await canvasToBlob(canvas, "image/webp", quality);
    if (!output || output.type !== "image/webp") {
      throw new Error(`Thiết bị không hỗ trợ xử lý ${subject} sang WebP.`);
    }
    if (output.size > maxOutputBytes) {
      throw new Error(`${subject} sau xử lý vẫn quá lớn. Vui lòng chọn ảnh nhẹ hơn 3MB.`);
    }

    return output;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function loadImage(url: string, subject: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Không đọc được ${subject}`));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}
