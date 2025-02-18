const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const mongodb = require("mongodb");
const mongoose = require("mongoose");
const env = require("dotenv").config();
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

const getOrderListPageAdmin = async (req, res) => {
  try {
    const orders = await Order.find({})
      .sort({ createdOn: -1 })
      .populate("orderItems.product")
      .populate("address")
      .populate("user");

    //console.log(orders.paymentMethod,"-=-=-=-=-=-=-=-=-=------------------------");

    let itemsPerPage = 3;
    let currentPage = parseInt(req.query.page) || 1;
    let startIndex = (currentPage - 1) * itemsPerPage;
    let endIndex = startIndex + itemsPerPage;
    let totalPages = Math.ceil(orders.length / 3);
    const currentOrder = orders.slice(startIndex, endIndex).map((order) => ({
      ...order.toObject(), // Convert Mongoose object to plain object
      orderId: order._id, // Use MongoDB's `_id`
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
      .populate("user");

    

    if (!findOrder) {
      throw new Error("Order not found");
    }

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

    if (!orderId || !status) {
      return res
        .status(400)
        .json({ status: false, message: "orderId and status are required" });
    }

    console.log(`Changing order status for orderId ${orderId} to ${status}`);

    await Order.updateOne({ orderId: orderId }, { status });
    const findOrder = await Order.findOne({ orderId: orderId });

    if (
      findOrder.status.trim() === "Returned" &&
      ["razorpay", "wallet", "cod"].includes(findOrder.payment)
    ) {
      const findUser = await User.findOne({ _id: userId });
      if (findUser && findUser.wallet !== undefined) {
        const refundAmount = findOrder.totalPrice || 0; // Ensure refundAmount is valid
        findUser.wallet += refundAmount;
        await findUser.save();
      } else {
        console.log("User not found or wallet is undefined");
      }

      await Order.updateOne({ orderId: orderId }, { status: "Returned" });

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

    return res.json({
      status: true,
      message: "Order status updated successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while updating order status",
    });
  }
};

const approveReturn = async (req, res) => {
  try {
    const { orderId } = req.query;

    const findOrder = await Order.findById(orderId);
    if (!findOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    const productIds = findOrder.orderItems.map((item) => item.product);
    const productDetails = await Product.find({ _id: { $in: productIds } });

    for (const item of productDetails) {
      const orderItem = findOrder.orderItems.find(
        (oi) => oi.product.toString() === item._id.toString()
      );

      if (orderItem) {
        await Product.updateOne(
          { _id: item._id },
          { $inc: { quantity: orderItem.quantity } }
        );
      }
    }

    const userId = findOrder.user;

    const returnMoney = findOrder.finalAmound;

    await User.updateOne(
      { _id: userId },
      {
        $inc: { wallet: returnMoney },
        $push: {
          walletHistory: {
            amount: returnMoney,
            type: "refund",
            timestamp: new Date(),
          },
        },
      }
    );
    

    if (!orderId) {
      return res.status(400).json({
        status: false,
        message: "Order ID is required",
      });
    }

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        status: false,
        message: "Order not found",
      });
    }

    // Validate current order status
    if (order.status !== "Return Request") {
      return res.status(400).json({
        status: false,
        message: "Order is not in Return Request status",
      });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        $set: {
          status: "Returned",
          returnApprovedAt: new Date(),
          returnApprovedBy: req.session.userId,
        },
      },
      { new: true }
    );

    return res.status(200).json({
      status: true,
      message: "Return request approved successfully",
      data: {
        orderId: updatedOrder._id,
        status: updatedOrder.status,
      },
    });
  } catch (error) {
    console.log("error found in return approval in admin", error);
  }
};

module.exports = {
  getOrderListPageAdmin,
  getOrderDetailsPageAdmin,
  changeOrderStatus,
  approveReturn,
};
