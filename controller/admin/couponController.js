const expressAsyncHandler = require("express-async-handler");
const Coupon = require("../../models/couponSchema");
const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");

const loadCoupon = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const totalCoupons = await Coupon.countDocuments({});
    const totalPages = Math.ceil(totalCoupons / limit);

    const coupons = await Coupon.find({})
      .skip(skip)
      .limit(limit)
      .sort({ createdOn: -1 });

    return res.render("coupon", {
      coupons,
      currentPage: page,
      totalPages,
      totalCoupons,
      message: null,
      errorMessage: null,
    });
  } catch (error) {
    console.error("Error in loadCoupon:", error);
    res.status(500).send("Internal Server Error");
  }
});

const createCoupon = asyncHandler(async (req, res) => {
  const data = {
    couponName: req.body.couponName,
    startDate: new Date(req.body.startDate + "T00:00:00"),
    endDate: new Date(req.body.endDate + "T00:00:00"),
    offerPrice: parseInt(req.body.offerPrice),
    minimumPrice: parseInt(req.body.minimumPrice),
    maximumPrice: parseInt(req.body.maximumPrice),
  };
  // checking the coupon name already exist
  const existingCoupon = await Coupon.findOne({
    name: { $regex: `^${data.couponName}$`, $options: "i" },
  });

  if (existingCoupon) {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const coupons = await Coupon.find().skip(skip).limit(limit);
    const totalCoupons = await Coupon.countDocuments();
    const totalPages = Math.ceil(totalCoupons / limit);

    return res.redirect(
      `/admin/coupon?message=Coupon name already exists&messageType=error`
    );
  }

  const newCoupon = new Coupon({
    name: data.couponName,
    createdOn: data.startDate,
    expireOn: data.endDate,
    offerPrice: data.offerPrice,
    minimumPrice: data.minimumPrice,
    maximumPrice: data.maximumPrice,
  });
  await newCoupon.save();
  return res.redirect(
    `/admin/coupon?message=Coupon created successfully&messageType=success`
  );
});

const editCoupon = async (req, res) => {
  try {
    const id = req.query.id;
    const findCoupon = await Coupon.findOne({ _id: id });
    res.render("edit-coupon", {
      findCoupon: findCoupon,
    });
  } catch (error) {
    res.redirect("/pageerror");
  }
};

const updateCoupon = asyncHandler(async (req, res) => {
  console.log(req.body);
  couponId = req.body.couponId;
  const oid = new mongoose.Types.ObjectId(couponId);
  const selectCoupon = await Coupon.findOne({ _id: oid });

  if (selectCoupon) {
    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);
    const updateCoupon = await Coupon.updateOne(
      { _id: oid },
      {
        $set: {
          name: req.body.name,
          createdOn: startDate,
          expireOn: endDate,
          offerPrice: parseInt(req.body.offerPrice),
          minimumPrice: parseInt(req.body.minimumPrice),
          maximumPrice: parseInt(req.body.maximumPrice),
        },
      },
      { new: true }
    );

    if (updateCoupon != null) {
      res.send("Coupon Updated successfully");
    } else {
      res.status(500).send("Coupon update failed");
    }
  }
});

const deleteCoupon = asyncHandler(async (req, res) => {
  const id = req.query.id;
  await Coupon.deleteOne({ _id: id });
  res
    .status(200)
    .send({ success: true, message: "Coupon deleted successfully" });
});

const couponStatusUpdate = asyncHandler(async (req, res) => {
  const { id, isList } = req.body;
  await Coupon.updateOne({ _id: id }, { isList });
  res.status(200).json({ message: "Updated successfully" });
});

module.exports = {
  loadCoupon,
  createCoupon,
  editCoupon,
  updateCoupon,
  deleteCoupon,
  couponStatusUpdate,
};
