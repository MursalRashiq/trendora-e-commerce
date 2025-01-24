const express = require("express")
const User = require("../../models/userSchema")
const bcrypt = require('bcrypt')
const { session } = require("passport")
const { pageNotFound } = require("../user/userController")
const Category = require("../../models/categorySchema")



const loadLogin = async (req, res) =>{
    if(req.session.admin){
        return res.render("dashboard")
    }

    res.render("admin-login",{message: null})
}


const login = async (req, res) => {
    try {
        const {  email, password } = req.body;

        // Finding admin from the database
        const admin = await User.findOne({ email, isAdmin: true });

        //console.log("find Admin", admin)
        if (admin) {
            // Compare passwords
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                req.session.admin = true; // Set admin session
                return res.redirect("/admin");
            } else {
                console.log("Incorrect password");
                req.flash('error', 'incorrect password')
                return res.redirect("/admin/login"); // Redirect back to login page
            }
        } else {
            console.log("Admin not found");
            req.flash('error', 'Admin not found')
            return res.redirect("/admin/login"); // Render login view with an error
        }
    } catch (error) {
        console.error("Login error:", error);
        req.flash("error", "something went wron please try again")
        return res.redirect("/admin/login"); // Redirect to an error page
    }
};



const loadDashboard = async (req, res)=>{
   
    if(req.session.admin){
        try {
            res.render("dashboard")
        } catch (error) {
            res.redirect("/", pageNotFound)
        }
    }
}


const pageerror = async (req, res)=>{
    res.render("admin-error")
}


const logout = async (req, res) =>{
    try {
        
        req.session.destroy((err)=>{
            if(err){
                console.log("session destructure error", err.message)
                res.redirect("/pageerror")
            }
            return res.redirect("/admin/login")
        })

    } catch (error) {
        console.log("somethng went wrong", error)
        res.status(500).redirect("/pageerror")
    }
}





module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
}
