const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv").config();
const bcrypt = require("bcrypt");
const Product = require("../../models/productSchema");
const Brand = require("../../models/brandSchema");
const Category = require("../../models/categorySchema");
const Coupon = require("../../models/couponSchema");
const Order = require("../../models/orderSchema");
const mongoose = require("mongoose");
const Banner = require("../../models/bannerSchema");
const asyncHandler = require("express-async-handler");
const crypto = require("crypto");

const loadHomePage = asyncHandler(async (req, res) => {
  const user = req.session.user;
  const today = new Date().toISOString();
  const findBanner = await Banner.find({
    startDate: { $lt: new Date(today) },
    endDate: { $gt: new Date(today) },
  });

  const locals = await User.findOne({ _id: user });
  const categories = await Category.find({ isListed: true });
  let productData = await Product.find({
    isBlocked: false,
    category: { $in: categories.map((category) => category._id) },
    quantity: { $gt: 0 },
  });

  productData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
  productData = productData.slice(0, 4);

  res.render("home", {
    locals: locals,
    products: productData,
    banner: findBanner || [],
  });
});

const pageNotFound = asyncHandler(async (req, res) => {
  res.render("404");
});

const loadSignUp = async (req, res) => {
  try {
    return res.render("signup");
  } catch (error) {
    console.log("Home page is not loading", error);
    res.status(500).send("server error");
  }
};

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      html: `<b>Your OTP: ${otp}</b>`,
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

const generateReferralCode = (email) => {
  const randomString = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `REF${randomString}${email.slice(0, 3).toUpperCase()}`;
};

const securePassword = asyncHandler(async (password) => {
  const passwordHash = await bcrypt.hash(password, 10);
  return passwordHash;
});

const signup = asyncHandler(async (req, res) => {
  const { fullname, email, password, phone, referralCode } = req.body;
  const referralCodeFromUrl = req.query.ref;

  if (!fullname || !email || !password || !phone) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are required" });
    console.log("all fields are required");
  }

  const existingUserByEmail = await User.findOne({ email });
  const existingUserByPhone = await User.findOne({ phone });

  if (existingUserByEmail || existingUserByPhone) {
    return res.render("signup", {
      message: "User already exists",
      referralCode: referralCode || referralCodeFromUrl,
    });
    console.log("error form already exists");
  }

  const otp = generateOtp();
  console.log("Generated OTP:", otp);

  const emailSent = await sendVerificationEmail(email, otp);
  if (!emailSent) {
    return res.json({ success: false, message: "Failed to send OTP" });
  }

  const referredBy = referralCode || referralCodeFromUrl || null;
  req.session.userOtp = otp;
  req.session.userData = { fullname, email, password, phone, referredBy };

  return res.render("verify-otp");
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { otp } = req.body;

  if (!req.session.userOtp || !req.session.userData) {
    console.error("Session data missing:", req.session);
    return res.status(400).json({
      success: false,
      message: "Session expired or invalid. Please sign up again.",
    });
  }

  if (otp == req.session.userOtp) {
    const { fullname, email, phone, password, referredBy } =
      req.session.userData;

    try {
      let referralCode = generateReferralCode(email);
      let codeExists = await User.findOne({ referralCode });
      let attempts = 0;
      while (codeExists && attempts < 5) {
        referralCode = generateReferralCode(email);
        codeExists = await User.findOne({ referralCode });
        attempts++;
      }
      if (codeExists) {
        throw new Error(
          "Failed to generate unique referral code after retries"
        );
      }

      const passwordHash = await securePassword(password);

      const saveUserData = new User({
        name: fullname,
        email: email,
        phone: phone,
        password: passwordHash,
        referralCode,
        referredBy: referredBy || null,
        redeemed: false,
        redeemedUsers: [],
      });

      await saveUserData.save();

      if (referredBy) {
        const referrer = await User.findOne({ referralCode: referredBy });
        if (referrer) {
          referrer.redeemedUsers.push(saveUserData._id);
          await referrer.save();
          console.log(
            `Updated referrer ${referrer.email} with new referral: ${saveUserData._id}`
          );
        }
      }

      req.session.user = saveUserData._id;

      req.session.userOtp = null;
      req.session.userData = null;

      res.json({
        success: true,
        redirectUrl: "/transition",
      });
    } catch (error) {
      console.error("Error in verifyOtp:", error.message, error.stack);
      res.status(500).json({
        success: false,
        message: `Server error: ${error.message}`,
      });
    }
  } else {
    res.status(400).json({
      success: false,
      message: "Invalid OTP, please try again",
    });
  }
});

