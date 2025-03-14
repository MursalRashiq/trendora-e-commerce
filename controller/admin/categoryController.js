const Category = require("../../models/categorySchema")
const { findOne } = require("../../models/userSchema")
const Product = require("../../models/productSchema")




const categoryInfo = async (req, res)=>{
    try {
        
        const page = parseInt(req.query.page) || 1
        const limit = 4
        const skip = (page-1)*limit


        const categoryData = await Category.find({})
        .sort({createAt: -1})
        .skip(skip)
        .limit(limit)


        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories / limit)

        res.render("category", {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories
        })



    } catch (error) {


        console.error("category", error);
        res.redirect("/pageerror")
        
        
    }
}


const addCategory = async(req, res) =>{
    const {name, description} = req.body

   // console.log(req.body)
    try {
        
        const existingCategory = await Category.findOne({name: { $regex: new RegExp(`^${name}$`, 'i') } })
        if(existingCategory){
            return res.status(400).json({error:"Category alredy exist"})
        }
        const newCategory = new Category({
            name,
            description
        })
        await newCategory.save()
        return res.json({message: "Category added successfully"})

    } catch (error) {

        return res.status(500).json({error:"Internal server error"})
        
    }
}


const addCategoryOffer = async (req, res) => {
    try {
        const { categoryId, percentage } = req.body;

        // Validate input
        if (!categoryId || !percentage) {
            return res.status(400).json({ 
                status: false, 
                message: "Category ID and percentage are required" 
            });
        }

        // Find category
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ 
                status: false, 
                message: "Category not found" 
            });
        }

        // Find all products in the category
        const products = await Product.find({ category: categoryId });

        // Check if any products have higher product offers
        const productsWithHigherOffer = products.filter(
            product => product.productOffer > percentage
        );

        if (productsWithHigherOffer.length > 0) {
            return res.json({ 
                status: false, 
                message: "Some products in this category have higher product offers" 
            });
        }

        // Update category offer
        category.categoryOffer = parseInt(percentage);
        await category.save();

        // Update all products in the category
        for (const product of products) {
            if (!product.productOffer || product.productOffer < percentage) {
                const discount = Math.floor(product.regularPrice * (percentage / 100));
                product.salePrice = product.regularPrice - discount;
                await product.save();
            }
        }

        res.json({ 
            status: true, 
            message: "Category offer added successfully" 
        });

    } catch (error) {
        console.error("Error in addCategoryOffer:", error);
        res.status(500).json({ 
            status: false, 
            message: "Internal Server Error" 
        });
    }
};

const removeCategoryOffer = async (req, res) => {
    try {
        const { categoryId } = req.body;

        // Validate input
        if (!categoryId) {
            return res.status(400).json({ 
                status: false, 
                message: "Category ID is required" 
            });
        }

        // Find category
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ 
                status: false, 
                message: "Category not found" 
            });
        }

        // Check if there's an offer to remove
        const percentage = category.categoryOffer || 0;
        if (percentage === 0) {
            return res.json({ 
                status: false, 
                message: "No category offer to remove" 
            });
        }

        // Find all products in the category
        const products = await Product.find({ category: categoryId });

        // Update products' sale prices
        for (const product of products) {
            if (!product.productOffer || product.productOffer < percentage) {
                // If product has its own offer, apply that instead
                if (product.productOffer) {
                    const productDiscount = Math.floor(
                        product.regularPrice * (product.productOffer / 100)
                    );
                    product.salePrice = product.regularPrice - productDiscount;
                } else {
                    // If no product offer, reset to regular price
                    product.salePrice = product.regularPrice;
                }
                await product.save();
            }
        }

        // Reset category offer
        category.categoryOffer = 0;
        await category.save();

        return res.json({ 
            status: true, 
            message: "Category offer removed successfully" 
        });

    } catch (error) {
        console.error("Error in removeCategoryOffer:", error);
        return res.status(500).json({ 
            status: false, 
            message: "Internal Server Error" 
        });
    }
};

const getListCategory = async (req, res) =>{
    try {

        let id = req.query.id
        await Category.updateOne({_id:id},{$set:{isListed: false}})
        res.redirect("/admin/category")
    } catch (error) {
       
        res.redirect("/pageerror")


    }
}

const getUnlistCategory = async (req, res) =>{
    try {
        let id = req.query.id
        await Category.updateOne({_id:id},{$set:{isListed: true}})
        res.redirect("/admin/category")
    } catch (error) {
        
        res.redirect("/pageerror")


    }
}

const getEditCatagory = async (req, res) =>{
    try {
        
        const id = req.params.id
        const category = await Category.findOne({_id:id})

        res.render("edit-category", {category:category})


    } catch (error) {

        res.redirect("/pageerror")
        
    }
}


const editCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const { name, description } = req.body; // Access name instead of categoryName

        // Check if the form fields are being passed correctly
       // console.log(req.body);  // Log the request body to debug

        // Validate inputs
        if (!name || !description) {
            return res.status(400).json({ error: "Name and description are required" });
        }

        // Check if the new category name already exists (except for the current one being updated)
        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') } ,
            _id: { $ne: id }
        });

        if (existingCategory) {
            return res.status(400).json({ error: "Category exists, Please choose another name" });
        }

        // Update the category
        const updatecategory = await Category.findByIdAndUpdate(
            id,
            { name: name, description: description },
            { new: true }
        );

        if (updatecategory) {
            res.redirect("/admin/category");
        } else {
            return res.status(500).json({ error: "Failed to update category" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
};

module.exports = {
    categoryInfo,
    addCategory,
    addCategoryOffer,
    removeCategoryOffer,
    getListCategory,
    getUnlistCategory,
    getEditCatagory,
    editCategory
}