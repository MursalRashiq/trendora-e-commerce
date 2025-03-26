const cloudinary = require("cloudinary").v2;
const fs = require("fs");
require("dotenv").config();

const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim().replace(/,/g, "");
const apiKey = process.env.CLOUDINARY_API_KEY?.trim().replace(/,/g, "");
const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

// Configure cloudinary
cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

const testCloudinaryConnection = async () => {
  try {
    const result = await cloudinary.api.ping();
    return true;
  } catch (error) {
    console.error("Cloudinary connection failed:", error);
    return false;
  }
};

const uploadToCloudinary = async (file) => {
  try {
    const isConnected = await testCloudinaryConnection();
    if (!isConnected) {
      throw new Error("Could not connect to Cloudinary");
    }

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error("Missing Cloudinary credentials");
    }

    const result = await cloudinary.uploader.upload(file.path, {
      folder: "products",
      use_filename: true,
      unique_filename: true,
    });

    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    return result;
  } catch (error) {
    console.error("Cloudinary upload error details:", error);
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    throw error;
  }
};

testCloudinaryConnection();

module.exports = {
  cloudinary,
  uploadToCloudinary,
};
