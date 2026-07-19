import { FormatEnum } from "sharp";

const FORMAT_INFO: Record<'jpeg' | 'png' | 'webp' , { mimeType: string; extension: string; sharpFormat: keyof FormatEnum; }> = {
  jpeg: {
    mimeType: 'image/jpeg',
    extension: 'jpg',
    sharpFormat: 'jpeg',
  },
  png: {
    mimeType: 'image/png',
    extension: 'png',
    sharpFormat: 'png',
  },
  webp: {
    mimeType: 'image/webp',
    extension: 'webp',
    sharpFormat: 'webp',
  },
};

export function getFormatInfoBySharpFormat(format: keyof FormatEnum) {
  switch (format) {
    case 'jpeg':
      return FORMAT_INFO.jpeg;
    case 'png':
      return FORMAT_INFO.png;
    case 'webp':
      return FORMAT_INFO.webp;
    default:
      throw new Error('unsupported file type');
  }
}

export function getFormatInfoByExtension(extension: string) {
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return FORMAT_INFO.jpeg;
    case 'png':
      return FORMAT_INFO.png;
    default:
      throw new Error('unsupported extension');
  }
}

export function getFormatInfoByMimeType(mimeType: string) {
  switch (mimeType) {
    case 'image/jpg':
    case 'image/jpeg':
      return FORMAT_INFO.jpeg;
    case 'image/png':
      return FORMAT_INFO.png;
    case 'image/webp':
      return FORMAT_INFO.webp;
    default:
      throw new Error('unsupported mimeType');
  }
}
