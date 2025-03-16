const Rating = require("../../models/ratingSchema");
const Product = require("../../models/productSchema");

const getRatingPage = async (req, res) => {
  try {
    const productId = req.query.productId;

    if (!req.session.user) {
      return res.redirect("/login");
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).redirect("/error");
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).redirect("/404");
    }

    // Verify user has purchased product
    const hasOrdered = await Order.findOne({
      userId: req.session.user._id,
      "products.productId": productId,
      status: "delivered",
    });

    if (!hasOrdered) {
      return res.status(403).redirect("/error");
    }

    const existingRating = await Rating.findOne({
      userId: req.session.user._id,
      productId,
    });

    res.render("rating", { product, existingRating });
  } catch (error) {
    console.error(error);
    res.status(500).redirect("/error");
  }
};

module.exports = {
  getRatingPage,
};