const resendOtp = asyncHandler(async (req, res) => {
  const { email } = req.session.userData;
  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email not found in session" });
  }

  const otp = generateOtp();
  req.session.userOtp = otp;

  const emailSent = await sendVerificationEmail(email, otp);
  if (emailSent) {
    console.log("Resend OTP:", otp);
    res.status(200).json({ success: true, message: "OTP Resent Successfully" });
  } else {
    res.status(500).json({
      success: false,
      message: "Failed to resend OTP, please try again",
    });
  }
});
const loadLogin = asyncHandler(async (req, res) => {
  res.render("login");
});

const loginPage = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const findUser = await User.findOne({ isAdmin: 0, email: email });
  if (!findUser) {
    return res.render("login", { message: "User not Found" });
  }

  if (findUser.isBlocked) {
    return res.render("userBlocked");
  }

  const passwordMatch = await bcrypt.compare(password, findUser.password);
  if (!passwordMatch) {
    return res.render("login", { message: "Incorrect Password" });
  }

  req.session.user = findUser._id;
  res.redirect("transition");
});

const logout = asyncHandler(async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log("Session destructure error", err.message);
      return res.redirect("/pageNotFound");
    }
    return res.redirect("/login");
  });
});

const loadShoppingPage = asyncHandler(async (req, res) => {
  const user = req.session.user;
  const userData = user ? await User.findOne({ _id: user }) : null;
  const categories = await Category.find({ isListed: true }).lean();
  const brand = await Brand.find({}).lean();
  const sortOption = req.query.sort || "latest";

  if (!req.session.flashMessage) {
    req.session.flashMessage = null;
  }

  let sortCriteria = {};
  switch (sortOption) {
    case "lowToHigh":
      sortCriteria = { salePrice: 1 };
      break;
    case "highToLow":
      sortCriteria = { salePrice: -1 };
      break;
    case "aToZ":
      sortCriteria = { productName: 1 };
      break;
    case "zToA":
      sortCriteria = { productName: -1 };
      break;
    default:
      sortCriteria = { createdAt: -1 };
  }

  const page = parseInt(req.query.page) || 1;
  const limit = 8;
  const skip = (page - 1) * limit;

  const query = {
    isBlocked: false,
    quantity: { $gt: 0 },
  };

  const products = await Product.find(query)
    .sort(sortCriteria)
    .skip(skip)
    .limit(limit)
    .lean();

  const totalProducts = await Product.countDocuments(query);
  const totalPages = Math.ceil(totalProducts / limit);

  return res.render("shop", {
    locals: userData,
    products: products,
    category: categories,
    brand: brand,
    totalPages: totalPages,
    currentPage: page,
    sortOption: sortOption,
    count: totalProducts,
    query: "",
    activeFilters: {
      category: [],
      brand: [],
      price: [],
    },
    session: req.session,
  });
});
const filterProducts = asyncHandler(async (req, res) => {
  const user = req.session.user;
  const categories = await Category.find({ isListed: true }).lean();
  const brands = await Brand.find({}).lean();

  const query = req.query.query || "";
  const selectedCategories = req.query.category
    ? Array.isArray(req.query.category)
      ? req.query.category
      : [req.query.category]
    : [];
  const selectedBrands = req.query.brand
    ? Array.isArray(req.query.brand)
      ? req.query.brand
      : [req.query.brand]
    : [];
  const selectedPrices = req.query.price
    ? Array.isArray(req.query.price)
      ? req.query.price
      : [req.query.price]
    : [];
  const sortOption = req.query.sort || "latest";

  let searchFilter = {};
  if (query) {
    searchFilter = {
      $or: [
        { productName: { $regex: query, $options: "i" } },
        { brand: { $regex: query, $options: "i" } },
      ],
    };
  }

  if (!req.session.flashMessage) {
    req.session.flashMessage = null;
  }

  let queryFilters = {
    isBlocked: false,
    quantity: { $gt: 0 },
    ...searchFilter,
  };

  if (selectedCategories.length > 0) {
    queryFilters.category = { $in: selectedCategories };
  }

  if (selectedBrands.length > 0) {
    const brandNames = await Brand.find({
      _id: { $in: selectedBrands },
    }).distinct("brandName");
    queryFilters.brand = { $in: brandNames };
  }

  if (selectedPrices.length > 0) {
    let priceConditions = [];
    selectedPrices.forEach((range) => {
      const [min, max] = range.split("-").map(Number);
      priceConditions.push({ salePrice: { $gte: min, $lte: max } });
    });
    queryFilters.$or = priceConditions;
  }

  let sortCriteria = {};
  switch (sortOption) {
    case "lowToHigh":
      sortCriteria = { salePrice: 1 };
      break;
    case "highToLow":
      sortCriteria = { salePrice: -1 };
      break;
    case "aToZ":
      sortCriteria = { productName: 1 };
      break;
    case "zToA":
      sortCriteria = { productName: -1 };
      break;
    default:
      sortCriteria = { createdAt: -1 };
  }

  const page = parseInt(req.query.page) || 1;
  const limit = 6;
  const skip = (page - 1) * limit;

  const products = await Product.find(queryFilters)
    .sort(sortCriteria)
    .skip(skip)
    .limit(limit)
    .lean();

  const totalProducts = await Product.countDocuments(queryFilters);
  const totalPages = Math.ceil(totalProducts / limit);

  let userData = null;
  if (user) {
    userData = await User.findOne({ _id: user });
  }

  res.render("shop", {
    locals: userData,
    products,
    category: categories,
    brand: brands,
    totalPages,
    currentPage: page,
    sortOption,
    query,
    activeFilters: {
      category: selectedCategories,
      brand: selectedBrands,
      price: selectedPrices,
    },
    session: req.session,
  });
});

