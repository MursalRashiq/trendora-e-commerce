const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");

const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);
    const products = await Product.find({
      _id: { $in: user.wishlist },
    }).populate("category");

    let cartQuantity = 0;
    if (user && user.cart.length > 0) {
      cartQuantity = user.cart.reduce(
        (total, item) => total + item.quantity,
        0
      );
    }

    let wishlistQuantity = 0;
    if (user && user.wishlist.length > 0) {
      wishlistQuantity = user.wishlist.length;
    }

    res.render("wishlist", {
      locals: user,
      wishlist: products,
      cartQuantity,
      wishlistQuantity,
    });
  } catch (error) {
    console.error("error in load wishlist", error);
    res.redirect("pageNotFound");
  }
};

const addToWishlist = async (req, res) => {
  try {
    const productId = req.body.productId;
    const userId = req.session.user;

    const user = await User.findById(userId);

    if (user.wishlist.includes(productId)) {
      return res.status(200).json({
        status: false,
        message: "Product already in wishlist",
      });
    }

    const inCart = user.cart.some(
      (item) => item.productId.toString() === productId
    );
    if (inCart) {
      return res.status(200).json({
        status: false,
        message: "Product already in cart",
      });
    }

    user.wishlist.push(productId);
    await user.save();

    res.status(200).json({
      status: true,
      message: "Product added to wishlist",
    });
  } catch (error) {
    console.error("Error found in addToWishlist:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
    });
  }
};

const removeProduct = async (req, res) => {
  try {
    const productId = req.query.productId;
    const userId = req.session.user;
    const user = await User.findById(userId);
    const index = user.wishlist.indexOf(productId);
    user.wishlist.splice(index, 1);
    await user.save();

    return res.redirect("/wishlist");
  } catch (error) {
    console.error("error in remove wishlist", error);
    return res.status(500).json({ status: false, message: "server error" });
  }
};

const addToCartFromWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.session.user;

    const user = await User.findById(userId);
    if (!user) {
      return res.json({
        status: false,
        message: "User not found",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.json({
        status: false,
        message: "Product not found",
      });
    }

    if (product.stock < 1) {
      return res.json({
        status: false,
        message: "Out of stock",
      });
    }

    const existingCartItem = user.cart.find(
      (item) => item.productId.toString() === productId
    );

    if (existingCartItem) {
      return res.json({
        status: false,
        message: "Product already in cart",
      });
    }

    user.cart.push({ productId, quantity: 1 });
    user.wishlist = user.wishlist.filter((id) => id.toString() !== productId);

    await user.save();

    res.json({
      status: true,
      cartLength: user.cart.length,
      message: "Product added to cart successfully",
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  loadWishlist,
  addToWishlist,
  removeProduct,
  addToCartFromWishlist,
};
