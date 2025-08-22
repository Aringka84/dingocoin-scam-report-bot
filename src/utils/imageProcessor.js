const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

/**
 * Download and process image attachment
 */
async function processImage(attachment, reportId) {
    try {
        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(__dirname, '../../uploads');
        await fs.mkdir(uploadsDir, { recursive: true });

        // Download the image
        const response = await axios.get(attachment.url, {
            responseType: 'arraybuffer'
        });
        
        const imageBuffer = Buffer.from(response.data);
        
        // Generate unique filename
        const fileId = uuidv4();
        const outputPath = path.join(uploadsDir, `${reportId}_${fileId}.webp`);
        
        // Process image with Sharp
        const processedImage = await sharp(imageBuffer)
            .webp({ 
                quality: 85,
                effort: 6 
            })
            .resize(1920, 1080, { 
                fit: 'inside',
                withoutEnlargement: true 
            })
            .toFile(outputPath);

        return {
            success: true,
            path: outputPath,
            filename: `${reportId}_${fileId}.webp`,
            originalName: attachment.name,
            size: processedImage.size,
            width: processedImage.width,
            height: processedImage.height
        };
    } catch (error) {
        console.error('Image processing failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Process multiple images
 */
async function processImages(attachments, reportId) {
    const results = [];
    
    for (const attachment of attachments) {
        const result = await processImage(attachment, reportId);
        results.push({
            originalName: attachment.name,
            ...result
        });
    }
    
    return results;
}

/**
 * Delete processed images
 */
async function deleteImages(imagePaths) {
    const results = [];
    
    for (const imagePath of imagePaths) {
        try {
            await fs.unlink(imagePath);
            results.push({ path: imagePath, deleted: true });
        } catch (error) {
            console.error(`Failed to delete image ${imagePath}:`, error);
            results.push({ path: imagePath, deleted: false, error: error.message });
        }
    }
    
    return results;
}

/**
 * Get image info without processing
 */
async function getImageInfo(attachment) {
    try {
        const response = await axios.get(attachment.url, {
            responseType: 'arraybuffer'
        });
        
        const imageBuffer = Buffer.from(response.data);
        const metadata = await sharp(imageBuffer).metadata();
        
        return {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            size: imageBuffer.length
        };
    } catch (error) {
        console.error('Failed to get image info:', error);
        return null;
    }
}

/**
 * Validate image
 */
async function validateImage(attachment) {
    try {
        const info = await getImageInfo(attachment);
        if (!info) {
            return { valid: false, reason: 'Invalid image file' };
        }
        
        // Check dimensions
        if (info.width < 50 || info.height < 50) {
            return { valid: false, reason: 'Image too small (minimum 50x50 pixels)' };
        }
        
        if (info.width > 4000 || info.height > 4000) {
            return { valid: false, reason: 'Image too large (maximum 4000x4000 pixels)' };
        }
        
        return { valid: true, info };
    } catch (error) {
        return { valid: false, reason: 'Failed to validate image' };
    }
}

module.exports = {
    processImage,
    processImages,
    deleteImages,
    getImageInfo,
    validateImage
};