const transition = asyncHandler(async (req, res) => {
  res.render("transition");
});

const applyCoupon = asyncHandler(async (req, res) => {
  const userId = req.session.user;
  const selectedCoupon = await Coupon.findOne({ name: req.body.coupon });

  if (!selectedCoupon) {
    return res.json({ success: false, message: "Coupon not found" });
  }

  if (selectedCoupon.userId.includes(userId)) {
    return res.json({ success: false, message: "Coupon already used" });
  }

  await Coupon.updateOne(
    { name: req.body.coupon },
    { $addToSet: { userId: userId } }
  );

  const gt = parseInt(req.body.total) - parseInt(selectedCoupon.offerPrice);
  return res.json({
    success: true,
    gt: gt,
    offerPrice: parseInt(selectedCoupon.offerPrice),
  });
});

const searchProducts = asyncHandler(async (req, res) => {
  const user = req.session.user;
  const userData = await User.findOne({ _id: user });
  const sortOption = req.query.sort || "latest";

  let search = req.query.query || "";
  let brands = await Brand.find({}).lean();
  const categories = await Category.find({ isListed: true }).lean();
  const categoryIds = categories.map((category) => category._id.toString());

  let sortCriteria = {};

  switch (sortOption) {
    case "lowToHigh":
      sortCriteria = { salePrice: 1 };
      break;
    case "highToLow":
      sortCriteria = { salePrice: -1 };
      break;
    case "aToZ":
      sortCriteria = { productName: 1 };
      break;
    case "zToA":
      sortCriteria = { productName: -1 };
      break;
    default: // 'latest'
      sortCriteria = { createdAt: -1 };
  }

  if (!req.session.flashMessage) {
    req.session.flashMessage = null;
  }

  const query = {
    productName: { $regex: ".*" + search + ".*", $options: "i" },
    isBlocked: false,
    quantity: { $gt: 0 },
    category: { $in: categoryIds },
  };

  const page = parseInt(req.query.page) || 1;
  const limit = 6;
  const skip = (page - 1) * limit;

  const products = await Product.find(query)
    .sort(sortCriteria)
    .skip(skip)
    .limit(limit)
    .lean();

  const totalProducts = await Product.countDocuments(query);
  const totalPages = Math.ceil(totalProducts / limit);

  res.render("shop", {
    locals: userData,
    products: products,
    category: categories,
    brand: brands,
    totalPages,
    currentPage: page,
    sortOption: sortOption,
    query: search,
    count: totalProducts,
    session: req.session,
  });
});

const getCount = asyncHandler(async (req, res) => {
  if (!req.session.user) {
    return res.json({ cartQuantity: 0, wishlistQuantity: 0 });
  }

  const user = await User.findById(req.session.user);

  if (!user) {
    console.log("User not found");
    return res.json({ cartQuantity: 0, wishlistQuantity: 0 });
  }

  const cartQuantity = user.cart.reduce((total, item) => {
    return total + (item.quantity || 0);
  }, 0);

  const wishlistQuantity = user.wishlist ? user.wishlist.length : 0;

  return res.json({
    cartQuantity,
    wishlistQuantity,
  });
});

const getContactPage = asyncHandler(async (req, res) => {
  res.render("contact");
});

module.exports = {
  loadHomePage,
  pageNotFound,
  loadSignUp,
  signup,
  verifyOtp,
  resendOtp,
  loadLogin,
  loginPage,
  logout,
  loadShoppingPage,
  filterProducts,
  transition,
  applyCoupon,
  searchProducts,
  getCount,
  getContactPage,
};
