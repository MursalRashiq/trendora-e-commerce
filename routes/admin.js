const express = require ("express")
const router = express.Router()
const adminController = require("../controller/admin/adminController")
const { adminAuth} = require ("../middleware/auth")
const customerController = require("../controller/admin/customerController")
const categaryController = require("../controller/admin/categoryController")
const multer = require("multer");
const storage = require("../helpers/multer")
const uploads = multer({storage: storage});
const brandController = require("../controller/admin/brandController")
const productController = require("../controller/admin/productController")
const orderController = require("../controller/admin/orderController")
const couponController = require("../controller/admin/couponController")
const salesController = require("../controller/admin/salesController")
const bannerController = require("../controller/admin/bannerController")











router.get("/pageerror",adminController.pageerror)
router.get("/login", adminController.loadLogin)
router.post("/login",adminController.login)
router.get("/",adminAuth,adminController.loadDashboard)
router.get("/logout",adminController.logout)
// Customers Management
router.get("/users", adminAuth,customerController.customerInfo)
router.get("/blockCustomer",adminAuth,customerController.customerBlocked)
router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked)
//category Management
router.get("/category",adminAuth,categaryController.categoryInfo)
router.post("/addCategory",adminAuth,categaryController.addCategory)
router.post("/addCategoryOffer",adminAuth,categaryController.addCategoryOffer)
router.post("/removeCategoryOffer",adminAuth,categaryController.removeCategoryOffer)
router.get("/listCategory",adminAuth,categaryController.getListCategory)
router.get("/unlistCategory",adminAuth, categaryController.getUnlistCategory)
router.get("/editCategory/:id",adminAuth,categaryController.getEditCatagory)
router.post("/editCategory/:id",adminAuth,categaryController.editCategory)
//brand management
router.get("/brands",adminAuth,brandController.getBrandPage)
router.post("/addBrand",adminAuth, uploads.single("image"),brandController.addBrand)
router.get("/blockBrand",adminAuth,brandController.blockBrand)
router.get("/unBlockBrand",adminAuth,brandController.unBlockBrand)
router.get("/deleteBrand",adminAuth,brandController.deleteBrand)
// Product Management 
router.get("/addProducts",adminAuth,productController.getProductAddPage)
router.post("/addProducts",adminAuth,uploads.array('images',4),productController.addProducts)
router.get("/products",adminAuth,productController.getAllProduct);
router.post("/addProductOffer",adminAuth,productController.addProductOffer);
router.post("/removeProductOffer",adminAuth,productController.removeProductOffer)
router.get("/blockProduct",adminAuth,productController.blockProduct)
router.get("/unBlockProduct",adminAuth,productController.unBlockProduct)
router.get("/edit-product/:id", adminAuth, productController.getEditProduct);
router.post("/editProduct/:id",adminAuth,uploads.array("images",4),productController.editProduct)
router.post("/deleteImage", adminAuth, productController.deleteSingleImage)
//order Management
router.get("/orderList",  orderController.getOrderListPageAdmin)
router.get("/orderDetailsAdmin",  orderController.getOrderDetailsPageAdmin)
router.post("/changeItemStatus",orderController.changeItemStatus)
router.put("/changeStatus", orderController.changeOrderStatus);
router.get("/approveReturn",orderController.approveReturn)
router.post("/rejectReturnOrder",orderController.rejectReturnRequest)
//coupon management
router.get("/coupon", adminAuth, couponController.loadCoupon)
router.post("/createCoupon",adminAuth,couponController.createCoupon)
router.get("/editCoupon",adminAuth,couponController.editCoupon)
router.post("/updateCoupon",adminAuth,couponController.updateCoupon)
router.get("/deleteCoupon",adminAuth,couponController.deleteCoupon)
router.post("/updateCouponStatus",adminAuth,couponController.couponStatusUpdate)
//sales management
router.get('/salesReport', adminAuth, salesController.getSalesReport);
// router.get('/dateWiseFilter', adminAuth, salesController.dateWiseFilter);
router.get('/generatePdf', adminAuth, salesController.downloadSalesReportPDF);
router.get('/downloadExcel', adminAuth, salesController.downloadSalesReportExcel);
//Banner Management 
router.get("/banner",adminAuth,bannerController.getBannerPage)
router.get('/addBanner',adminAuth,bannerController.getAddBannerPage)
router.post('/addBanner',adminAuth,uploads.single("images"),bannerController.postAddBanner)
router.get("/deleteBanner",adminAuth,bannerController.deleteBanner)
//chart Management
router.get("/chart-data",adminAuth,adminController.chartData)








module.exports = router