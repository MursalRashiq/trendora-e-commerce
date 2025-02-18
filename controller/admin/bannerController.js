const Banner = require("../../models/bannerSchema")
const path = require("path")
const fs = require("fs")


const getBannerPage = async (req, res)=>{
    try {

        const findBanner = await Banner.find({})
        res.render("banner",{
            data:findBanner
        })
        
    } catch (error) {
        console.log("error found in getBannerPage",error)
        res.redirect("pageerror")
    }
}



const getAddBannerPage = async(req, res) => {
    try {

        res.render('addBanner')
        
    } catch (error) {

        console.log("error in getAddBannerPage",error)
        res.redirect("pageerror")
        
    }
}


const postAddBanner = async(req, res)=>{
    try {

        const data = req.body;
        const image = req.file;
        const newBanner = new Banner({
            image: image.filename,
            title:data.title,
            description: data.description,
            startDate : new Date(data.startDate+"T00:00:00"),
            endDate:  new Date(data.endDate+"T00:00:00"),
            link:data.link
        })

        await newBanner.save().then((data)=>console.log(data));
        res.redirect("/admin/banner")
        
    } catch (error) {
        res.redirect("pageerror")
        console.error('error found in postAddBanner', error)
    }

}


const deleteBanner = async (req, res) => {
    try {
        const id = req.query.id;
        const result = await Banner.deleteOne({ _id: id });
        
        // Send response back to client
        res.status(200).json({
            success: true,
            message: 'Banner deleted successfully',
            data: result
        });

    } catch (error) {
        console.error('Error found in delete banner:', error);
        res.status(500).redirect('/pageerror');
        // Or you could send JSON response instead:
        // res.status(500).json({
        //     success: false,
        //     message: 'Failed to delete banner',
        //     error: error.message
        // });
    }
};


module.exports = {
    getBannerPage,
    getAddBannerPage,
    postAddBanner,
    deleteBanner
}