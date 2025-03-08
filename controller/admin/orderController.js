const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const mongodb = require("mongodb");
const mongoose = require("mongoose");
const env = require("dotenv").config();
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const asyncHandler = require("express-async-handler");

const getOrderListPageAdmin = asyncHandler(async (req, res) => {

    const { payment, status} = req.query

    console.log(payment, status)

    const filter = {};
    if (payment && payment !== "undefined") filter.payment = new RegExp(`^${payment}$`, "i");
    if (status && status !== "undefined") filter.status = new RegExp(`^${status}$`, "i");
    

        const ordersFilter = await Order.find(filter);

        console.log(ordersFilter)
        console.log(filter)
      

  const orders = await Order.find({})
    .sort({ createdOn: -1 })
    .populate("orderItems.product")
    .populate("address")
    .populate("user");
    

  let itemsPerPage = 3;
  let currentPage = parseInt(req.query.page) || 1;
  let startIndex = (currentPage - 1) * itemsPerPage;
  let endIndex = startIndex + itemsPerPage;
  let totalPages = Math.ceil(orders.length / 3);
  const currentOrder = orders.slice(startIndex, endIndex).map((order) => ({
    ...order.toObject(), 
    orderId: order._id, 
  }));

  res.render("order-list", { orders: currentOrder, totalPages, currentPage, ordersFilter });
});

const getOrderDetailsPageAdmin = asyncHandler(async (req, res) => {
  const orderId = req.query.id;

  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    throw new Error("Invalid order ID");
  }

  const findOrder = await Order.findOne({ _id: orderId })
    .populate("orderItems.product") 
    .populate("user");


  if (!findOrder) {
    throw new Error("Order not found");
  }

  let totalGrant = 0;
  if (findOrder.orderItems) {
    findOrder.orderItems.forEach((item) => {
      totalGrant += (item.product?.price || 0) * (item.quantity || 1);
    });
  }

  const productDetails = findOrder.orderItems.map(item => item.product);



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
    productDetails: productDetails
  });
});


const changeItemStatus = asyncHandler(async(req, res) => {
  try {
    const { orderId, itemIndex, status } = req.body;
  
    console.log("Changing item status for orderId", orderId, "index", itemIndex, "to", status);
  
    if (!orderId || itemIndex === undefined || !status) {
      return res
        .status(400)
        .json({ status: false, message: "orderId, itemIndex, and status are required" });
    }
  
    // Find the order
    const order = await Order.findOne({ orderId: orderId });
    
    if (!order) {
      return res
        .status(404)
        .json({ status: false, message: "Order not found" });
    }
  
    // Update the specific item's status
    if (order.orderItems && order.orderItems[itemIndex]) {
      order.orderItems[itemIndex].status = status;
      
      // If the item is marked as delivered, add timestamp
      if (status === "delivered") {
        order.orderItems[itemIndex].deliveredAt = new Date();
      }
      
      await order.save();
      
      // Check if all items have the same status to update the overall order status
      const allItemsHaveSameStatus = order.orderItems.every(item => item.status === status);
      if (allItemsHaveSameStatus) {
        order.status = status;
        await order.save();
      }
      
      return res.json({
        status: true,
        message: "Item status updated successfully",
      });
    } else {
      return res
        .status(404)
        .json({ status: false, message: "Item not found in order" });
    }
  } catch (error) {
    console.error("Error in changeItemStatus:", error);
    return res.status(500).json({ status: false, message: "Server error", error: error.message });
  }
});

const changeOrderStatus = async (req, res) => {
  try {
    const orderId = req.method === "GET" ? req.query.orderId : req.body.orderId;
    let status = req.method === "GET" ? req.query.status : req.body.status;

    if (!orderId || !status) {
      return res.status(400).json({ status: false, message: "orderId and status are required" });
    }

    console.log("Changing order status for orderId", orderId, "to", status);


    const validStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ status: false, message: `"${status}" is not a valid status.` });
    }

    let order;

    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId);
    } else {
      order = await Order.findOne({ orderId });
    }

    if (!order) {
      return res.status(404).json({ status: false, message: "Order not found" });
    }

    order.status = status;

    if (Array.isArray(order.orderItems)) {
      order.orderItems.forEach(item => {
        item.status = status;
        if (status === "Delivered") {
          item.deliveredAt = new Date();
        }
      });
    }

    await order.save();

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



const approveReturn = asyncHandler(async (req, res) => {
  const { orderId, itemId } = req.query; // ✅ Get orderId and itemId

  console.log("Received orderId:", orderId);
  console.log("Received itemId:", itemId);

  if (!orderId || !itemId) {
    return res.status(400).json({
      status: false,
      message: "Order ID and Item ID are required",
    });
  }

  // Find the order in the database
  const findOrder = await Order.findById(orderId);
  if (!findOrder) {
    return res.status(404).json({ message: "Order not found" });
  }

  // Find the specific item in the order
  const orderItem = findOrder.orderItems.find(
    (item) => item._id.toString() === itemId
  );

  if (!orderItem) {
    return res.status(404).json({ message: "Order item not found" });
  }

  // ✅ Extract the productId from the order item
  const productId = orderItem.product;
  if (!productId) {
    return res.status(404).json({ message: "Product ID not found for this item" });
  }

  console.log("Extracted productId:", productId); // Debugging log

  // Find the corresponding product
  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  // Increment product stock back
  await Product.updateOne(
    { _id: productId },
    { $inc: { quantity: orderItem.quantity } }
  );

  // Update only the specific order item status
  await Order.updateOne(
    { _id: orderId, "orderItems._id": itemId },
    { $set: { "orderItems.$.status": "Returned" } }
  );

  // Refund process
  const userId = findOrder.user;
  const returnMoney = orderItem.price * orderItem.quantity; // Refund only this item's amount

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

  return res.status(200).json({
    status: true,
    message: "Return request approved successfully for the item",
    data: {
      orderId: findOrder._id,
      itemId: orderItem._id,
      productId: productId,
      status: "Returned",
    },
  });
});



const rejectReturnRequest = asyncHandler(async(req, res)=>{

  const { orderId } = req.body;
    const findOrder = await Order.findOne({ _id: orderId });

    if (!findOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (findOrder.status !== "Return Request") {
      return res.status(400).json({ message: "No return request to reject" });
    }

    await Order.updateOne({ _id: orderId }, { status: "Return Rejected" });
    res.status(200).json({ message: "Return request rejected successfully" });

})
module.exports = {
  getOrderListPageAdmin,
  getOrderDetailsPageAdmin,
  changeOrderStatus,
  approveReturn,
  rejectReturnRequest,
  changeItemStatus
};
