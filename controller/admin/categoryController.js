const Category = require("../../models/categorySchema");
const { findOne } = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const asyncHandler = require("express-async-handler");

const categoryInfo = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 4;
  const skip = (page - 1) * limit;

  const categoryData = await Category.find({})
    .sort({ createAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalCategories = await Category.countDocuments();
  const totalPages = Math.ceil(totalCategories / limit);

  res.render("category", {
    cat: categoryData,
    currentPage: page,
    totalPages: totalPages,
    totalCategories: totalCategories,
  });
});

const addCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  // console.log(req.body)

  const existingCategory = await Category.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
  });
  if (existingCategory) {
    return res.status(400).json({ error: "Category alredy exist" });
  }
  const newCategory = new Category({
    name,
    description,
  });
  await newCategory.save();
  return res.json({ message: "Category added successfully" });
});

const addCategoryOffer = asyncHandler(async (req, res) => {
  const { categoryId, percentage } = req.body;

  if (!categoryId || !percentage) {
    return res.status(400).json({
      status: false,
      message: "Category ID and percentage are required",
    });
  }

  const category = await Category.findById(categoryId);
  if (!category) {
    return res.status(404).json({
      status: false,
      message: "Category not found",
    });
  }

  const products = await Product.find({ category: categoryId });

  const productsWithHigherOffer = products.filter(
    (product) => product.productOffer > percentage
  );

  if (productsWithHigherOffer.length > 0) {
    return res.json({
      status: false,
      message: "Some products in this category have higher product offers",
    });
  }

  category.categoryOffer = parseInt(percentage);
  await category.save();

  for (const product of products) {
    if (!product.productOffer || product.productOffer < percentage) {
      const discount = Math.floor(product.regularPrice * (percentage / 100));
      product.salePrice = product.regularPrice - discount;
      await product.save();
    }
  }

  res.json({
    status: true,
    message: "Category offer added successfully",
  });
});

const removeCategoryOffer = asyncHandler(async (req, res) => {
  const { categoryId } = req.body;

  if (!categoryId) {
    return res.status(400).json({
      status: false,
      message: "Category ID is required",
    });
  }

  const category = await Category.findById(categoryId);
  if (!category) {
    return res.status(404).json({
      status: false,
      message: "Category not found",
    });
  }

  const percentage = category.categoryOffer || 0;
  if (percentage === 0) {
    return res.json({
      status: false,
      message: "No category offer to remove",
    });
  }

  const products = await Product.find({ category: categoryId });

  for (const product of products) {
    if (!product.productOffer || product.productOffer < percentage) {
      if (product.productOffer) {
        const productDiscount = Math.floor(
          product.regularPrice * (product.productOffer / 100)
        );
        product.salePrice = product.regularPrice - productDiscount;
      } else {
        product.salePrice = product.regularPrice;
      }
      await product.save();
    }
  }

  category.categoryOffer = 0;
  await category.save();

  return res.json({
    status: true,
    message: "Category offer removed successfully",
  });
});

const getListCategory = asyncHandler(async (req, res) => {
  let id = req.query.id;
  await Category.updateOne({ _id: id }, { $set: { isListed: false } });
  res.redirect("/admin/category");
});

const getUnlistCategory = asyncHandler(async (req, res) => {
  let id = req.query.id;
  await Category.updateOne({ _id: id }, { $set: { isListed: true } });
  res.redirect("/admin/category");
});

const getEditCatagory = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const category = await Category.findOne({ _id: id });

  res.render("edit-category", { category: category });
});

const editCategory = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { name, description } = req.body;

  if (!name || !description) {
    return res.status(400).json({ error: "Name and description are required" });
  }

  const existingCategory = await Category.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
    _id: { $ne: id },
  });

  if (existingCategory) {
    return res
      .status(400)
      .json({ error: "Category exists, Please choose another name" });
  }

  const updatecategory = await Category.findByIdAndUpdate(
    id,
    { name: name, description: description },
    { new: true }
  );

  if (updatecategory) {
    res.redirect("/admin/category");
  } else {
    return res.status(500).json({ error: "Failed to update category" });
  }
});

module.exports = {
  categoryInfo,
  addCategory,
  addCategoryOffer,
  removeCategoryOffer,
  getListCategory,
  getUnlistCategory,
  getEditCatagory,
  editCategory,
};
