const User = require("../models/userSchema");

const userAuth = async (req, res, next) => {
  if (req.session.user) {
    User.findById(req.session.user)

      .then((data) => {
        if (data && !data.isBlocked) {
          next();
        } else {
          res.redirect("/");
        }
      })
      .catch((error) => {
        console.log("Error in user auth middleware");
        res.status(500).send("Internal server error");
      });
  } else {
    res.redirect("/login");
  }
};

const alreadyLoggedIn = (req, res, next) => {
  if (req.session.user) {
    return res.redirect("/");
  }
  next();
};

const adminAuth = (req, res, next) => {
  User.findOne({ isAdmin: true })
    .then((data) => {
      if (data && req.session.admin) {
        next();
      } else {
        res.redirect("/admin/login");
      }
    })
    .catch((error) => {
      console.log("error in user adminauth middleware");
      res.status(500).send("internal server error");
    });
};

const updateCounts = async (req, res, next) => {
  if (req.user) {
    try {
      const findUser = await User.findById(req.user._id);

      let cartQuantity =
        findUser?.cart.reduce((total, item) => total + item.quantity, 0) || 0;
      let wishlistQuantity = findUser?.wishlist.length || 0;

      res.locals.cartQuantity = cartQuantity;
      res.locals.wishlistQuantity = wishlistQuantity;
    } catch (error) {
      console.error("Error fetching cart/wishlist count:", error);
      res.locals.cartQuantity = 0;
      res.locals.wishlistQuantity = 0;
    }
  } else {
    res.locals.cartQuantity = 0;
    res.locals.wishlistQuantity = 0;
  }

  next();
};

module.exports = {
  userAuth,
  adminAuth,
  alreadyLoggedIn,
  updateCounts,
};
