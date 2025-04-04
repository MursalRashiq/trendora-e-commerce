const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const Order = require("../../models/orderSchema");
const moment = require("moment-timezone");
const path = require("path");
const fs = require("fs");
const asyncHandler = require("express-async-handler");

const getSalesReport = asyncHandler(async (req, res) => {
  let { filter = "daily", startDate, endDate, page = 1 } = req.query;
  page = Number(page) || 1;
  let query = {};
  let now = new Date();

  if (filter === "daily") {
    const today = new Date();
    query.createdAt = {
      $gte: new Date(today.setHours(0, 0, 0, 0)),
      $lt: new Date(today.setHours(23, 59, 59, 999)),
    };
  } else if (filter === "weekly") {
    const current = new Date();
    let weekStart = new Date(
      current.setDate(current.getDate() - current.getDay())
    );
    weekStart.setHours(0, 0, 0, 0);
    let weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    query.createdAt = { $gte: weekStart, $lt: weekEnd };
  } else if (filter === "monthly") {
    query.createdAt = {
      $gte: new Date(now.getFullYear(), now.getMonth(), 1),
      $lt: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  } else if (filter === "yearly") {
    query.createdAt = {
      $gte: new Date(now.getFullYear(), 0, 1),
      $lt: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  } else if (filter === "custom" && startDate && endDate) {
    query.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const perPage = 10;

  const sampleOrder = await Order.findOne(query).select("user");
  if (sampleOrder) {
    console.log("Sample order user reference:", sampleOrder.user);
  }

  const orders = await Order.find(query)
    .populate({
      path: "user",
      model: "User",
      select: "name email",
    })
    .select(
      "orderId user totalPrice finalAmound couponDiscount createdAt address status payment discount"
    )
    .sort({ createdAt: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage);

  const totalOrders = await Order.countDocuments(query);
  const totalPages = Math.ceil(totalOrders / perPage);

  const processedOrders = orders.map((order) => {
    const orderObj = order.toObject ? order.toObject() : order;
    return {
      ...orderObj,
      paymentMethod: orderObj.payment || "Unknown",
      userName: orderObj.user?.name || orderObj.address?.name || "Unknown",
      userEmail: orderObj.user?.email || "Unknown",
    };
  });

  const totalSales = processedOrders.reduce(
    (acc, order) => acc + (order.totalPrice || 0),
    0
  );
  const totalFinalAmount = processedOrders.reduce(
    (acc, order) => acc + (order.finalAmound || 0),
    0
  );
  const totalDiscount = processedOrders.reduce(
    (acc, order) => acc + (order.discount || 0),
    0
  );
  const totalCouponDiscount = processedOrders.reduce(
    (acc, order) => acc + (order.couponDiscount || 0),
    0
  );

  res.render("salesReport", {
    orders: processedOrders,
    totalOrders,
    totalPages,
    currentPage: page,
    totalSales,
    totalFinalAmount,
    totalDiscount,
    totalCouponDiscount,
    filter: filter || "daily",
    startDate,
    endDate,
  });
});
const downloadSalesReportPDF = asyncHandler(async (req, res) => {
  const pdfDir = path.join(__dirname, "../../public/mail");
  if (!fs.existsSync(pdfDir)) {
    fs.mkdirSync(pdfDir, { recursive: true });
  }

  let { filter = "daily", startDate, endDate } = req.query;
  let query = {};
  let now = new Date();

  if (filter === "daily") {
    const today = new Date();
    query.createdAt = {
      $gte: new Date(today.setHours(0, 0, 0, 0)),
      $lt: new Date(today.setHours(23, 59, 59, 999)),
    };
  } else if (filter === "weekly") {
    const current = new Date();
    let weekStart = new Date(
      current.setDate(current.getDate() - current.getDay())
    );
    weekStart.setHours(0, 0, 0, 0);
    let weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    query.createdAt = { $gte: weekStart, $lt: weekEnd };
  } else if (filter === "monthly") {
    query.createdAt = {
      $gte: new Date(now.getFullYear(), now.getMonth(), 1),
      $lt: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  } else if (filter === "yearly") {
    query.createdAt = {
      $gte: new Date(now.getFullYear(), 0, 1),
      $lt: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  } else if (filter === "custom" && startDate && endDate) {
    query.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const orders = await Order.find(query)
    .populate({
      path: "user",
      model: "User",
      select: "name email",
    })
    .select(
      "orderId user totalPrice finalAmound couponDiscount createdAt address status"
    )
    .sort({ createdAt: -1 });

  const processedOrders = orders.map((order) => {
    const orderObj = order.toObject ? order.toObject() : order;
    return {
      ...orderObj,
      userName: orderObj.user?.name || orderObj.address?.name || "Unknown",
      userEmail: orderObj.user?.email || "Unknown",
    };
  });

  const totalSales = processedOrders.reduce(
    (acc, order) => acc + (order.totalPrice || 0),
    0
  );
  const totalFinalAmount = processedOrders.reduce(
    (acc, order) => acc + (order.finalAmound || 0),
    0
  );
  const totalDiscount = totalSales - totalFinalAmount;
  const totalCouponDiscount = processedOrders.reduce(
    (acc, order) => acc + (order.couponDiscount || 0),
    0
  );

  const doc = new PDFDocument({
    size: "A3",
    margin: 50,
    bufferPages: true,
  });

  const filePath = path.join(pdfDir, "salesReport.pdf");
  const stream = fs.createWriteStream(filePath);

  doc.on("error", (err) => {
    console.error("PDFDocument error:", err);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw err;
  });

  stream.on("error", (err) => {
    console.error("Stream error:", err);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw err;
  });

  doc.pipe(stream);

  const pageWidth = doc.page.width;
  const margins = {
    top: 50,
    bottom: 50,
    left: 50,
    right: 50,
  };
  const contentWidth = pageWidth - margins.left - margins.right;

  const styles = {
    header: { fontSize: 18, color: "#2c3e50" },
    subHeader: { fontSize: 12, color: "#34495e" },
    tableHeader: { fontSize: 10, font: "Helvetica-Bold", color: "#2c3e50" },
    tableCell: { fontSize: 9, font: "Helvetica" },
    summary: { fontSize: 11, font: "Helvetica-Bold", color: "#2c3e50" },
    footer: { fontSize: 8, font: "Helvetica", color: "#7f8c8d" },
  };

  const columns = [
    { id: "orderId", header: "Order ID", width: 80, align: "left" },
    { id: "customer", header: "Customer", width: 100, align: "left" },
    { id: "email", header: "Email", width: 110, align: "left" },
    { id: "price", header: "Total Price", width: 70, align: "right" },
    { id: "final", header: "Final Amount", width: 70, align: "right" },
    { id: "discount", header: "Discount", width: 60, align: "right" },
    { id: "status", header: "Status", width: 60, align: "center" },
    { id: "date", header: "Date", width: 70, align: "left" },
  ];

  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const scaling = contentWidth / totalWidth;

  if (scaling < 1) {
    columns.forEach((col) => {
      col.width = Math.floor(col.width * scaling);
    });
  }

  try {
    doc
      .fontSize(styles.header.fontSize)
      .fillColor(styles.header.color)
      .text("Trendora Sales Report", margins.left, margins.top, {
        width: contentWidth,
        align: "center",
      })
      .moveDown(1.5);

    const reportInfoY = doc.y;
    doc
      .fontSize(styles.subHeader.fontSize)
      .fillColor(styles.subHeader.color)
      .text(`Generated on: ${new Date().toLocaleString()}`, {
        width: contentWidth,
        align: "center",
      })
      .moveDown(0.5)
      .text(
        `Report Period: ${filter.charAt(0).toUpperCase() + filter.slice(1)}`,
        {
          width: contentWidth,
          align: "center",
        }
      )
      .moveDown(0.5);

    if (startDate && endDate) {
      doc
        .text(
          `Date Range: ${new Date(startDate).toLocaleDateString()} - ${new Date(
            endDate
          ).toLocaleDateString()}`,
          {
            width: contentWidth,
            align: "center",
          }
        )
        .moveDown(1);
    }

    const drawTableHeader = (y) => {
      let xPosition = margins.left;

      doc.rect(margins.left, y, contentWidth, 20).fillColor("#f8f9fa").fill();

      doc
        .font(styles.tableHeader.font)
        .fontSize(styles.tableHeader.fontSize)
        .fillColor(styles.tableHeader.color);

      columns.forEach((column) => {
        doc.text(column.header, xPosition, y + 5, {
          width: column.width,
          align: column.align,
          lineGap: 0,
        });
        xPosition += column.width;
      });

      return y + 20;
    };

    let yPosition = drawTableHeader(doc.y);

    const drawTableRow = (order, y) => {
      let xPosition = margins.left;
      const rowHeight = 20;

      if (processedOrders.indexOf(order) % 2 === 0) {
        doc
          .rect(margins.left, y, contentWidth, rowHeight)
          .fillColor("#f8f9fa")
          .fillOpacity(0.5)
          .fill()
          .fillOpacity(1);
      }

      doc
        .font(styles.tableCell.font)
        .fontSize(styles.tableCell.fontSize)
        .fillColor("#000000");

      const rowData = [
        { text: order.orderId || "N/A", align: "left" },
        { text: order.userName, align: "left" },
        { text: order.userEmail, align: "left" },
        { text: `₹${(order.totalPrice || 0).toFixed(2)}`, align: "right" },
        { text: `₹${(order.finalAmound || 0).toFixed(2)}`, align: "right" },
        {
          text: `₹${(
            (order.totalPrice || 0) - (order.finalAmound || 0)
          ).toFixed(2)}`,
          align: "right",
        },
        { text: order.status || "N/A", align: "center" },
        { text: new Date(order.createdAt).toLocaleDateString(), align: "left" },
      ];

      columns.forEach((column, idx) => {
        doc.text(rowData[idx].text, xPosition, y + 5, {
          width: column.width,
          align: rowData[idx].align,
          lineGap: 0,
        });
        xPosition += column.width;
      });

      return y + rowHeight;
    };

    processedOrders.forEach((order, index) => {
      if (yPosition > doc.page.height - margins.bottom - 100) {
        doc.addPage();
        yPosition = margins.top;
        yPosition = drawTableHeader(yPosition);
      }
      yPosition = drawTableRow(order, yPosition);
    });

    yPosition += 20;
    const summaryWidth = 300;
    const summaryX = (pageWidth - summaryWidth) / 2;

    if (yPosition > doc.page.height - margins.bottom - 150) {
      doc.addPage();
      yPosition = margins.top + 20;
    }

    doc
      .rect(summaryX, yPosition, summaryWidth, 120)
      .fillColor("#f8f9fa")
      .fill();

    doc
      .font(styles.summary.font)
      .fontSize(styles.summary.fontSize)
      .fillColor(styles.summary.color);

    const summaryData = [
      { label: "Total Orders", value: processedOrders.length },
      { label: "Total Sales", value: `₹${totalSales.toFixed(2)}` },
      { label: "Total Final Amount", value: `₹${totalFinalAmount.toFixed(2)}` },
      { label: "Total Discount", value: `₹${totalDiscount.toFixed(2)}` },
      {
        label: "Total Coupon Discount",
        value: `₹${totalCouponDiscount.toFixed(2)}`,
      },
    ];

    yPosition += 15;
    summaryData.forEach((item) => {
      doc
        .text(item.label, summaryX + 20, yPosition, {
          continued: true,
          width: 150,
        })
        .text(`: ${item.value}`, { align: "right", width: summaryWidth - 40 });
      yPosition += 20;
    });

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(styles.footer.fontSize)
        .fillColor(styles.footer.color)
        .text(
          `Trendora | www.trendora.com | Page ${i + 1} of ${range.count}`,
          margins.left,
          doc.page.height - margins.bottom,
          { align: "center", width: contentWidth }
        );
    }

    doc.end();

    stream.on("finish", () => {
      const fileName = `Trendora_Sales_Report_${filter}_${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error("Download error:", err);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          return res.status(500).send("Error downloading file");
        }
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw err;
  }
});

const downloadSalesReportExcel = asyncHandler(async (req, res) => {
  const { filter, startDate, endDate } = req.query;
  let query = {};

  let now = new Date();
  if (filter === "daily") {
    const today = new Date();
    query.createdAt = {
      $gte: new Date(today.setHours(0, 0, 0, 0)),
      $lt: new Date(today.setHours(23, 59, 59, 999)),
    };
  } else if (filter === "weekly") {
    const current = new Date();
    let weekStart = new Date(
      current.setDate(current.getDate() - current.getDay())
    );
    weekStart.setHours(0, 0, 0, 0);
    let weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    query.createdAt = { $gte: weekStart, $lt: weekEnd };
  } else if (filter === "monthly") {
    query.createdAt = {
      $gte: new Date(now.getFullYear(), now.getMonth(), 1),
      $lt: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  } else if (filter === "yearly") {
    query.createdAt = {
      $gte: new Date(now.getFullYear(), 0, 1),
      $lt: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  } else if (filter === "custom" && startDate && endDate) {
    query.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const orders = await Order.find(query)
    .populate({
      path: "user",
      model: "User",
      select: "name email",
    })
    .select(
      "orderId user totalPrice finalAmound couponDiscount createdAt address status payment"
    )
    .sort({ createdAt: -1 });

  const processedOrders = orders.map((order) => {
    const orderObj = order.toObject ? order.toObject() : order;
    return {
      ...orderObj,
      userName: orderObj.user?.name || orderObj.address?.name || "Guest",
      userEmail: orderObj.user?.email || "N/A",
      totalPrice: orderObj.totalPrice || 0,
      finalAmound: orderObj.finalAmound || 0,
      discount: (orderObj.totalPrice || 0) - (orderObj.finalAmound || 0),
    };
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sales Report");

  const headerStyle = {
    font: { bold: true, size: 12, color: { argb: "00000000" } },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    },
    alignment: { horizontal: "center", vertical: "middle" },
  };

  worksheet.columns = [
    { header: "Order ID", key: "orderId", width: 15 },
    { header: "Customer", key: "customer", width: 20 },
    { header: "Email", key: "email", width: 30 },
    { header: "Total Price", key: "totalPrice", width: 15 },
    { header: "Final Amount", key: "finalAmount", width: 15 },
    { header: "Discount", key: "discount", width: 15 },
    { header: "Payment", key: "payment", width: 15 },
    { header: "Status", key: "status", width: 15 },
    { header: "Date", key: "date", width: 20 },
  ];

  worksheet.getRow(1).eachCell((cell) => {
    cell.style = headerStyle;
  });

  worksheet.insertRow(1, [`Sales Report - ${filter.toUpperCase()}`]);
  worksheet.mergeCells("A1:I1");
  worksheet.getCell("A1").style = {
    font: { bold: true, size: 14 },
    alignment: { horizontal: "center" },
  };

  if (startDate && endDate) {
    worksheet.insertRow(2, [
      `Date Range: ${new Date(startDate).toLocaleDateString()} - ${new Date(
        endDate
      ).toLocaleDateString()}`,
    ]);
    worksheet.mergeCells("A2:I2");
    worksheet.getCell("A2").style = {
      font: { italic: true },
      alignment: { horizontal: "center" },
    };
  }

  processedOrders.forEach((order) => {
    worksheet.addRow({
      orderId: order.orderId || order._id?.toString()?.slice(-8) || "N/A",
      customer: order.userName,
      email: order.userEmail,
      totalPrice: Number(order.totalPrice).toFixed(2),
      finalAmount: Number(order.finalAmound).toFixed(2),
      discount: Number(order.discount).toFixed(2),
      payment: order.payment || "N/A",
      status: order.status || "N/A",
      date: new Date(order.createdAt).toLocaleDateString(),
    });
  });

  const totalRow = worksheet.addRow({
    customer: "TOTAL",
    totalPrice: Number(
      processedOrders.reduce((sum, order) => sum + order.totalPrice, 0)
    ).toFixed(2),
    finalAmount: Number(
      processedOrders.reduce((sum, order) => sum + order.finalAmound, 0)
    ).toFixed(2),
    discount: Number(
      processedOrders.reduce((sum, order) => sum + order.discount, 0)
    ).toFixed(2),
  });
  totalRow.font = { bold: true };

  worksheet.getColumn("totalPrice").numFmt = "₹#,##0.00";
  worksheet.getColumn("finalAmount").numFmt = "₹#,##0.00";
  worksheet.getColumn("discount").numFmt = "₹#,##0.00";

  ["orderId", "payment", "status", "date"].forEach((key) => {
    worksheet.getColumn(key).alignment = { horizontal: "center" };
  });

  const timestamp = new Date().getTime();
  const filePath = path.join(__dirname, "../../public/reports");

  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(filePath, { recursive: true });
  }

  const fileName = `Trendora_Sales_Report_${filter}_${timestamp}.xlsx`;
  const fullPath = path.join(filePath, fileName);

  await workbook.xlsx.writeFile(fullPath);
  res.download(fullPath, fileName, (err) => {
    if (err) {
      console.error("Download error:", err);
      res
        .status(500)
        .json({ success: false, message: "Error downloading file" });
    }
    fs.unlink(fullPath, (unlinkErr) => {
      if (unlinkErr) console.error("Error deleting file:", unlinkErr);
    });
  });
});
const changeOrderStatus = asyncHandler(async (req, res) => {
  const { orderId, status, itemId } = req.query;

  const validStatuses = [
    "Pending",
    "Processing",
    "Shipped",
    "Delivered",
    "Cancelled",
    "Return Request",
    "Returned",
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ status: false, message: "Invalid status" });
  }

  const order = await Order.findOne({ orderId });
  if (!order) {
    return res.status(404).json({ status: false, message: "Order not found" });
  }
  if (!order.orderedItems || order.orderedItems.length === 0) {
    return res
      .status(400)
      .json({ status: false, message: "No items found in the order" });
  }

  if (itemId) {
    const item = order.orderedItems.find(
      (item) => item._id.toString() === itemId
    );
    if (!item) {
      return res
        .status(404)
        .json({ status: false, message: "Item not found in the order" });
    }
    item.status = status;
  } else {
    order.orderedItems.forEach((item) => {
      item.status = status;
    });
  }

  order.orderStatus = status;
  await order.save();

  return res
    .status(200)
    .json({ status: true, message: "Status updated successfully" });
});

module.exports = {
  getSalesReport,
  downloadSalesReportPDF,
  downloadSalesReportExcel,
  changeOrderStatus,
};
