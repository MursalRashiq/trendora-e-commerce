const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const mongodb = require("mongodb");
const mongoose = require('mongoose')
const env = require("dotenv").config();
const crypto = require("crypto");
const { v4: uuidv4 } = require('uuid');


const getOrderListPageAdmin = async (req, res) => {
    try {
      const orders = await Order.find({}).sort({ createdOn: -1 }) 
      .populate("orderItems.product")
      .populate("address")
      .populate("user");

      //console.log(orders.paymentMethod,"-=-=-=-=-=-=-=-=-=------------------------");

      let itemsPerPage = 3;
      let currentPage = parseInt(req.query.page) || 1;
      let startIndex = (currentPage - 1) * itemsPerPage;
      let endIndex = startIndex + itemsPerPage;
      let totalPages = Math.ceil(orders.length / 3);
      const currentOrder = orders.slice(startIndex, endIndex).map(order => ({
        ...order.toObject(), // Convert Mongoose object to plain object
        orderId: order._id // Use MongoDB's `_id`
    }));

    //  console.log("currentOrder",currentOrder)
  
      res.render("order-list", { orders: currentOrder, totalPages, currentPage });
    } catch (error) {
      res.redirect("/pageerror");
    }
  };




  const getOrderDetailsPageAdmin = async (req, res) => {
    try {
        const orderId = req.query.id;
        //console.log(orderId, "req.query.id");

        // Validate orderId before querying
        if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
            throw new Error("Invalid order ID");
        }

      
           
            const findOrder = await Order.findOne({ _id: orderId })
            .populate("orderItems.product")
            .populate("address")
            .populate("user")

            console.log("user0000000000000000000000000000000000000000000000000000",findOrder.user)

        if (!findOrder) {
            throw new Error("Order not found");
        }

        // Debugging logs
        console.log("🛒 Order Found:", findOrder);
        console.log("🏠 Order Address:", findOrder.address);

        // Calculate total grant amount
        let totalGrant = 0;
        if (findOrder.orderItems) {
            findOrder.orderItems.forEach((item) => {
                totalGrant += (item.product?.price || 0) * (item.quantity || 1);
            });
        }

        const totalPrice = findOrder.totalPrice || 0;
        const discount = totalGrant - totalPrice;
        const finalAmount = totalPrice;

        
        // Ensure quantity is defined
        if (findOrder.orderItems && findOrder.orderItems.length > 0) {
            findOrder.orderItems.forEach((product) => {
                product.quantity = product.quantity || 1;
            });
        }

        res.render("order-details", {
            orders: findOrder,
            orderId: orderId,
            finalAmount: finalAmount,
            discount: discount,
        });
    } catch (error) {
        console.error(error);
        res.redirect("/pageerror");
    }
};



const changeOrderStatus = async (req, res) => {
    try {
      const orderId = req.query.orderId;
      const userId = req.query.userId;
      const status = req.query.status;
      
      await Order.updateOne({ _id: orderId }, { status }).then((data) => console.log(data));
  
      const findOrder = await Order.findOne({ _id: orderId });
  
      if (findOrder.status.trim() === "Returned" && 
          ["razorpay", "wallet", "cod"].includes(findOrder.payment)) {
        const findUser = await User.findOne({ _id: userId });
        if (findUser && findUser.wallet !== undefined) {
          findUser.wallet += findOrder.totalPrice;
          await findUser.save();
        } else {
          console.log("User not found or wallet is undefined");
        }
        
        await Order.updateOne({ _id: orderId }, { status: "Returned" });
        for (const productData of findOrder.product) {
          const productId = productData._id;
          const quantity = productData.quantity;
          const product = await Product.findById(productId);
          if (product) {
            product.quantity += quantity;
            await product.save();
          } else {
            console.log("Product not found");
          }
        }
      }
      
      return res.redirect("/order-list");
    } catch (error) {
      console.error(error);
      return res.redirect("/pageerror");
    }
  };

  
  


  module.exports = {
    getOrderListPageAdmin,
    getOrderDetailsPageAdmin,
    changeOrderStatus
  }