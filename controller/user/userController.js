
const User = require("../../models/userSchema")
const nodemailer = require('nodemailer')
const dotenv = require('dotenv').config()
const bcrypt = require("bcrypt")
const Product = require("../../models/productSchema")
const Brand = require("../../models/brandSchema")
const Category = require("../../models/categorySchema")





const loadHomePage = async (req, res) => {
    try {
        const user = req.session.user

        
        //console.log(user)

            const locals = await User.findOne({ _id: user,  })
            
       
        const categories = await Category.find({ isListed: true });
        let productData = await Product.find({
            isBlocked: false,
            category: { $in: categories.map((category) => category._id) },
            quantity: { $gt: 0 },
        });

        console.log(productData,"qwertyuigf")
  
        productData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        productData = productData.slice(0, 4);

        res.render("home",{
            locals: locals,
            products: productData
        })

    } catch (error) {
        console.log("Home page not found")
        res.status(500).send('server error')
    }
}

const pageNotFound = async (req, res) => {
    try {
        res.render('404')
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}



const loadSignUp = async (req, res) => {
    try {
        return res.render('signup')
    } catch (error) {
        console.log('Home page is not loading', error)
        res.status(500).send('server error')
    }
}


const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
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
        // Check if all fields are provided
        if (!fullname || !email || !password || !phone) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        // Check if user already exists
        const existingUserByEmail = await User.findOne({ email });
        const existingUserByPhone = await User.findOne({ phone });

        //console.log(existingUserByEmail, existingUserByPhone)

        if (existingUserByEmail || existingUserByPhone) {
            res.render("signup", {message: "User Already exist try with other details"})
        }

        

        // Generate OTP
        const otp = generateOtp();
        console.log('Generated OTP:', otp);

        // Send OTP to the user's email
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.json({ success: false, message: 'Failed to send OTP, please try again' });
        }

        // Store OTP and user data in the session
        req.session.userOtp = otp;
        req.session.userData = { fullname, email, password, phone };
        //req.session.otpExpiration = expirationTime

        // Log session data to debug
        console.log('Session data after OTP generation:', req.session);

        // Redirect to the OTP verification page
        return res.render("verify-otp");
    } catch (error) {
        console.error('SignUpPage Error:', error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};


const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash
    } catch (error) {

        console.error("Error hashing password:", error);
        throw new Error("Password hashing failed");

    }
}

const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        console.log(otp)

        if (otp == req.session.userOtp) {
            const { fullname, email, phone, password } = req.session.userData;

            // Hash the password
            const passwordHash = await securePassword(password);
            const saveUserData = new User({
                name: fullname,
                email: email,
                phone: phone,
                password: passwordHash,
              
                

            })
            console.log("userData",saveUserData)

            await saveUserData.save();


            req.session.user = saveUserData._id;
            //console.log( req.session.user )
            res.json({success: true, redirectUrl:"/                             "})
        } else {
            res.status(400).json({ success: false, message: " Invalid OTP, Please try again " })
        }

    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


const resendOtp = async (req, res) => {
    try {

        const { email } = req.session.userData
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not founding session" })
        }

        const otp = generateOtp();
        req.session.userOtp = otp


        const emailSent = await sendVerificationEmail(email, otp)
        if (emailSent) {
            console.log("Resend OTP", otp);
            res.status(200).json({ success: true, message: "OTP Resend Successfully" })

        } else {
            res.status(500).json({ success: false, message: "Failed to resend OTP, Please try again" })
        }

    } catch (error) {
        console.error("Error Occure", error)
        res.status(500).json({ success: false, message: "Internal server error" })
    }
}

const loadLogin = async (req, res) => {
    try {

        res.render('login')

    } catch (error) {

        res.status(404).redirect('/pageNotFound')


    }


}

const loginPage = async (req, res) => {
    try {
        const { email, password } = req.body
        console.log("password:",password);
        const findUser = await User.findOne({ isAdmin: 0, email: email });
        console.log(findUser, "findUser")
        if (!findUser) {
            return res.render("login", { message: "User not Found" });
        }

        if (findUser.isBlocked) {
            return res.render('userBlocked');
        }

        console.log(findUser.password, "findUser.password")
       // console.log(password, "password")


        const passwordMatch = await bcrypt.compare(password, findUser.password);
        console.log(passwordMatch, "password")
        if (!passwordMatch) {
            return res.render("login", { message: "Incorrect Password" });
        }

        req.session.user = findUser._id;
        res.redirect("transition")


    } catch (error) {


        console.log("login error ", error)
        res.render("login", { message: "login failed, please try again later" })

    }
}


