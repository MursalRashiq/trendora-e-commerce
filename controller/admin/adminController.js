const express = require("express");
const User = require("../../models/userSchema");
const bcrypt = require("bcrypt");
const { session } = require("passport");
const { pageNotFound } = require("../user/userController");
const Category = require("../../models/categorySchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const asyncHandler = require("express-async-handler");

const loadLogin = asyncHandler(async (req, res) => {
  if (req.session.admin) {
    console.log("Admin session exists:", req.session.admin);

    const totalUsers = (await User.countDocuments({ isAdmin: false })) || 0;
    const totalOrders = (await Order.countDocuments()) || 0;
    const totalProducts = (await Product.countDocuments()) || 0;

    const deliveredOrders = await Order.find({ status: "Delivered" });
    console.log("delveredOrders",deliveredOrders)

    const totalRevenue = deliveredOrders.reduce((sum, order) => {
      const amount = order.finalAmount || 0;
      console.log("Order amount:", amount);
      return sum + amount;
    }, 0);
    console.log(totalRevenue);

    const dashboardData = {
      totalUsers,
      totalOrders,
      totalProducts,
      totalRevenue,
    };
    console.log("Final Dashboard Data:", dashboardData);

    return res.render("dashboard", dashboardData);
  }

  return res.render("admin-login", { message: null });
});

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await User.findOne({ email, isAdmin: true });

    if (admin) {
      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = true;
        return res.redirect("/admin");
      } else {
        console.log("Incorrect password");
        req.flash("error", "incorrect password");
        return res.redirect("/admin/login");
      }
    } else {
      console.log("Admin not found");
      req.flash("error", "Admin not found");
      return res.redirect("/admin/login");
    }
  } catch (error) {
    console.error("Login error:", error);
    req.flash("error", "something went wron please try again");
    return res.redirect("/admin/login");
  }
};


const loadDashboard = asyncHandler(async (req, res) => {
  if (req.session.admin) {
    const totalUsers = (await User.countDocuments({ isAdmin: false })) || 0;
    const totalOrders = (await Order.countDocuments()) || 0;
    const totalProducts = (await Product.countDocuments()) || 0;

    const deliveredOrders = await Order.find({ status: "Delivered" });
    const totalRevenue = deliveredOrders.reduce(
      (sum, order) => sum + (order.finalAmound || 0),
      0
    );

    // Top 5 Selling Products 
    const topProducts = await Order.aggregate([
      { $match: { status: { $ne: 'Cancelled' } } },
      { $unwind: '$orderItems' },
      { $match: { 'orderItems.status': { $in: ['Shipped', 'Delivered'] } } },
      {
        $group: {
          _id: '$orderItems.product',
          count: { $sum: '$orderItems.quantity' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: '$productInfo' },
      {
        $project: {
          _id: 0,
          name: '$productInfo.productName',
          count: 1,
          image: { $arrayElemAt: ['$productInfo.productImage', 0] } 
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Top 5 Selling Brands 
    const topBrands = await Order.aggregate([
      { $match: { status: { $ne: 'Cancelled' } } },
      { $unwind: '$orderItems' },
      { $match: { 'orderItems.status': { $in: ['Shipped', 'Delivered'] } } },
      {
        $lookup: {
          from: 'products',
          localField: 'orderItems.product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: '$productInfo' },
      {
        $group: {
          _id: '$productInfo.brand',
          count: { $sum: '$orderItems.quantity' }
        }
      },
      {
        $project: {
          _id: 0,
          name: '$_id',
          count: 1
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Top 5 Selling Categories
    const topCategories = await Order.aggregate([
      { $match: { status: { $ne: 'Cancelled' } } },
      { $unwind: '$orderItems' },
      { $match: { 'orderItems.status': { $in: ['Shipped', 'Delivered'] } } },
      {
        $lookup: {
          from: 'products',
          localField: 'orderItems.product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: '$productInfo' },
      {
        $lookup: {
          from: 'categories',
          localField: 'productInfo.category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      { $unwind: '$categoryInfo' },
      {
        $group: {
          _id: '$productInfo.category',
          count: { $sum: '$orderItems.quantity' },
          name: { $first: '$categoryInfo.name' }
        }
      },
      {
        $project: {
          _id: 0,
          name: 1,
          count: 1
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    console.log("Top Selling Products:", topProducts);
    console.log("Top Selling Brands:", topBrands);
    console.log("Top Selling Categories:", topCategories);

    return res.render("dashboard", {
      totalUsers,
      totalOrders,
      totalProducts,
      totalRevenue,
      topProducts,
      topBrands,
      topCategories
    });
  }

  res.redirect("/admin/login");
})


const pageerror = async (req, res) => {
  res.render("admin-error");
};

const logout = asyncHandler(async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log("Session destruction error:", err.message);
      return res.status(500).redirect("/pageerror");
    }

    return res.redirect("/admin/login");
  });
});


const chartData = async (req, res) => {
  const filter = req.query.filter || "yearly";

  try {
    let matchStage = {};
    const currentDate = new Date();

    // Handle different filters
    if (filter === "yearly") {
      matchStage = {
        createdAt: {
          $gte: new Date(currentDate.getFullYear(), 0, 1),
          $lt: new Date(currentDate.getFullYear() + 1, 0, 1),
        },
      };
    } else if (filter === "monthly") {
      matchStage = {
        createdAt: {
          $gte: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
          $lt: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
        },
      };
    }

    const orders = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const labels = orders.map((o) => o._id);
    const values = orders.map((o) => o.count);

    res.json({ labels, values });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching data");
  }
};






module.exports = {
  loadLogin,
  login,
  loadDashboard,
  pageerror,
  logout,
  chartData
};
