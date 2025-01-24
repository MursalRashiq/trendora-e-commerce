const Brand = require("../../models/brandSchema")
const Product = require("../../models/productSchema")



const getBrandPage = async (req, res) => {
    try {
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
    } catch (error) {
        console.error("Error fetching brand data:", error);
        res.redirect("/pageerror");
    }
};

const addBrand = async (req, res) => {
    try {
        const brand = req.body.name;
        if (!brand) {
            // If no brand name is provided, return an error response
            return res.status(400).send("Brand name is required.");
        }

        // Check if the brand already exists in the database
        const findBrand = await Brand.findOne({ brandName: brand });

        if (findBrand) {
            // If brand exists, send a response indicating that the brand already exists
            return res.status(400).send("Brand already exists.");
        }

        // Ensure the image was uploaded correctly
        if (!req.file) {
            return res.status(400).send("Brand image is required.");
        }

        // Extract the filename of the uploaded image
        const image = req.file.filename;

        // Create a new brand entry in the database
        const newBrand = new Brand({
            brandName: brand,
            brandImage: image, // Save the image filename
        });

        // Save the new brand to the database
        await newBrand.save();

        // Redirect to the brands page after successfully adding the brand
        res.redirect("/admin/brands");

    } catch (error) {
        // Log the error and send a generic error response
        console.error("Error adding brand:", error);
        res.status(500).redirect("/pageerror");
    }
}


const blockBrand = async (req, res)=>{
    try {
        const id = req.query.id
       // console.log(id)
        await Brand.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect("/admin/brands")
    } catch (error) {
        
    }
}


const unBlockBrand = async (req, res) =>{
    try {
        const id = req.query.id;
        //console.log(id)
        await Brand.updateOne({_id:id},{$set:{isBlocked: false}})
        res.redirect("/admin/brands")
    } catch (error) {
        res.redirect("/pageerror")
    }
}
    


const deleteBrand = async (req, res) => {
    try {
        const {id} = req.query
        if(!id){
            return res.status(400).redirect("/pageerror")
        }
        await Brand.deleteOne({_id:id})
        res.redirect("/admin/brands")
    } catch (error) {
        console.error("error deleting brand:", error)
        res.status(500).redirect("/pageerror")
    }
}


module.exports = {
    getBrandPage,
    addBrand,
    blockBrand,
    unBlockBrand,
    deleteBrand
}