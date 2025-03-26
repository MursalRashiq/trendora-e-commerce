const product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const fs = require("fs");
const path = require("path");
const User = require("../../models/userSchema");
const sharp = require("sharp");
const Product = require("../../models/productSchema");
const mongoose = require("mongoose");
const {
  uploadToCloudinary,
  cloudinary,
} = require("../../config/cloudinaryConfig");
const asyncHandler = require("express-async-handler");

const getProductAddPage = asyncHandler(async (req, res) => {
  const category = await Category.find({ isListed: true });

  const brand = await Brand.find({ isBlocked: false });

  res.render("product-add", {
    cat: category,
    brand: brand,
  });
});

const addProducts = asyncHandler(async (req, res) => {
  const products = req.body;
  const productExists = await Product.findOne({
    productName: products.productName,
  });

  if (productExists) {
    return res
      .status(400)
      .send("Product already exists, please try with another name.");
  }

  const images = [];

  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      try {
        const result = await uploadToCloudinary(file);
        images.push({
          url: result.secure_url,
          public_id: result.public_id,
        });
      } catch (error) {
        console.error("Error uploading to Cloudinary:", error);
        return res.status(500).send("Error uploading images");
      }
    }
  }

  if (images.length === 0) {
    return res.status(400).send("At least one image is required.");
  }

  const categoryId = await Category.findOne({ name: products.category });
  if (!categoryId) {
    return res.status(400).send("Invalid category name.");
  }

  const newProduct = new Product({
    productName: products.productName,
    description: products.description,
    brand: products.brand,
    category: categoryId._id,
    regularPrice: products.regularPrice,
    salePrice: products.salePrice,
    createdOn: new Date(),
    color: products.color,
    quantity: products.quantity,
    productImage: images.map((img) => img.url),
    cloudinaryIds: images.map((img) => img.public_id),
    status: "Available",
  });

  await newProduct.save();
  req.flash("success", "Product added successfully!");
  return res.redirect("/admin/products?message=Product added successfully!");
});