const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log("Session destructure error", err.message)
                return res.redirect("/pageNotFound")
            }
            return res.redirect("/login")
        })
    } catch (error) {
        console.log("Logout error", error);
        res.redirect("/pageNotFound")
    }
}



const loadShoppingPage = async (req, res) => {
    try {
        const user = req.session.user || null; // Get user data from session
        const userData = await User.findOne({ _id: user });
        const categories = await Category.find({ isListed: true }); // Fetch categories
        const brands = await Brand.find({ isBlocked: false }).select("brandName brandImage");
        //console.log("Fetched Brands:", brands); // Debug to check fetched brands

        const users = req.session.user

        //console.log(user)
        if (users) {

            const locals = await User.findOne({ _id: user })
        }
        const categoryIds = categories.map((category) => category._id.toString());
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        const products = await Product.find({
            isBlocked: false,
            category: { $in: categoryIds },
            quantity: { $gt: 0 },
        })
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit);

        //console.log(products)

        const totalProducts = await Product.countDocuments({
            isBlocked: false,
            category: { $in: categoryIds },
            quantity: { $gt: 0 },
        });
        const totalPages = Math.ceil(totalProducts / limit);


        


        res.render("shop", {
            locals: userData,
            products: products,
            categories: categories, // Pass categories to the view
            brands: brands,
            totalProducts: totalProducts,
            currentPage: page,
            totalPages: totalPages,
        });


    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const filterProduct = async (req, res) => {
    try {
        const user = req.session.user;
        const category = req.query.category;
        const brand = req.query.brand;
        const findCategory = category ? await Category.findOne({ _id: category }) : null;
        const findBrand = brand ? await Brand.findOne({ _id: brand }) : null;
        const brands = await Brand.find({}).lean();
        const query = {
            isBlocked: false,
            quantity: { $gt: 0 }
        };

        if (findCategory) {
            query.category = findCategory._id;
        }

        if (findBrand) {
            query.brand = findBrand.brandName;
        }

        let findProducts = await Product.find(query).lean();
        findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

        const categories = await Category.find({ isListed: true });

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);
        const currentProduct = findProducts.slice(startIndex, endIndex);
        let userData = null;

        if (user) {
            userData = await User.findOne({ _id: user });
            if (userData) {
                const searchEntry = {
                    category: findCategory ? findCategory._id : null,
                    brand: findBrand ? findBrand.brandName : null,
                    searchOn: new Date() // Fix the date instantiation
                };
                userData.searchHistory.push(searchEntry);
                await userData.save();
            }
        }
        // Storing to session
        req.session.filterProducts = currentProduct;

        res.render("shop", {
            locals: userData,
            products: currentProduct,
            categories: categories,
            brands: brands,
            totalPages,
            currentPage,

        });
    } catch (error) {
        console.error(error);
        res.redirect("/pageNotFound");
    }
};


const transition = async(req, res) =>{
    try {

        res.render("transition")
    } catch (error) {
        
    }
}


const sortProduct = async (req, res) => {
    try {
        const user = req.session.user;
        const sortOption = req.query.sort || ''; // If undefined, assign empty string
        const category = req.query.category;
        const brand = req.query.brand;
        const page = parseInt(req.query.page) || 1; // Handle pagination
        const limit = 10; // Number of products per page
        const skip = (page - 1) * limit; // Skip based on the current page

        let query = { isBlocked: false, quantity: { $gt: 0 } };

        if (category) {
            query.category = category;
        }

        if (brand) {
            query.brand = brand;
        }

        let sortCriteria = {};

        switch (sortOption) {
            case "a-z":
                sortCriteria = { productName: 1 };
                break;
            case "z-a":
                sortCriteria = { productName: -1 };
                break;
            case "low-high":
                sortCriteria = { salePrice: 1 };
                break;
            case "high-low":
                sortCriteria = { salePrice: -1 };
                break;
            default:
                sortCriteria = {};
                break;
        }

        // Get products with pagination and sorting
        const products = await Product.find(query)
            .sort(sortCriteria)
            .skip(skip)
            .limit(limit)
            .lean();

        // Get total count of products to calculate pagination
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find();


        const userData = await User.findOne({_id: user})

        if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') { // Check if it's an AJAX request
            // Render only the product grid partial
            return res.render('partials/product-grid', { products }); // No layout
        } else {
            // Normal request, render the full shop view
            res.render("shop", {
                products,
                categories,
                brands,
                sortOption: req.query.sort || '',
                currentPage: page,
                totalPages,
                locals: user // Assuming 'user' is defined somewhere
            });
        }

        
    } catch (error) {
        console.error("Sorting error", error);
        res.status(500).send("Server Error");
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
    sortProduct
}