const User = require("../models/userSchema")



const userAuth = async (req, res, next) => {
if(req.session.user){
    User.findById(req.session.user)
    
    .then(data=>{
        if(data&& !data.isBlocked){
            next();
        }else{
            res.redirect("/")
        }
    }).catch(error=>{
        console.log("Error in user auth middleware");
        res.status(500).send("Internal server error")
    })
}else{
    res.redirect
    ("/login")
}
}




const alreadyLoggedIn = (req, res, next) => {
    if (req.session.user) {
      return res.redirect('/'); // Redirect logged-in users to the home page or dashboard
    }
    next();
  };
  


const adminAuth=(req,res,next)=>{
    User.findOne({isAdmin:true})
        .then(data=>{
            if(data&&req.session.admin){
                next()
            }else{
                res.redirect("/admin/login")
            }
        })
        .catch(error=>{
            console.log("error in user adminauth middleware");
            res.status(500).send("internal server error")
            
        })
    }

module.exports={
    userAuth,
    adminAuth,
    alreadyLoggedIn

}