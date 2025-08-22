const axios = require('axios');
const geoip = require('geoip-lite');
const config = require('../config/config');

/**
 * Get user's IP address from Discord (limited functionality)
 * Note: Discord doesn't provide IP addresses directly
 */
function getUserIP(interaction) {
    // In a real implementation, you might need to use a different approach
    // This is a placeholder as Discord doesn't expose user IPs
    return '127.0.0.1'; // Placeholder
}

/**
 * Check if IP is from a VPN/Proxy using multiple methods
 */
async function checkVPN(ip) {
    if (!config.features.vpnDetection) {
        return { isVPN: false, confidence: 0 };
    }

    try {
        // Method 1: Check if IP is from known VPN ranges
        const geo = geoip.lookup(ip);
        if (!geo) return { isVPN: false, confidence: 0 };

        // Method 2: Use a VPN detection API (you'll need to implement this)
        // Example with a hypothetical API
        /*
        const response = await axios.get(`https://api.vpndetection.com/check/${ip}`, {
            headers: { 'Authorization': `Bearer ${config.security.vpnApiKey}` }
        });
        
        return {
            isVPN: response.data.isVPN,
            confidence: response.data.confidence,
            provider: response.data.provider
        };
        */

        // Placeholder implementation
        return { isVPN: false, confidence: 0 };
    } catch (error) {
        console.error('VPN check failed:', error.message);
        return { isVPN: false, confidence: 0 };
    }
}

/**
 * Scan file for malware using VirusTotal API
 */
async function scanFile(fileBuffer, filename) {
    if (!config.security.virusTotalApiKey) {
        console.warn('VirusTotal API key not configured, skipping malware scan');
        return { isSafe: true, scanId: null };
    }

    try {
        // Upload file to VirusTotal
        const formData = new FormData();
        formData.append('file', fileBuffer, filename);

        const uploadResponse = await axios.post('https://www.virustotal.com/vtapi/v2/file/scan', formData, {
            headers: {
                'apikey': config.security.virusTotalApiKey,
                ...formData.getHeaders()
            }
        });

        const scanId = uploadResponse.data.scan_id;

        // Wait a bit then check results
        await new Promise(resolve => setTimeout(resolve, 5000));

        const reportResponse = await axios.get('https://www.virustotal.com/vtapi/v2/file/report', {
            params: {
                apikey: config.security.virusTotalApiKey,
                resource: scanId
            }
        });

        const positives = reportResponse.data.positives || 0;
        const total = reportResponse.data.total || 0;

        return {
            isSafe: positives === 0,
            scanId,
            positives,
            total,
            permalink: reportResponse.data.permalink
        };
    } catch (error) {
        console.error('Malware scan failed:', error.message);
        return { isSafe: true, scanId: null }; // Default to safe if scan fails
    }
}

/**
 * Validate file type and size
 */
function validateFile(attachment) {
    const maxSize = config.security.maxFileSize;
    const allowedTypes = config.security.allowedFileTypes;
    
    // Check file size
    if (attachment.size > maxSize) {
        return {
            valid: false,
            reason: `File size exceeds maximum allowed size of ${Math.round(maxSize / 1024 / 1024)}MB`
        };
    }
    
    // Check file type
    const extension = attachment.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(extension)) {
        return {
            valid: false,
            reason: `File type .${extension} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
        };
    }
    
    return { valid: true };
}

/**
 * Extract links from text
 */
function extractLinks(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
}

/**
 * Sanitize text input
 */
function sanitizeInput(input) {
    if (!input) return '';
    
    // Remove potentially dangerous characters
    return input
        .replace(/[<>\"']/g, '')
        .trim()
        .substring(0, 2000); // Limit length
}

module.exports = {
    getUserIP,
    checkVPN,
    scanFile,
    validateFile,
    extractLinks,
    sanitizeInput
};
