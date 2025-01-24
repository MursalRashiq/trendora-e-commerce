const express = require('express')
const router = express.Router()
const userController = require("../controller/user/userController")
const passport = require('../config/passport')
const {userAuth, alreadyLoggedIn} = require("../middleware/auth")
const productController = require("../controller/user/productController")
const profileController = require("../controller/user/profileController")



router.get("/",userController.loadHomePage)
router.get("/pageNotFound", userController.pageNotFound)
router.get("/signup",alreadyLoggedIn,userController.loadSignUp)
router.post('/signup',alreadyLoggedIn,userController.signup)
router.post("/verify-otp",userController.verifyOtp)
//router.get("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)
router.get("/auth/google",alreadyLoggedIn,passport.authenticate('google',{scope:['profile', 'email']}))
router.get('/auth/google/callback',alreadyLoggedIn,passport.authenticate('google', {failureRedirect:'/signup'}), (req, res)=>{
    if (req.user) {
        // Adding user data to session or locals for next page access
        req.session.user = req.user; // Save user to session (if using sessions)
      }
    res.redirect('/')
})

router.get('/login',alreadyLoggedIn,userController.loadLogin)
router.post('/login',alreadyLoggedIn,userController.loginPage)
router.get("/logout", userController.logout)
router.get("/shop",userController.loadShoppingPage)
router.get("/filter",userController.filterProduct)

//transition
router.get("/transition",userController.transition)


//productManagement
router.get("/productDetails",productController.getProductDetails)



//profile management
router.get("/forgot-password",profileController.getForgotPassPage)
router.post("/forgot-email-valid",profileController.forgotEmailValid)
router.post("/verify-passForgot-otp",alreadyLoggedIn,profileController.verifyForgotPassOtp)
router.get("/reset-password",alreadyLoggedIn,profileController.getResetPassPage)
router.post("/resend-forgot-otp",alreadyLoggedIn, profileController.resendOtp)
router.post("/reset-password",alreadyLoggedIn,profileController.postNewPassword);
router.get("/profile",userAuth,profileController.userProfile)
router.get("/change-email",userAuth,profileController.changeEmail)
router.post("/change-email",userAuth,profileController.changeEmailValid)
router.post("/verify-email-otp", userAuth,profileController.verifyEmailOtp)
router.post("/update-email",userAuth,profileController.updateEmail);
router.get("/change-password", userAuth,profileController.changePassword)
router.post("/change-password",userAuth,profileController.changePasswordValid)
router.post("/verify-changepassword-otp",userAuth, profileController.verifyChangePassOtp)






module.exports = router
