const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv").config();
const bcrypt = require("bcrypt");
const Product = require("../../models/productSchema");
const Brand = require("../../models/brandSchema");
const Category = require("../../models/categorySchema");
const Coupon = require("../../models/couponSchema");
const Order = require("../../models/orderSchema")
const mongoose = require("mongoose");
const Banner = require('../../models/bannerSchema')

const loadHomePage = async (req, res) => {
  try {
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

    console.log(productData, "qwertyuigf");

    productData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
    productData = productData.slice(0, 4);

    res.render("home", {
      locals: locals,
      products: productData,
      banner:findBanner || []
    });
  } catch (error) {
    console.log("Home page not found",error);
    res.status(500).send("server error");
  }
};

const pageNotFound = async (req, res) => {
  try {
    res.render("404");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

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

const signup = async (req, res) => {
  try {
    const { fullname, email, password, phone } = req.body;

    //console.log(req.body)
    if (!fullname || !email || !password || !phone) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    // Check if user already exists
    const existingUserByEmail = await User.findOne({ email });
    const existingUserByPhone = await User.findOne({ phone });

    //console.log(existingUserByEmail, existingUserByPhone)

    if (existingUserByEmail || existingUserByPhone) {
      res.render("signup", {
        message: "User Already exist try with other details",
      });
    }

    // Generate OTP
    const otp = generateOtp();
    console.log("Generated OTP:", otp);

    // Send OTP to the user's email
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.json({
        success: false,
        message: "Failed to send OTP, please try again",
      });
    }

    // Store OTP and user data in the session
    req.session.userOtp = otp;
    req.session.userData = { fullname, email, password, phone };
    //req.session.otpExpiration = expirationTime

    // Log session data to debug
    console.log("Session data after OTP generation:", req.session);

    // Redirect to the OTP verification page
    return res.render("verify-otp");
  } catch (error) {
    console.error("SignUpPage Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.error("Error hashing password:", error);
    throw new Error("Password hashing failed");
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log(otp);

    if (otp == req.session.userOtp) {
      const { fullname, email, phone, password } = req.session.userData;

      // Hash the password
      const passwordHash = await securePassword(password);
      const saveUserData = new User({
        name: fullname,
        email: email,
        phone: phone,
        password: passwordHash,
      });
      console.log("userData", saveUserData);

      await saveUserData.save();

      req.session.user = saveUserData._id;
      //console.log( req.session.user )
      res.json({
        success: true,
        redirectUrl: "/                             ",
      });
    } else {
      res
        .status(400)
        .json({ success: false, message: " Invalid OTP, Please try again " });
    }
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email not founding session" });
    }

    const otp = generateOtp();
    req.session.userOtp = otp;

    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("Resend OTP", otp);
      res
        .status(200)
        .json({ success: true, message: "OTP Resend Successfully" });
    } else {
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to resend OTP, Please try again",
        });
    }
  } catch (error) {
    console.error("Error Occure", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const loadLogin = async (req, res) => {
  try {
    res.render("login");
  } catch (error) {
    res.status(404).redirect("/pageNotFound");
  }
};

const loginPage = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("password:", password);
    const findUser = await User.findOne({ isAdmin: 0, email: email });
    console.log(findUser, "findUser");
    if (!findUser) {
      return res.render("login", { message: "User not Found" });
    }

    if (findUser.isBlocked) {
      return res.render("userBlocked");
    }

    console.log(findUser.password, "findUser.password");
    // console.log(password, "password")

    const passwordMatch = await bcrypt.compare(password, findUser.password);
    console.log(passwordMatch, "password");
    if (!passwordMatch) {
      return res.render("login", { message: "Incorrect Password" });
    }

    req.session.user = findUser._id;
    res.redirect("transition");
  } catch (error) {
    console.log("login error ", error);
    res.render("login", { message: "login failed, please try again later" });
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Session destructure error", err.message);
        return res.redirect("/pageNotFound");
      }
      return res.redirect("/login");
    });
  } catch (error) {
    console.log("Logout error", error);
    res.redirect("/pageNotFound");
  }
};

const loadShoppingPage = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });
        const categories = await Category.find({ isListed: true });
        const brand = await Brand.find({});
        const sortOption = req.query.sort || 'latest';

        let sortCriteria = {};
        switch(sortOption) {
            case 'lowToHigh':
                sortCriteria = { salePrice: 1 };
                break;
            case 'highToLow':
                sortCriteria = { salePrice: -1 };
                break;
            case 'aToZ':
                sortCriteria = { productName: 1 };
                break;
            case 'zToA':
                sortCriteria = { productName: -1 };
                break;
            default:
                sortCriteria = { createdAt: -1 };
        }

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;

        // Query products
        const query = {
            isBlocked: false,
            quantity: { $gt: 0 }
        };

        const products = await Product.find(query)
            .sort(sortCriteria)
            .skip(skip)
            .limit(limit)
            .lean(); // Use lean() for better performance

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        // Debug logs
        console.log('Products found:', products.length);
        console.log('Total pages:', totalPages);
        console.log('Current page:', page);

        return res.render("shop", {
            locals: userData,
            products: products,
            category: categories,
            brand: brand,
            totalPages: totalPages,
            currentPage: page,
            sortOption: sortOption,
            count: totalProducts
        });

    } catch (error) {
        console.error("Error loading shopping page:", error);
        return res.status(500).send("Error loading shopping page: " + error.message);
    }
};

