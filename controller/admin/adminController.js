const express = require("express")
const User = require("../../models/userSchema")
const bcrypt = require('bcrypt')
const { session } = require("passport")
const { pageNotFound } = require("../user/userController")
const Category = require("../../models/categorySchema")
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')
const asyncHandler = require("express-async-handler");



const loadLogin = asyncHandler(async (req, res) => {
    if (req.session.admin) {
        // Debug log to check session
        console.log("Admin session exists:", req.session.admin);

        // Fetch counts with error handling
        const totalUsers = await User.countDocuments({ isAdmin: false }) || 0;
        const totalOrders = await Order.countDocuments() || 0;
        const totalProducts = await Product.countDocuments() || 0;

        // Debug log for counts
        console.log("Initial counts:", { totalUsers, totalOrders, totalProducts });

        // Calculate revenue
        const deliveredOrders = await Order.find({ status: 'delivered' });
        console.log("Delivered orders found:", deliveredOrders.length);

        const totalRevenue = deliveredOrders.reduce((sum, order) => {
            const amount = order.finalAmount || 0;  // Corrected 'finalAmound' to 'finalAmount'
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

        // Render the dashboard with the fetched data
        return res.render("dashboard", dashboardData);
    }

    // If no admin session, render login page with no message
    return res.render("admin-login", { message: null });
});



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



const loadDashboard = asyncHandler(async (req, res) => {
    if (req.session.admin) {
        // Fetch counts with error checking
        const totalUsers = await User.countDocuments({ isAdmin: false }) || 0;
        const totalOrders = await Order.countDocuments() || 0;
        const totalProducts = await Product.countDocuments() || 0;

        const deliveredOrders = await Order.find({ status: 'delivered' });
        const totalRevenue = deliveredOrders.reduce((sum, order) => 
            sum + (order.finalAmount || 0), 0);  

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
});


const pageerror = async (req, res)=>{
    res.render("admin-error")
}


const logout = asyncHandler(async (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log("Session destruction error:", err.message);
            return res.status(500).redirect("/pageerror");
        }
        
        return res.redirect("/admin/login");
    });
});




module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
}
