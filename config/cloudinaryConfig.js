const cloudinary = require('cloudinary').v2;
const fs = require('fs');
require('dotenv').config();

const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim().replace(/,/g, '');
const apiKey = process.env.CLOUDINARY_API_KEY?.trim().replace(/,/g, '');
const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();


// console.log(' Cloudinary :', {
//     cloud_name: cloudName,
//     api_key: apiKey,
//     // Don't log the secret
// });

// Configure cloudinary 
cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret
});

// Test the configuration
const testCloudinaryConnection = async () => {
    try {
        const result = await cloudinary.api.ping();
        // console.log('Cloudinary connection :', result);
        return true;
    } catch (error) {
        console.error('Cloudinary connection failed:', error);
        return false;
    }
};

const uploadToCloudinary = async (file) => {
    try {
        // Test connection 
        const isConnected = await testCloudinaryConnection();
        if (!isConnected) {
            throw new Error('Could not connect to Cloudinary');
        }

        if (!cloudName || !apiKey || !apiSecret) {
            throw new Error('Missing Cloudinary credentials');
        }

        const result = await cloudinary.uploader.upload(file.path, {
            folder: 'products',
            use_filename: true,
            unique_filename: true,
        });
        
        // Clean up the temporary file after upload
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }
        
        return result;
    } catch (error) {
        console.error('Cloudinary upload error details:', error);
        // Clean up the temporary file even if upload fails
        if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }
        throw error;
    }
};

// Test the connection when the module loads
testCloudinaryConnection();

module.exports = {
    cloudinary,
    uploadToCloudinary
};

    