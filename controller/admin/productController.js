const product =require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const  Brand = require("../../models/brandSchema")
const fs = require("fs")
const path = require("path")
const User = require("../../models/userSchema")
const sharp = require("sharp")
const Product = require("../../models/productSchema")
const mongoose = require("mongoose");
const { uploadToCloudinary, cloudinary } = require('../../config/cloudinaryConfig');


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
        const products = req.body;
        const productExists = await Product.findOne({ productName: products.productName });

        if (productExists) {
            return res.status(400).send("Product already exists, please try with another name.");
        }

        // Initialize images array for cloudinary URLs
        const images = [];
        
        // Upload images to cloudinary
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    const result = await uploadToCloudinary(file);
                    images.push({
                        url: result.secure_url,
                        public_id: result.public_id
                    });
                } catch (error) {
                    console.error('Error uploading to Cloudinary:', error);
                    return res.status(500).send("Error uploading images");
                }
            }
        }

        if (images.length === 0) {
            return res.status(400).send("At least one image is required.");
        }

        const categoryId = await Category.findOne({ name: products.category });
        if (!categoryId) {
            return res.status(400).send("Invalid category name.");
        }

        // Create new product with cloudinary URLs
        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            brand: products.brand,
            category: categoryId._id,
            regularPrice: products.regularPrice,
            salePrice: products.salePrice,
            createdOn: new Date(),
            color: products.color,
            quantity: products.quantity,
            productImage: images.map(img => img.url), // Store only the URLs
            cloudinaryIds: images.map(img => img.public_id), // Store cloudinary public_ids
            status: "Available"
        });

        await newProduct.save();
        return res.redirect("/admin/products");

    } catch (error) {
        console.error("Error adding product:", error);
        return res.status(500).send("Error adding product: " + error.message);
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
           // console.log("productId", productId)
    
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

    const getEditProduct = async (req, res) => {
        try {
            const productId = req.params.id;
            console.log("1. Requested Product ID:", productId);

            if (!mongoose.Types.ObjectId.isValid(productId)) {
                console.log("Invalid Product ID format");
                return res.redirect("/admin/products");
            }

            // Fetch the product with populated category
            const product = await Product.findById(productId).populate('category');
            
            if (!product) {
                console.log("Product not found");
                return res.redirect("/admin/products");
            }

            // Fetch categories and brands
            const [categories, brands] = await Promise.all([
                Category.find({}),
                Brand.find({})
            ]);

            // Debug logs
            console.log("2. Product Data:", {
                id: product._id,
                name: product.productName,
                images: product.productImage,
                imageCount: product.productImage.length
            });

            // Render the page with all necessary data
            res.render("edit-product", {
                product: product,
                cat: categories,
                brand: brands,
                currentImages: product.productImage,
                message: ""
            });

        } catch (error) {
            console.error("Error in getEditProduct:", error);
            console.error('Full error stack:', error.stack);
            res.redirect("/admin/products");
        }
    };


    const editProduct = async (req, res) => {
        try {
            let id = req.params.id?.trim();
    
            // Validate product ID
            if (!id || !mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({ error: "Invalid or missing Product ID" });
            }
    
            // Fetch the product
            const product = await Product.findById(id);
            if (!product) {
                return res.status(404).json({ error: "Product not found" });
            }
    
            const data = req.body;
            
            // Check for existing product with same name
            const existingProduct = await Product.findOne({
                productName: data.productName,
                _id: { $ne: id }
            });

            if (existingProduct) {
                return res.status(400).json({
                    error: "Product with this name already exists"
                });
            }

            // Handle image uploads to Cloudinary
            const images = [];
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    try {
                        const result = await uploadToCloudinary(file);
                        images.push({
                            url: result.secure_url,
                            public_id: result.public_id
                        });
                    } catch (error) {
                        console.error('Error uploading to Cloudinary:', error);
                        return res.status(500).send("Error uploading images");
                    }
                }
            }

            // Handle category
            let categoryId;
            if (mongoose.Types.ObjectId.isValid(data.category)) {
                categoryId = data.category;
            } else {
                const category = await Category.findOne({ name: data.category });
                if (!category) {
                    return res.status(400).json({ error: "Invalid category" });
                }
                categoryId = category._id;
            }

            // Build update fields
            const updateFields = {
                productName: data.productName,
                description: data.description,
                brand: data.brand,
                category: categoryId,
                regularPrice: parseFloat(data.regularPrice),
                salePrice: parseFloat(data.salePrice),
                quantity: parseInt(data.quantity),
                size: data.size,
                color: data.color,
            };

            // Add new images if any were uploaded
            if (images.length > 0) {
                updateFields.$push = { 
                    productImage: { $each: images.map(img => img.url) },
                    cloudinaryIds: { $each: images.map(img => img.public_id) }
                };
            }

            // Update the product
            const updatedProduct = await Product.findByIdAndUpdate(
                id,
                updateFields,
                { new: true, runValidators: true }
            );

            console.log("Updated Product:", updatedProduct);
            res.redirect("/admin/products");

        } catch (error) {
            console.error("Error updating product:", error);
            res.status(500).json({ 
                error: "Error updating product", 
                details: error.message 
            });
        }
    };


    


    const deleteSingleImage = async (req, res) => {
        try {
            const { imageUrl, productId } = req.body;
            console.log("Delete request for:", { imageUrl, productId });

            // Validate productId
            if (!mongoose.Types.ObjectId.isValid(productId)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid product ID' 
                });
            }

            // Find the product
            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Product not found' 
                });
            }

            // Find the index of the image URL
            const imageIndex = product.productImage.indexOf(imageUrl);
            if (imageIndex === -1) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Image not found in product' 
                });
            }

            // Get the corresponding cloudinary public_id
            const publicId = product.cloudinaryIds[imageIndex];
            console.log("Attempting to delete Cloudinary image:", publicId);

            // Delete from cloudinary if it's a cloudinary URL
            if (publicId) {
                try {
                    await cloudinary.uploader.destroy(publicId);
                    console.log("Successfully deleted from Cloudinary");
                } catch (cloudinaryError) {
                    console.error("Cloudinary deletion error:", cloudinaryError);
                    // Continue with local deletion even if cloudinary fails
                }
            }

            // Remove from product document
            product.productImage.splice(imageIndex, 1);
            product.cloudinaryIds.splice(imageIndex, 1);
            await product.save();
            console.log("Successfully updated product document");

            return res.json({ 
                success: true, 
                message: 'Image deleted successfully' 
            });

        } catch (error) {
            console.error('Error in deleteSingleImage:', error);
            return res.status(500).json({ 
                success: false, 
                message: 'Error deleting image',
                error: error.message 
            });
        }
    };

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