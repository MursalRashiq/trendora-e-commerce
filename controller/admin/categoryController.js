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
        const percentage = parseInt(req.body.percentage);
        const categoryId = req.body.categoryId;
        //console.log(req.body.categoryId)
        console.log(req.body)
        // Fetch the category
        const category = await Category.findById(categoryId);
       // console.log(category)
        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }

        // Fetch products in the category
        const products = await Product.find({ category: category._id });
        const hasProductOffer = products.some((prod) => prod.productOffer > percentage);

        if (hasProductOffer) {
            return res.json({ status: false, message: "Product within this category already has a higher product offer" });
        }

        // Update category offer
        await Category.updateOne({ _id: category._id }, { $set: { categoryOffer: percentage } });

        // Reset product offers and prices
        for (const prod of products) {
            prod.productOffer = 0;
            prod.salePrice = prod.regularPrice;
            await prod.save();
        }

        res.json({ status: true });
    } catch (error) {
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

const removeCategoryOffer = async (req, res) => {
    try {
        const categoryId = req.body.categoryId;

        // Fetch the category
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }

        const percentage = category.categoryOffer;

        // Fetch products in the category
        const products = await Product.find({ category: category._id });

        if (products.length > 0) {
            for (const prod of products) {
                prod.salePrice -= Math.floor(prod.regularPrice * (percentage / 100));
                prod.productOffer = 0;
                await prod.save();
            }
        }

        // Reset category offer
        category.categoryOffer = 0;
        await category.save();

        res.json({ status: true });
    } catch (error) {
        res.status(500).json({ status: false, message: "Internal server error" });
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