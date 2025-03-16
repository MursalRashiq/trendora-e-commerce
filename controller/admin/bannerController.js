const Banner = require("../../models/bannerSchema");
const path = require("path");
const fs = require("fs");
const asyncHandler = require("express-async-handler");

const getBannerPage = asyncHandler(async (req, res) => {
  const findBanner = await Banner.find({});

  res.render("banner", {
    data: findBanner,
  });
});

const getAddBannerPage = asyncHandler(async (req, res) => {
  res.render("addBanner");
});

const postAddBanner = asyncHandler(async (req, res) => {
  const data = req.body;
  const image = req.file;
  const newBanner = new Banner({
    image: image.filename,
    title: data.title,
    description: data.description,
    startDate: new Date(data.startDate + "T00:00:00"),
    endDate: new Date(data.endDate + "T00:00:00"),
    link: data.link,
  });

  await newBanner.save().then((data) => console.log(data));
  res.redirect("/admin/banner");
});

const deleteBanner = asyncHandler(async (req, res) => {
  const id = req.query.id;
  const result = await Banner.deleteOne({ _id: id });

  res.status(200).json({
    success: true,
    message: "Banner deleted successfully",
    data: result,
  });
});

module.exports = {
  getBannerPage,
  getAddBannerPage,
  postAddBanner,
  deleteBanner,
};
