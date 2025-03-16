const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");

const getProductDetails = async (req, res) => {
  try {
    // Validate user session
    const userId = req.session.user;
    if (!userId) {
      console.error("User not logged in. Redirecting to login page.");
      return res.redirect("/login");
    }

    // Fetch user data
    const userData = await User.findOne({ _id: userId });
    if (!userData) {
      throw new Error("User not found in the database.");
    }

    let cartQuantity = 0;
    if (userData && userData.cart.length > 0) {
      cartQuantity = userData.cart.reduce(
        (total, item) => total + item.quantity,
        0
      );
    }

    // Fetch product data
    const productId = req.query.id;
    if (!productId) {
      throw new Error("Product ID not provided.");
    }

    const product = await Product.findById(productId).populate("category");
    if (!product) {
      throw new Error("Product not found in the database.");
    }

    if (product.isBlocked) {
      console.error(`Product ${productId} is blocked.`);

      req.session.flashMessage = "This product is not available at the moment.";

      return res.redirect("/shop");
    }

    // Extract category and offers
    const findCategory = product.category;
    const categoryOffer = findCategory?.categoryOffer || 0;
    const productOffer = product.productOffer || 0;
    const totalOffer = categoryOffer + productOffer;

    // Render the product details page
    res.render("product-details", {
      locals: userData,
      product: product,
      quantity: product.quantity || 0,
      totalOffer: totalOffer,
      category: findCategory || {},
      brand: product.brand || "Unknown",
    });
  } catch (error) {
    console.error("Error fetching product details:", error.message);
    res.redirect("/pageNotFound");
  }
};

module.exports = {
  getProductDetails,
};
