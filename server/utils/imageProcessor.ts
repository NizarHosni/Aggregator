import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

// Compress and resize image
export async function processImage(
  inputPath: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
  } = {}
): Promise<string> {
  const { width = 1200, height = 800, quality = 80 } = options;

  const ext = path.extname(inputPath);
  const outputPath = inputPath.replace(ext, `-processed${ext}`);

  try {
    await sharp(inputPath)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality })
      .toFile(outputPath);

    // Delete original file
    await fs.unlink(inputPath);

    return outputPath;
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}

// Create thumbnail
export async function createThumbnail(
  inputPath: string,
  size: number = 300
): Promise<string> {
  const ext = path.extname(inputPath);
  const thumbnailPath = inputPath.replace(ext, `-thumb${ext}`);

  try {
    await sharp(inputPath)
      .resize(size, size, {
        fit: 'cover',
      })
      .jpeg({ quality: 70 })
      .toFile(thumbnailPath);

    return thumbnailPath;
  } catch (error) {
    console.error('Error creating thumbnail:', error);
    throw error;
  }
}

// Process multiple images
export async function processImages(
  files: Express.Multer.File[],
  options?: { width?: number; height?: number; quality?: number }
): Promise<string[]> {
  const processedPaths: string[] = [];

  for (const file of files) {
    try {
      const processedPath = await processImage(file.path, options);
      // Return relative path from uploads directory
      const relativePath = processedPath.replace(/.*uploads/, '/uploads');
      processedPaths.push(relativePath);
    } catch (error) {
      console.error(`Error processing image ${file.path}:`, error);
    }
  }

  return processedPaths;
}

