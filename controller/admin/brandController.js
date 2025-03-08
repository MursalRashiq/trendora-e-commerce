const Brand = require("../../models/brandSchema")
const Product = require("../../models/productSchema")
const asyncHandler = require('express-async-handler');



const getBrandPage = asyncHandler(async (req, res) => {
    
        const page = parseInt(req.query.page) || 1; // Current page number
        const limit = 4; // Number of items per page
        const skip = (page - 1) * limit; // Items to skip for pagination

        // Fetch brand data with sorting, skipping, and limiting
        const brandData = await Brand.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Get total number of brands and calculate total pages
        const totalBrands = await Brand.countDocuments();
        const totalPages = Math.ceil(totalBrands / limit);

        // Render the page with the fetched data
        res.render("brands", {
            data: brandData,
            currentPage: page,
            totalPages: totalPages,
            totalBrands: totalBrands,
        });
})

const addBrand = asyncHandler(async (req, res) => {
    
        const brand = req.body.name;
        if (!brand) {
            return res.status(400).send("Brand name is required.");
        }

        const findBrand = await Brand.findOne({ brandName: brand });

        if (findBrand) {
            return res.status(400).send("Brand already exists.");
        }

        if (!req.file) {
            return res.status(400).send("Brand image is required.");
        }

        const image = req.file.filename;

        const newBrand = new Brand({
            brandName: brand,
            brandImage: image, 
        });

        await newBrand.save();

        res.redirect("/admin/brands");

})


const blockBrand = asyncHandler(async (req, res)=>{
    
        const id = req.query.id
       // console.log(id)
        await Brand.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect("/admin/brands")
   
})


const unBlockBrand = asyncHandler (async(req, res) =>{
    
        const id = req.query.id;
        //console.log(id)
        await Brand.updateOne({_id:id},{$set:{isBlocked: false}})
        res.redirect("/admin/brands")
    
})
    


const deleteBrand = asyncHandler (async(req, res) => {

        const {id} = req.query
        if(!id){
            return res.status(400).redirect("/pageerror")
        }
        await Brand.deleteOne({_id:id})
        res.redirect("/admin/brands")
  
})


module.exports = {
    getBrandPage,
    addBrand,
    blockBrand,
    unBlockBrand,
    deleteBrand
}