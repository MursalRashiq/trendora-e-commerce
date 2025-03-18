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
  const { page = 1, search, status, payment, startDate, endDate } = req.query;

  const itemsPerPage = 3;
  const currentPage = parseInt(page) || 1;
  const skip = (currentPage - 1) * itemsPerPage;

  const filter = {};

  if (search && search !== "undefined") {
    filter.$or = [{ orderId: { $regex: search, $options: "i" } }];
  }

  if (status && status !== "undefined") {
    filter.status = status;
  }

  if (payment && payment !== "undefined") {
    filter.payment = payment;
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate && startDate !== "undefined") {
      filter.createdAt.$gte = new Date(startDate);
    }
    if (endDate && endDate !== "undefined") {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  try {
    const ordersQuery = Order.find(filter)
      .populate("user", "name")
      .populate("orderItems.product")
      .populate("address")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(itemsPerPage)
      .lean();

    const countQuery = Order.countDocuments(filter);

    const [orders, totalOrders] = await Promise.all([ordersQuery, countQuery]);

    let filteredOrders = orders;
    if (search && search !== "undefined") {
      filteredOrders = orders.filter(
        (order) =>
          order.orderId.toLowerCase().includes(search.toLowerCase()) ||
          (order.user &&
            order.user.name &&
            order.user.name.toLowerCase().includes(search.toLowerCase()))
      );
    }

    const totalPages = Math.ceil(totalOrders / itemsPerPage);

    const currentOrder = filteredOrders.map((order) => ({
      ...order,
      orderId: order.orderId,
    }));

    res.render("order-list", {
      orders: currentOrder,
      totalPages: totalPages > 0 ? totalPages : 1,
      currentPage,
      search: search || "",
      status: status || "",
      payment: payment || "",
      startDate: startDate || "",
      endDate: endDate || "",
      ordersFilter: filteredOrders,
    });
  } catch (error) {
    console.error("Error fetching order list:", error);
    res.status(500).render("order-list", {
      orders: [],
      totalPages: 1,
      currentPage: 1,
      search: search || "",
      status: status || "",
      payment: payment || "",
      startDate: startDate || "",
      endDate: endDate || "",
      error: "Failed to load orders",
    });
  }
});

const getOrderDetailsPageAdmin = asyncHandler(async (req, res) => {
  const orderId = req.query.id;

  if (!orderId || typeof orderId !== "string" || orderId.length < 36) {
    throw new Error("Invalid order ID");
  }

  const findOrder = await Order.findOne({ orderId })
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

  const productDetails = findOrder.orderItems.map((item) => item.product);
  const totalPrice = findOrder.totalPrice || 0;
  const discount = findOrder.couponDiscount;
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
    productDetails: productDetails,
  });
});

