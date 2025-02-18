const Coupon = require('../../models/couponSchema');
const mongoose = require("mongoose")


const loadCoupon = async (req, res)=>{
    try {

        const findCoupons = await Coupon.find({})
        
        return res.render("coupon",{coupons: findCoupons})



    } catch (error) {
        res.redirect("/pageerror")
        
    }
}


const createCoupon = async (req, res) =>{
    try {

        const data = {
            couponName : req.body.couponName,
            startDate: new Date(req.body.startDate + "T00:00:00"),
            endDate: new Date(req.body.endDate + "T00:00:00"),
            offerPrice: parseInt(req.body.offerPrice),
            minimumPrice: parseInt(req.body.minimumPrice),

        }

        const newCoupon = new Coupon ({
            name: data.couponName,
            createdOn: data.startDate,
            expireOn:data.endDate,
            offerPrice: data.offerPrice,
            minimumPrice: data.minimumPrice
        });
        await newCoupon.save()
        return res.redirect("/admin/coupon");
        
    } catch (error) {

        console.error("error found in add create coupon",error)
        res.redirect("/pageerror")
        
    }
}


const editCoupon = async (req, res)=>{
    try {

        const id = req.query.id;
        const findCoupon = await Coupon.findOne({_id:id});
        res.render('edit-coupon',{
            findCoupon: findCoupon,
        })
        
    } catch (error) {

        res.redirect('/pageerror')
        
    }
}

const updateCoupon = async (req, res)=>{
    try {

        couponId = req.body.couponId;
        const oid = new mongoose.Types.ObjectId(couponId)
        const selectCoupon = await Coupon.findOne({_id:oid})
        
        if(selectCoupon){
            const startDate = new Date(req.body.startDate)
            const endDate = new Date(req.body.endDate)
            const updateCoupon = await Coupon.updateOne(
                {_id:oid},
                {$set:{
                    name:req.body.name,
                    createdOn: startDate,
                    expireOn: endDate,
                    offerPrice: parseInt(req.body.offerPrice),
                    minimumPrice: parseInt(req.body.minimumPrice)
                },
            },{new: true}
            );


            if (updateCoupon!=null){
                res.send("Coupon Updated successfully")
            }else {
                res.status(500).send("Coupon update failed")
            }

        }

    } catch (error) {

        console.error("error found in update coupon",error)
        res.redirect("/pageerror")
        
    }
}


const deleteCoupon = async (req, res)=>{
    try {

        const id = req.query.id;
        await Coupon.deleteOne({_id:id})
        res.status(200).send({success: true, message: "Coupon deleted successfully"})
        
    } catch (error) {

        console.error("error found in deleteCoupon",error)
        res.redirect("pageerror")
        
    }
}


module.exports = {
    loadCoupon,
    createCoupon,
    editCoupon,
    updateCoupon,
    deleteCoupon
}