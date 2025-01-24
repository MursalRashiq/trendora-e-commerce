const product =require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const  Brand = require("../../models/brandSchema")
const fs = require("fs")
const path = require("path")
const User = require("../../models/userSchema")
const sharp = require("sharp")
const Product = require("../../models/productSchema")
const mongoose = require("mongoose");


const getProductAddPage = async (req, res)=>{
    try {

       // console.log("Fetching categories...");
        const category = await Category.find({ isListed: true });
        //console.log("Categories fetched:", category);

        //console.log("Fetching brands...");
        const brand = await Brand.find({ isBlocked: false });
       // console.log("Brands fetched:", brand);

       // console.log("Rendering page...");
        res.render("product-add", {
            cat: category,
            brand: brand
        });
        
    } catch (error) {
        res.redirect("/pageerror")
        console.error("not get the add project page",error)
        
    }

}



const addProducts = async (req, res) => {
    try {
        console.log(req.files);
         // Check the incoming data

        const products = req.body;
        console.log(req.body, "req.body"); 
        const productExists = await Product.findOne({ productName: products.productName });

        const regularPrice = parseFloat(products.regularPrice);
        const salePrice = parseFloat(products.salePrice);

        // if (regularPrice < salePrice) {
        //      res.render("add-product",{message: "Enter a valid price"})
        // }        
  
        // Ensure description is a string
         const description = Array.isArray(products.description) ? products.description.join('\n') : products.description;
       
        if (!productExists) {
            const images = [];
            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    const originalImagePath = req.files[i].path;
                    const resizedImagePath = path.join("public", "uploads", "product-images", req.files[i].filename);

                    await sharp(originalImagePath)
                        .resize({ width: 440, height: 440 })
                        .toFile(resizedImagePath);

                    images.push(req.files[i].filename);
                }
            }

            if (images.length === 0) {
                return res.status(400).json({ message: "At least one image is required." });
            }

            const categoryId = await Category.findOne({ name: products.category });
            if (!categoryId) {
                return res.status(400).json({ message: "Invalid category name." });
            }
                const newProduct = new Product({
                productName: products.productName,  // Fixed typo from product to products
                description: products.description,
                brand: products.brand,
                category: categoryId._id,
                regularPrice: products.regularPrice,
                salePrice: products.salePrice,  // Fixed typo from salesPrice
                createdOn: new Date(),
                color: products.color,
                quantity: products.quantity,  // Added quantity field
                productImage: images,
                status: "Available"
    
            });

            await newProduct.save();
            res.redirect("/admin/products");
        } else {
            res.status(400).json({ message: "Product already exists, please try with another name." });
        }
    } catch (error) {
        console.error("Error adding product:", error);
        res.redirect("/admin/pageerror");
    }
};


const getAllProduct = async (req, res)=>{
    try {
        
        const search = req.query.search || "";
        const page = req.query.page || 1
        const limit = 4;

        const productData = await Product.find({
            $or:[
                {productName:{$regex: new RegExp(".*"+search+".","i")}},
                {brand:{$regex: new RegExp(".*"+search+".*","i")}}
            ],
        }).limit(limit*1).skip((page-1)*limit).populate('category').exec()


        const count = await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}}
            ]
        }).countDocuments()

        const category = await Category.find({isListed: true})

        const brand = await Brand.find({isBlocked: false})

        if(category && brand){
            res.render("products",{
                data:productData,
                currentPage: page,
                totalPages:Math.ceil(count/limit),
                cat: category,
                brand:brand,
            })
        }else {
            res.render("page-404")
        }

    } catch (error) {
        
            res.redirect('/pageerror')
    }
}