const getAllProduct = asyncHandler(async (req, res) => {
  const search = req.query.search || "";
  const page = parseInt(req.query.page) || 1;
  const limit = 4;

  const productData = await Product.find({
    $or: [
      { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
      { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit)
    .populate("category")
    .exec();

  const count = await Product.find({
    $or: [
      { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
      { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
    ],
  }).countDocuments();

  const category = await Category.find({ isListed: true });
  const brand = await Brand.find({ isBlocked: false });

  if (category && brand) {
    res.render("products", {
      data: productData,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      cat: category,
      brand: brand,
    });
  } else {
    res.render("page-404");
  }
});

const addProductOffer = asyncHandler(async (req, res) => {
  const { productId, percentage } = req.body;

  if (!productId || !percentage) {
    return res.status(400).json({
      status: false,
      message: "Product ID and percentage are required",
    });
  }

  const findProduct = await Product.findOne({ _id: productId });
  if (!findProduct) {
    return res
      .status(404)
      .json({ status: false, message: "Product not found" });
  }

  const findCategory = await Category.findOne({ _id: findProduct.category });
  if (!findCategory) {
    return res
      .status(404)
      .json({ status: false, message: "Category not found" });
  }

  if (findCategory.categoryOffer > percentage) {
    return res.json({
      status: false,
      message: "This product category already has a higher category offer",
    });
  }

  const discount = Math.floor(findProduct.regularPrice * (percentage / 100));
  findProduct.salePrice = findProduct.regularPrice - discount;
  findProduct.productOffer = parseInt(percentage);

  await findProduct.save();

  findCategory.categoryOffer = percentage;
  await findCategory.save();

  res.json({ status: true, message: "Product offer added successfully" });
});

const removeProductOffer = asyncHandler(async (req, res) => {
  const { productId } = req.body;

  if (!productId) {
    return res
      .status(400)
      .json({ status: false, message: "Product ID is required" });
  }

  const findProduct = await Product.findOne({ _id: productId });
  if (!findProduct) {
    return res
      .status(404)
      .json({ status: false, message: "Product not found" });
  }

  const percentage = findProduct.productOffer || 0;
  if (percentage === 0) {
    return res.json({ status: false, message: "No offer to remove" });
  }

  findProduct.salePrice = Math.floor(
    findProduct.salePrice + (findProduct.regularPrice * percentage) / 100
  );

  findProduct.productOffer = 0;

  await findProduct.save();

  return res.json({
    status: true,
    message: "Product offer removed successfully",
  });
});

const blockProduct = asyncHandler(async (req, res) => {
  const id = req.query.id;
  await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
  res.redirect("/admin/products");
});

const unBlockProduct = asyncHandler(async (req, res) => {
  const id = req.query.id;

  await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
  res.redirect("/admin/products");
});

const getEditProduct = asyncHandler(async (req, res) => {
  const productId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    console.log("Invalid Product ID format");
    return res.redirect("/admin/products");
  }

  const product = await Product.findById(productId).populate("category");

  if (!product) {
    return res.redirect("/admin/products");
  }

  const [categories, brands] = await Promise.all([
    Category.find({}),
    Brand.find({}),
  ]);

  res.render("edit-product", {
    product: product,
    cat: categories,
    brand: brands,
    currentImages: product.productImage,
    message: "",
  });
});

const editProduct = asyncHandler(async (req, res) => {
  let id = req.params.id?.trim();

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid or missing Product ID" });
  }

  const product = await Product.findById(id);
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  const data = req.body;

  const existingProduct = await Product.findOne({
    productName: data.productName,
    _id: { $ne: id },
  });

  if (existingProduct) {
    return res.status(400).json({
      error: "Product with this name already exists",
    });
  }

  const images = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      try {
        const result = await uploadToCloudinary(file);
        images.push({
          url: result.secure_url,
          public_id: result.public_id,
        });
      } catch (error) {
        console.error("Error uploading to Cloudinary:", error);
        return res.status(500).send("Error uploading images");
      }
    }
  }

  let categoryId;
  if (mongoose.Types.ObjectId.isValid(data.category)) {
    categoryId = data.category;
  } else {
    const category = await Category.findOne({ name: data.category });
    if (!category) {
      return res.status(400).json({ error: "Invalid category" });
    }
    categoryId = category._id;
  }

  const updateFields = {
    productName: data.productName,
    description: data.description,
    brand: data.brand,
    category: categoryId,
    regularPrice: parseFloat(data.regularPrice),
    salePrice: parseFloat(data.salePrice),
    quantity: parseInt(data.quantity),
    size: data.size,
    color: data.color,
  };

  if (images.length > 0) {
    updateFields.$push = {
      productImage: { $each: images.map((img) => img.url) },
      cloudinaryIds: { $each: images.map((img) => img.public_id) },
    };
  }

  const updatedProduct = await Product.findByIdAndUpdate(id, updateFields, {
    new: true,
    runValidators: true,
  });

  res.redirect("/admin/products?message=Product edited successfully");
});

const deleteSingleImage = asyncHandler(async (req, res) => {
  const { imageUrl, productId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid product ID",
    });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  const imageIndex = product.productImage.indexOf(imageUrl);
  if (imageIndex === -1) {
    return res.status(404).json({
      success: false,
      message: "Image not found in product",
    });
  }

  const publicId = product.cloudinaryIds[imageIndex];
  console.log("Attempting to delete Cloudinary image:", publicId);

  if (publicId) {
    try {
      await cloudinary.uploader.destroy(publicId);
      console.log("Successfully deleted from Cloudinary");
    } catch (cloudinaryError) {
      console.error("Cloudinary deletion error:", cloudinaryError);
    }
  }

  product.productImage.splice(imageIndex, 1);
  product.cloudinaryIds.splice(imageIndex, 1);
  await product.save();
  console.log("Successfully updated product document");

  return res.json({
    success: true,
    message: "Image deleted successfully",
  });
});

module.exports = {
  getProductAddPage,
  addProducts,
  getAllProduct,
  addProductOffer,
  removeProductOffer,
  blockProduct,
  unBlockProduct,
  getEditProduct,
  editProduct,
  deleteSingleImage,
};
