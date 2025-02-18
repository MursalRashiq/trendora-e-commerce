const express = require("express")
const User = require("../../models/userSchema")
const bcrypt = require('bcrypt')
const { session } = require("passport")
const { pageNotFound } = require("../user/userController")
const Category = require("../../models/categorySchema")
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')




const loadLogin = async (req, res) => {
    try {
        if (req.session.admin) {
            // Debug log to check session
            console.log("Admin session exists:", req.session.admin);

            try {
                // Fetch counts with 
                const totalUsers = await User.countDocuments({ isAdmin: false }) || 0;
                const totalOrders = await Order.countDocuments() || 0;
                const totalProducts = await Product.countDocuments() || 0;

                // Debug log for counts
                console.log("Initial counts:", { totalUsers, totalOrders, totalProducts });

                // Calculate revenue
                const deliveredOrders = await Order.find({ status: 'delivered' });
                console.log("Delivered orders found:", deliveredOrders.length);

                const totalRevenue = deliveredOrders.reduce((sum, order) => {
                    const amount = order.finalAmound || 0;
                    console.log("Order amount:", amount);
                    return sum + amount;
                }, 0);

                // Final debug log
                const dashboardData = {
                    totalUsers,
                    totalOrders,
                    totalProducts,
                    totalRevenue
                };
                console.log("Final Dashboard Data:", dashboardData);

                return res.render("dashboard", dashboardData);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
                
                return res.render("dashboard", {
                    totalUsers: 0,
                    totalOrders: 0,
                    totalProducts: 0,
                    totalRevenue: 0
                });
            }
        }
        
        return res.render("admin-login", { message: null });
        
    } catch (error) {
        console.error("Error in loadLogin:", error);
        return res.redirect("/admin/error");
    }
};


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
                req.session.admin = true; 
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



const loadDashboard = async (req, res) => {
    try {
        if (req.session.admin) {
            // Fetch counts with error checking
            const totalUsers = await User.countDocuments({ isAdmin: false }) || 0;
            const totalOrders = await Order.countDocuments() || 0;
            const totalProducts = await Product.countDocuments() || 0;

            // Calculate revenue
            const deliveredOrders = await Order.find({ status: 'delivered' });
            const totalRevenue = deliveredOrders.reduce((sum, order) => 
                sum + (order.finalAmound || 0), 0);

            console.log("Dashboard Data in loadDashboard:", {
                totalUsers,
                totalOrders,
                totalProducts,
                totalRevenue
            });

            return res.render("dashboard", {
                totalUsers,
                totalOrders,
                totalProducts,
                totalRevenue
            });
        }
        res.redirect("/admin/login");
    } catch (error) {
        console.error("Error in loadDashboard:", error);
        res.redirect("/admin/error");
    }
};


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
