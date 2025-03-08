const User = require("../../models/userSchema")
const asyncHandler = require('express-async-handler');





const customerInfo = asyncHandler(async (req, res) =>{
    
        
        let search=""
        if(req.query.search){
            search = req.query.search
        }
        let page = 1
        if (req.query.page){
            page = req.query.page
        }
        const limit = 3
        const data = await User.find({
            isAdmin: false,
            $or:[
                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}}
            ],
        })
        .limit(limit*1)
        .skip((page-1)*limit)
        .exec()

        const count =  await User.find({
            isAdmin: false,
            $or:[
                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}}
            ],

        }).countDocuments()

        res.render('customers', { data, currentPage: page, totalPages: Math.ceil(count / limit), search });

})

const customerBlocked = asyncHandler(async (req, res)=>{
   
        
        let id=req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect("/admin/users")

})


const customerunBlocked = asyncHandler(async(req, res)=>{
    
        
        let id = req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked: false}})
        res.redirect("/admin/users")

})



module.exports = {
    customerInfo,
    customerBlocked,
    customerunBlocked
}