const addProductOffer = async (req, res) => {
    try {
        const { productId, percentage } = req.body;

        // Validate input
        if (!productId || !percentage) {
            return res.status(400).json({ status: false, message: "Product ID and percentage are required" });
        }

        // Find product by ID
        const findProduct = await Product.findOne({ _id: productId });
        if (!findProduct) {
            return res.status(404).json({ status: false, message: "Product not found" });
        }

        // Find category by product's category ID
        const findCategory = await Category.findOne({ _id: findProduct.category });
        if (!findCategory) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }

        // Check if category offer is greater than the percentage
        if (findCategory.categoryOffer > percentage) {
            return res.json({ status: false, message: "This product category already has a higher category offer" });
        }

        // Calculate new sale price and update product
        const discount = Math.floor(findProduct.regularPrice * (percentage / 100));
        findProduct.salePrice = findProduct.regularPrice - discount;
        findProduct.productOffer = parseInt(percentage); // Ensure percentage is an integer

        // Save the updated product
        await findProduct.save();

        // Save the updated category offer (if needed)
        findCategory.categoryOffer = percentage;
        await findCategory.save();

        res.json({ status: true, message: "Product offer added successfully" });
    } catch (error) {
        console.error("Error in addProductOffer:", error);
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};


    const removeProductOffer = async (req, res) => {
        try {
            const { productId } = req.body;
            console.log("productId", productId)
    
            // Check if productId is provided
            if (!productId) {
                return res.status(400).json({ status: false, message: "Product ID is required" });
            }
    
            // Find the product
            const findProduct = await Product.findOne({ _id: productId });
            if (!findProduct) {
                return res.status(404).json({ status: false, message: "Product not found" });
            }
    
            // Ensure productOffer exists
            const percentage = findProduct.productOffer || 0;
            if (percentage === 0) {
                return res.json({ status: false, message: "No offer to remove" });
            }
    
            // Recalculate salePrice
            findProduct.salePrice = Math.floor(
                findProduct.salePrice + (findProduct.regularPrice * percentage) / 100
            );
    
            // Reset product offer
            findProduct.productOffer = 0;
    
            // Save the product
            await findProduct.save();
    
            return res.json({ status: true, message: "Product offer removed successfully" });
    
        } catch (error) {
            console.error("Error in removeProductOffer:", error);
            return res.status(500).json({
                status: false,
                message: "Internal Server Error",
            });
        }
    };

    const blockProduct = async (req, res)=>{
        try {
            
            const id = req.query.id
            await Product.updateOne({_id:id},{$set:{isBlocked: true}})
            res.redirect('/admin/products')



        } catch (error) {
            res.redirect("/pageerror")
        }
    }


    const unBlockProduct = async (req, res)=>{
        try {
            
            const id = req.query.id

            await Product.updateOne({_id:id}, {$set:{isBlocked: false}})
            res.redirect("/admin/products")



        } catch (error) {
            
        }
    }

    const getEditProduct = async(req, res)=>{
        try {


            const id = req.query.id;
           // console.log(id)
            const product = await Product.findOne({_id:id})
            const category = await Category.find({})
            const brand = await Brand.find({})

            console.log("category", category)

            res.render("edit-product",{
                product:product,
                cat:category,
                brand: brand,
                productImage:product.productImage
            })
            
        } catch (error) {

            console.error(error)

            res.redirect("/pageerror")
            
        }
    }


    const editProduct = async (req, res) => {
        try {
            let id = req.params.id?.trim(); // Trim the ID to remove spaces
            console.log("Raw Product ID:", req.params.id);
            console.log("Trimmed Product ID:", id);
    
            // Validate product ID
            if (!id || !mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({ error: "Invalid or missing Product ID" });
            }
    
            // Fetch the product by ID
            const product = await Product.findById(id);
            if (!product) {
                return res.status(404).json({ error: "Product not found" });
            }
    
            const data = req.body;
            console.log("Request Data:", data);
    
            // Check for existing product with the same name
            const existingProduct = await Product.findOne({
                productName: data.productName,
                _id: { $ne: id }, // Exclude the current product ID
            });
    
            if (existingProduct) {
                return res.status(400).json({
                    error: "Product with this name already exists. Please try with another name.",
                });
            }
    
            // Process uploaded files
            const images = req.files?.map(file => file.filename) || [];
            console.log("Uploaded Images:", images);
    
            // Build update fields
            const updateFields = {
                productName: data.productName,
                description: data.description,
                brand: data.brand,
                category: product.category,
                regularPrice: data.regularPrice,
                salePrice: data.salePrice,
                quantity: data.quantity,
                size: data.size,
                color: data.color,
            };
    
            // Add images to the update if any were uploaded
            if (req.files && req.files.length > 0) {
                updateFields.$push = { productImage: { $each: images } };
            }
    
            // Update the product
            await Product.findByIdAndUpdate(id, updateFields, { new: true });
            console.log("Product updated successfully");
            res.redirect("/admin/products");
        } catch (error) {
            console.error("Error updating product:", error.message, error.stack);
            res.redirect("/pageerror");
        }
    };



    


    const deleteSingleImage = async (req, res)=>{
        try {
            const { imageNameToServer, productIdToServer } = req.body; // Corrected variable names
            const product = await Product.findByIdAndUpdate(productIdToServer, { $pull: { productImage: imageNameToServer } });
            const imagePath = path.join("public", "uploads", "re-image", imageNameToServer);
    
            console.log(`imagePath: ${imagePath}`);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath); // Synchronously delete the file
                console.log(`Image ${imageNameToServer} deleted successfully`);
            } else {
                console.log(`Image ${imageNameToServer} not found`);
            }
    
            res.send({ status: true });
        } catch (error) {
            console.error(error);
            res.redirect("/pageerror");
        }
    }

module.exports ={
    getProductAddPage,
    addProducts,
    getAllProduct,
    addProductOffer,
    removeProductOffer,
    blockProduct,
    unBlockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage
}