const filterProduct = async (req, res) => {
  try {
    const user = req.session.user;
    const category = req.query.category;
    const brand = req.query.brand;
    const sortOption = req.query.sort || 'latest';
    
    const findCategory = category ? await Category.findOne({ _id: category }) : null;
    const findBrand = brand ? await Brand.findOne({ _id: brand }) : null;
    const brands = await Brand.find({}).lean();
    
    let sortCriteria = {};
    
    // Add sorting logic
    switch(sortOption) {
        case 'lowToHigh':
            sortCriteria = { salePrice: 1 };
            break;
        case 'highToLow':
            sortCriteria = { salePrice: -1 };
            break;
        case 'aToZ':
            sortCriteria = { productName: 1 };
            break;
        case 'zToA':
            sortCriteria = { productName: -1 };
            break;
        default: // 'latest'
            sortCriteria = { createdAt: -1 };
    }

    const query = {
        isBlocked: false,
        quantity: { $gt: 0 },
    };

    if (findCategory) {
        query.category = findCategory._id;
    }

    if (findBrand) {
        query.brand = findBrand.brandName;
    }

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
    
    const categories = await Category.find({ isListed: true });
    let userData = null;

    if (user) {
        userData = await User.findOne({ _id: user });
    }

    res.render("shop", {
        locals: userData,
        products: products,
        category: categories,
        brand: brands,
        totalPages,
        currentPage: page,
        sortOption: sortOption
    });

  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};

const filterByPrice = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    const brand = await Brand.find({}).lean();
    const categories = await Category.find({ isListed: true }).lean();
    const sortOption = req.query.sort || 'latest';

    let sortCriteria = {};
    
    // sorting logic
    switch(sortOption) {
        case 'lowToHigh':
            sortCriteria = { salePrice: 1 };
            break;
        case 'highToLow':
            sortCriteria = { salePrice: -1 };
            break;
        case 'aToZ':
            sortCriteria = { productName: 1 };
            break;
        case 'zToA':
            sortCriteria = { productName: -1 };
            break;
        default: // 'latest'
            sortCriteria = { createdAt: -1 };
    }

    const query = {
        salePrice: { $gt: req.query.gt, $lt: req.query.lt },
        isBlocked: false,
        quantity: { $gt: 0 },
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
        brand: brand,
        totalPages,
        currentPage: page,
        sortOption: sortOption
    });

  } catch (error) {
    console.error("error found in price by filter", error);
    res.redirect("pageNotFound");
  }
};

const transition = async (req, res) => {
  try {
    res.render("transition");
  } catch (error) {}
};



const applyCoupon = async (req, res) => {
  try {
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





  } catch (error) {
    console.error("Error applying coupon:", error);
    return res.json({ success: false, message: "Error applying coupon" });
  }
};

const searchProducts = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    const sortOption = req.query.sort || 'latest';
    
    let search = req.body.query;
    let brands = await Brand.find({}).lean();
    const categories = await Category.find({ isListed: true }).lean();
    const categoryIds = categories.map((category) => category._id.toString());

    let sortCriteria = {};
    
    // Add sorting logic
    switch(sortOption) {
        case 'lowToHigh':
            sortCriteria = { salePrice: 1 };
            break;
        case 'highToLow':
            sortCriteria = { salePrice: -1 };
            break;
        case 'aToZ':
            sortCriteria = { productName: 1 };
            break;
        case 'zToA':
            sortCriteria = { productName: -1 };
            break;
        default: // 'latest'
            sortCriteria = { createdAt: -1 };
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
        count: totalProducts
    });

  } catch (error) {
    console.error("Error found in searchProduct", error);
    res.redirect("pageNotFound");
  }
};



const getCount = async (req, res) => {
    try {
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
            wishlistQuantity
        });

    } catch (error) {
        console.error("Error in getCount:", error);
        return res.status(500).json({
            cartQuantity: 0,
            wishlistQuantity: 0,
            error: "Failed to get counts"
        });
    }
};








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
  filterProduct,
  transition,
  applyCoupon,
  filterByPrice,
  searchProducts,
  getCount
};