const changeItemStatus = asyncHandler(async (req, res) => {
  try {
    const { orderId, itemIndex, status } = req.body;

    // console.log(
    //   "Changing item status for orderId",
    //   orderId,
    //   "index",
    //   itemIndex,
    //   "to",
    //   status
    // );

    if (!orderId || itemIndex === undefined || !status) {
      return res.status(400).json({
        status: false,
        message: "orderId, itemIndex, and status are required",
      });
    }

    const order = await Order.findOne({ orderId: orderId });

    if (!order) {
      return res
        .status(404)
        .json({ status: false, message: "Order not found" });
    }

    if (order.orderItems && order.orderItems[itemIndex]) {
      order.orderItems[itemIndex].status = status;

      if (status === "delivered") {
        order.orderItems[itemIndex].deliveredAt = new Date();
      }

      await order.save();

      const allItemsHaveSameStatus = order.orderItems.every(
        (item) => item.status === status
      );
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
    return res
      .status(500)
      .json({ status: false, message: "Server error", error: error.message });
  }
});

const changeOrderStatus = async (req, res) => {
  try {
    const orderId = req.body.orderId;
    let status = req.body.status;
    console.log(req.body);

    if (!orderId || !status) {
      return res
        .status(400)
        .json({ status: false, message: "orderId and status are required" });
    }

    console.log("Changing order status for orderId", orderId, "to", status);

    const validStatuses = [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
    ];

    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json({ status: false, message: `"${status}" is not a valid status.` });
    }

    let order;

    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId);
    } else {
      order = await Order.findOne({ orderId });
    }

    if (!order) {
      return res
        .status(404)
        .json({ status: false, message: "Order not found" });
    }

    let anyItemDelivered = false;
    const statusCounts = {};

    if (Array.isArray(order.orderItems)) {
      for (const item of order.orderItems) {
        if (item.status === "Cancelled") {
          continue;
        }
        item.status = status;
        if (status === "Delivered") {
          item.deliveredAt = new Date();
          anyItemDelivered = true;
        }
        statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
      }
    }

    if (anyItemDelivered) {
      order.status = "Delivered";
    } else {
      if (Object.keys(statusCounts).length > 0) {
        order.status = Object.keys(statusCounts).reduce((a, b) =>
          statusCounts[a] >= statusCounts[b] ? a : b
        );
      }
    }

    await order.save();

    return res.json({
      status: true,
      message: "Order status updated successfully",
      overallStatus: order.status,
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
  const { orderId, itemId } = req.query;

  console.log("Received orderId:", orderId);
  console.log("Received itemId:", itemId);

  if (!orderId || !itemId) {
    return res.status(400).json({
      status: false,
      message: "Order ID and Item ID are required",
    });
  }

  const findOrder = await Order.findById(orderId).populate("orderItems");
  if (!findOrder) {
    return res.status(404).json({ message: "Order not found" });
  }

  const orderItem = findOrder.orderItems.find(
    (item) => item._id.toString() === itemId
  );

  if (!orderItem) {
    return res.status(404).json({ message: "Order item not found" });
  }

  const productId = orderItem.product;
  if (!productId) {
    return res
      .status(404)
      .json({ message: "Product ID not found for this item" });
  }

  console.log("Extracted productId:", productId);

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  await Product.updateOne(
    { _id: productId },
    { $inc: { quantity: orderItem.quantity } }
  );

  await Order.updateOne(
    { _id: orderId, "orderItems._id": itemId },
    { $set: { "orderItems.$.status": "Returned" } }
  );

  const userId = findOrder.user;
  const returnMoney = orderItem.price * orderItem.quantity;

  console.log("order", findOrder);
  console.log(returnMoney, "hello");

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

  findOrder.finalAmound -= returnMoney;
  if (findOrder.finalAmound < 0) findOrder.finalAmound = 0;
  await findOrder.save();

  const updatedOrder = await Order.findById(orderId);

  const allItemsReturned = updatedOrder.orderItems.every(
    (item) => item.status === "Returned"
  );

  const newStatus = allItemsReturned ? "Returned" : "Partially Returned";

  await Order.updateOne({ _id: orderId }, { $set: { status: newStatus } });

  const paymentStatusUpdate = updatedOrder.orderItems.every(
    (item) => item.status === "Returned"
  );

  if (paymentStatusUpdate) {
    await Order.updateOne(
      { _id: updatedOrder._id },
      { $set: { paymentStatus: "Refunded" } }
    );
  } else {
    await Order.updateOne(
      { _id: updatedOrder._id },
      { $set: { paymentStatus: "Partial Refunded" } }
    );
  }

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

const rejectReturnRequest = asyncHandler(async (req, res) => {
  const { orderId, itemIndex } = req.body;
  const index = parseInt(itemIndex, 10);

  if (!orderId || isNaN(index)) {
    return res.status(400).json({ message: "Invalid orderId or itemIndex" });
  }

  const findOrder = await Order.findOne({ _id: orderId }).populate("orderItems")

  if (!findOrder) {
    return res.status(404).json({ message: "Order not found" });
  }

  // Check if the specific item has a return request
  if (
    !findOrder.orderItems[index] ||
    findOrder.orderItems[index].status !== "Return Request"
  ) {
    return res
      .status(400)
      .json({ message: "No return request to reject for this item" });
  }

  const updateField = `orderItems.${index}.status`;
  await Order.updateOne(
    { _id: orderId },
    { $set: { [updateField]: "Return Rejected" } }
  );

  const updatedOrder = await Order.findOne({ _id: orderId });
  const pendingReturnRequests = updatedOrder.orderItems.some(
    (item) => item.status === "Return Request"
  );

  if (!pendingReturnRequests) {
    const hasReturnedItems = updatedOrder.orderItems.some(
      (item) => item.status === "Returned"
    );

    let newOrderStatus = "Return Rejected";
    if (hasReturnedItems) {
      const hasRejectedItems = updatedOrder.orderItems.some(
        (item) => item.status === "Return Rejected"
      );
    }
  }

  

  const result = await Order.updateOne(
    { orderId: findOrder.orderId },
    { $set: { paymentStatus: "Paid" } }
  );
  console.log(result);
  

  
  res
    .status(200)
    .json({ status: true, message: "Return request rejected successfully" });
});

module.exports = {
  getOrderListPageAdmin,
  getOrderDetailsPageAdmin,
  changeOrderStatus,
  approveReturn,
  rejectReturnRequest,
  changeItemStatus,
};
