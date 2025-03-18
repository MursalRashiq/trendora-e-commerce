const express = require("express");
const router = express.Router();
const userController = require("../controller/user/userController");
const passport = require("../config/passport");
const { userAuth, alreadyLoggedIn } = require("../middleware/auth");
const productController = require("../controller/user/productController");
const profileController = require("../controller/user/profileController");
const cartController = require("../controller/user/cratController");
const orderController = require("../controller/user/orderController");
const wishlistController = require("../controller/user/wishlistController");
const walletController = require("../controller/user/walletController");
const raitingController = require("../controller/user/ratingController");

router.get("/", userController.loadHomePage);
router.get("/pageNotFound", userController.pageNotFound);
router.get("/signup", alreadyLoggedIn, userController.loadSignUp);
router.post("/signup", alreadyLoggedIn, userController.signup);
router.post("/verify-otp", userController.verifyOtp);
//router.get("/verify-otp",userController.verifyOtp)
router.post("/resend-otp", userController.resendOtp);
router.get(
  "/auth/google",
  alreadyLoggedIn,
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/auth/google/callback",
  alreadyLoggedIn,
  passport.authenticate("google", { failureRedirect: "/signup" }),
  (req, res) => {
    if (req.user) {
      const userId = req.user._id || req.user.id;
      req.session.user = userId;
      //console.log("Google Auth User ID:", userId);
    }
    res.redirect("/");
  }
);

router.get("/login", alreadyLoggedIn, userController.loadLogin);
router.post("/login", alreadyLoggedIn, userController.loginPage);
router.get("/logout", userController.logout);

//shop management
router.get("/shop", userController.loadShoppingPage);
router.get("/filter", userController.filterProducts);
// router.get("/filterPrice",userAuth,userController.filterByPrice)
router.get("/search", userAuth, userController.searchProducts);

//transition
router.get("/transition", userController.transition);

//productManagement
router.get("/productDetails", productController.getProductDetails);

//profile management
router.get("/forgot-password", profileController.getForgotPassPage);
router.post("/forgot-email-valid", profileController.forgotEmailValid);
router.post(
  "/verify-passForgot-otp",
  alreadyLoggedIn,
  profileController.verifyForgotPassOtp
);
router.get(
  "/reset-password",
  alreadyLoggedIn,
  profileController.getResetPassPage
);
router.post("/resend-forgot-otp", alreadyLoggedIn, profileController.resendOtp);
router.post(
  "/reset-password",
  alreadyLoggedIn,
  profileController.postNewPassword
);
router.get("/profile", userAuth, profileController.userProfile);
router.get("/change-email", userAuth, profileController.changeEmail);
router.post("/change-email", userAuth, profileController.changeEmailValid);
router.post("/verify-email-otp", userAuth, profileController.verifyEmailOtp);
router.post("/update-email", userAuth, profileController.updateEmail);
router.get("/change-password", userAuth, profileController.changeUserPass);
router.post("/change-password", userAuth, profileController.changeUserPassPost);
router.get("/changeName", userAuth, profileController.changeName);
router.post("/changeName", userAuth, profileController.changeNamePost);
router.get("/change-phone", userAuth, profileController.changePhone);
router.post("/change-phone", userAuth, profileController.changePhonePost);
//address Manegement
router.get("/addAddress", userAuth, profileController.addAddress);
router.post("/addAddress", userAuth, profileController.postAddAddress);
router.get("/editAddress", userAuth, profileController.editAddress);
router.post("/editAddress", userAuth, profileController.postEditAddress);
router.get("/deleteAddress", userAuth, profileController.deleteAddress);

// cart Management

router.get("/cart", userAuth, cartController.getCartPage);
router.post("/addToCart", userAuth, cartController.addToCart);
router.post("/changeQuantity", userAuth, cartController.changeQuantity);
router.get("/deleteItem", userAuth, cartController.deleteProduct);

//order Management

router.get("/checkout", userAuth, orderController.getCheckoutPage);
router.post("/orderPlaced", userAuth, orderController.orderPlaced);
router.get("/orderSuccess", userAuth, orderController.getOrderSuccessPage);
router.get("/orderDetails", userAuth, orderController.getOrderDetailsPage);
router.post("/cancelOrder", userAuth, orderController.cancelOrder);
router.post("/applyCoupon", userAuth, userController.applyCoupon);
router.post("/paymentConfirm", userAuth, orderController.paymentConfirm);
router.post("/verifyPayment", userAuth, orderController.verify);
router.post("/cancel-item", userAuth, orderController.cancelProductItem);
router.post("/returnrequestOrder", userAuth, orderController.returnorder);
router.get(
  "/downloadInvoice/:orderId",
  userAuth,
  (req, res, next) => {
    console.log("Route hit - downloadInvoice");
    console.log("OrderId:", req.params.orderId);
    next();
  },
  orderController.downloadInvoice
);
router.get("/paymentFailed", userAuth, orderController.paymentFailed);
router.post("/retryPayment", userAuth, orderController.retryPayment);

//wishlist management
router.get("/wishlist", userAuth, wishlistController.loadWishlist);
router.post("/addTOWishlist", userAuth, wishlistController.addToWishlist);
router.get("/removeFromWishlist", userAuth, wishlistController.removeProduct);
router.post(
  "/addToCartFromWishlist",
  userAuth,
  wishlistController.addToCartFromWishlist
);
//wallet Management
router.post("/addMoney", userAuth, walletController.addMoneyToWallet);
router.post("/verify-payment", userAuth, walletController.verify_payment);
//rating management
router.get("/rate-product", userAuth, raitingController.getRatingPage);
//count
router.get("/getCountOfCartWish", userController.getCount);

module.exports = router;
