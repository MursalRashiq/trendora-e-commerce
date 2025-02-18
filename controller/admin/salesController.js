const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const Order = require("../../models/orderSchema")
const moment = require('moment-timezone');
const path = require('path');
const fs = require('fs');



const getSalesReport = async (req, res) => {
  try {
    let { filter = 'daily', startDate, endDate, page = 1 } = req.query;
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
      let weekStart = new Date(current.setDate(current.getDate() - current.getDay()));
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

    console.log('Query:', JSON.stringify(query, null, 2));

    const perPage = 10;

    // Debug: First check a single order's user reference
    const sampleOrder = await Order.findOne(query).select('user');
    if (sampleOrder) {
      console.log('Sample order user reference:', sampleOrder.user);
    }
    
    // Perform the main query with population
    const orders = await Order.find(query)
      .populate({
        path: 'user',
        model: 'User', // Explicitly specify the model
        select: 'name email'
      })
      .select('orderId user totalPrice finalAmound couponDiscount createdAt address status payment')
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage);

    

    // Debug: Log the full order objects
    console.log('First order details:', JSON.stringify(orders[0], null, 2));

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / perPage);

    // Process orders to handle potentially unpopulated users
    const processedOrders = orders.map(order => {
      const orderObj = order.toObject ? order.toObject() : order;
      return {
        ...orderObj,
        paymentMethod: orderObj.payment || 'Unknown', // Renamed to paymentMethod for clarity
        userName: orderObj.user?.name || orderObj.address?.name || 'Unknown',
        userEmail: orderObj.user?.email || 'Unknown'
      };
    });

    const totalSales = processedOrders.reduce((acc, order) => acc + (order.totalPrice || 0), 0);
    const totalFinalAmount = processedOrders.reduce((acc, order) => acc + (order.finalAmound || 0), 0);
    const totalDiscount = totalSales - totalFinalAmount;
    const totalCouponDiscount = processedOrders.reduce((acc, order) => acc + (order.couponDiscount || 0), 0);

    res.render("salesReport", {
      orders: processedOrders,
      totalOrders,
      totalPages,
      currentPage: page,
      totalSales,
      totalFinalAmount,
      totalDiscount,
      totalCouponDiscount,
      filter: filter || 'daily',
      startDate,
      endDate,
    });
  } catch (error) {
    console.error('Sales Report Error:', error);
    res.status(500).send("Server Error");
  }
};
const downloadSalesReportPDF = async (req, res) => {
  try {
    // Create directory if it doesn't exist
    const pdfDir = path.join(__dirname, "../../public/mail");
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }

    let { filter = 'daily', startDate, endDate } = req.query;
    let query = {};
    let now = new Date();

    // Filter logic remains the same
    if (filter === "daily") {
        const today = new Date();
        query.createdAt = {
            $gte: new Date(today.setHours(0, 0, 0, 0)),
            $lt: new Date(today.setHours(23, 59, 59, 999)),
        };
    } else if (filter === "weekly") {
        const current = new Date();
        let weekStart = new Date(current.setDate(current.getDate() - current.getDay()));
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
            path: 'user',
            model: 'User',
            select: 'name email'
        })
        .select('orderId user totalPrice finalAmound couponDiscount createdAt address status')
        .sort({ createdAt: -1 });

    const processedOrders = orders.map(order => {
        const orderObj = order.toObject ? order.toObject() : order;
        return {
            ...orderObj,
            userName: orderObj.user?.name || orderObj.address?.name || 'Unknown',
            userEmail: orderObj.user?.email || 'Unknown'
        };
    });

    // Calculate totals
    const totalSales = processedOrders.reduce((acc, order) => acc + (order.totalPrice || 0), 0);
    const totalFinalAmount = processedOrders.reduce((acc, order) => acc + (order.finalAmound || 0), 0);
    const totalDiscount = totalSales - totalFinalAmount;
    const totalCouponDiscount = processedOrders.reduce((acc, order) => acc + (order.couponDiscount || 0), 0);

    // Create PDF Document with proper error handling
    const doc = new PDFDocument({
      size: "A3",
      margin: 50,
      bufferPages: true,
  });

  const filePath = path.join(pdfDir, "salesReport.pdf");
  const stream = fs.createWriteStream(filePath);

  // Set up error handlers
  doc.on('error', (err) => {
      console.error('PDFDocument error:', err);
      if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
      }
      throw err;
  });

  stream.on('error', (err) => {
      console.error('Stream error:', err);
      if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
      }
      throw err;
  });

  doc.pipe(stream);

  // Define page dimensions and margins
  const pageWidth = doc.page.width;
  const margins = {
      top: 50,
      bottom: 50,
      left: 50,
      right: 50
  };
  const contentWidth = pageWidth - margins.left - margins.right;

  // Improved styling configuration
  const styles = {
      header: { fontSize: 18, color: "#2c3e50" },
      subHeader: { fontSize: 12, color: "#34495e" },
      tableHeader: { fontSize: 10, font: "Helvetica-Bold", color: "#2c3e50" },
      tableCell: { fontSize: 9, font: "Helvetica" },
      summary: { fontSize: 11, font: "Helvetica-Bold", color: "#2c3e50" },
      footer: { fontSize: 8, font: "Helvetica", color: "#7f8c8d" }
  };

  // Adjusted column configuration for better spacing
  const columns = [
      { id: 'orderId', header: 'Order ID', width: 80, align: 'left' },
      { id: 'customer', header: 'Customer', width: 100, align: 'left' },
      { id: 'email', header: 'Email', width: 110, align: 'left' },
      { id: 'price', header: 'Total Price', width: 70, align: 'right' },
      { id: 'final', header: 'Final Amount', width: 70, align: 'right' },
      { id: 'discount', header: 'Discount', width: 60, align: 'right' },
      { id: 'status', header: 'Status', width: 60, align: 'center' },
      { id: 'date', header: 'Date', width: 70, align: 'left' }
  ];

  // Calculate total width to ensure it fits within content area
  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const scaling = contentWidth / totalWidth;

  // Scale column widths if necessary
  if (scaling < 1) {
      columns.forEach(col => {
          col.width = Math.floor(col.width * scaling);
      });
  }

  try {
      // Header Section with improved spacing
      doc.fontSize(styles.header.fontSize)
          .fillColor(styles.header.color)
          .text("Trendora Sales Report", margins.left, margins.top, {
              width: contentWidth,
              align: "center"
          })
          .moveDown(1.5);

      // Report Info with consistent spacing
      const reportInfoY = doc.y;
      doc.fontSize(styles.subHeader.fontSize)
          .fillColor(styles.subHeader.color)
          .text(`Generated on: ${new Date().toLocaleString()}`, {
              width: contentWidth,
              align: "center"
          })
          .moveDown(0.5)
          .text(`Report Period: ${filter.charAt(0).toUpperCase() + filter.slice(1)}`, {
              width: contentWidth,
              align: "center"
          })
          .moveDown(0.5);

      if (startDate && endDate) {
          doc.text(`Date Range: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`, {
              width: contentWidth,
              align: "center"
          }).moveDown(1);
      }

      // Function to draw table header
      const drawTableHeader = (y) => {
          let xPosition = margins.left;
          
          // Draw background for header
          doc.rect(margins.left, y, contentWidth, 20)
              .fillColor('#f8f9fa')
              .fill();
          
          doc.font(styles.tableHeader.font)
              .fontSize(styles.tableHeader.fontSize)
              .fillColor(styles.tableHeader.color);

          columns.forEach(column => {
              doc.text(
                  column.header,
                  xPosition,
                  y + 5, // Center text vertically in header
                  {
                      width: column.width,
                      align: column.align,
                      lineGap: 0
                  }
              );
              xPosition += column.width;
          });

          return y + 20; // Return next Y position
      };

      // Draw initial table header
      let yPosition = drawTableHeader(doc.y);

      // Function to draw table row
      const drawTableRow = (order, y) => {
          let xPosition = margins.left;
          const rowHeight = 20;

          // Alternate row background
          if ((processedOrders.indexOf(order) % 2) === 0) {
              doc.rect(margins.left, y, contentWidth, rowHeight)
                  .fillColor('#f8f9fa')
                  .fillOpacity(0.5)
                  .fill()
                  .fillOpacity(1);
          }

          doc.font(styles.tableCell.font)
              .fontSize(styles.tableCell.fontSize)
              .fillColor('#000000');

          const rowData = [
              { text: order.orderId || 'N/A', align: 'left' },
              { text: order.userName, align: 'left' },
              { text: order.userEmail, align: 'left' },
              { text: `₹${(order.totalPrice || 0).toFixed(2)}`, align: 'right' },
              { text: `₹${(order.finalAmound || 0).toFixed(2)}`, align: 'right' },
              { text: `₹${((order.totalPrice || 0) - (order.finalAmound || 0)).toFixed(2)}`, align: 'right' },
              { text: order.status || 'N/A', align: 'center' },
              { text: new Date(order.createdAt).toLocaleDateString(), align: 'left' }
          ];

          columns.forEach((column, idx) => {
              doc.text(
                  rowData[idx].text,
                  xPosition,
                  y + 5, // Center text vertically in row
                  {
                      width: column.width,
                      align: rowData[idx].align,
                      lineGap: 0
                  }
              );
              xPosition += column.width;
          });

          return y + rowHeight;
      };

      // Draw table rows with proper pagination
      processedOrders.forEach((order, index) => {
          if (yPosition > doc.page.height - margins.bottom - 100) {
              doc.addPage();
              yPosition = margins.top;
              yPosition = drawTableHeader(yPosition);
          }
          yPosition = drawTableRow(order, yPosition);
      });

      // Summary Section with improved layout
      yPosition += 20;
      const summaryWidth = 300;
      const summaryX = (pageWidth - summaryWidth) / 2;

      if (yPosition > doc.page.height - margins.bottom - 150) {
          doc.addPage();
          yPosition = margins.top + 20;
      }

      // Draw summary box with shadow effect
      doc.rect(summaryX, yPosition, summaryWidth, 120)
          .fillColor('#f8f9fa')
          .fill();

      doc.font(styles.summary.font)
          .fontSize(styles.summary.fontSize)
          .fillColor(styles.summary.color);

      const summaryData = [
          { label: "Total Orders", value: processedOrders.length },
          { label: "Total Sales", value: `₹${totalSales.toFixed(2)}` },
          { label: "Total Final Amount", value: `₹${totalFinalAmount.toFixed(2)}` },
          { label: "Total Discount", value: `₹${totalDiscount.toFixed(2)}` },
          { label: "Total Coupon Discount", value: `₹${totalCouponDiscount.toFixed(2)}` }
      ];

      yPosition += 15;
      summaryData.forEach(item => {
          doc.text(
              item.label,
              summaryX + 20,
              yPosition,
              { continued: true, width: 150 }
          ).text(
              `: ${item.value}`,
              { align: "right", width: summaryWidth - 40 }
          );
          yPosition += 20;
      });

      // Footer with page numbers
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          doc.fontSize(styles.footer.fontSize)
              .fillColor(styles.footer.color)
              .text(
                  `Trendora | www.trendora.com | Page ${i + 1} of ${range.count}`,
                  margins.left,
                  doc.page.height - margins.bottom,
                  { align: "center", width: contentWidth }
              );
      }

      // Finalize document
      doc.end();

      // Handle download
      stream.on("finish", () => {
          const fileName = `Trendora_Sales_Report_${filter}_${new Date().toISOString().split("T")[0]}.pdf`;
          res.download(filePath, fileName, (err) => {
              if (err) {
                  console.error('Download error:', err);
                  if (fs.existsSync(filePath)) {
                      fs.unlinkSync(filePath);
                  }
                  return res.status(500).send("Error downloading file");
              }
              // Clean up file after download
              if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
              }
          });
      });

  } catch (err) {
      console.error('PDF generation error:', err);
      if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
      }
      throw err;
  }


  } catch (error) {
    console.error("PDF Generation Error:", error);
    res.status(500).json({
      success: false,
      message: "Error generating PDF",
      error: error.message
    });
  }
};

// Generate Excel Report
const downloadSalesReportExcel = async (req, res) => {
  try {
      const { filter, startDate, endDate } = req.query;
      let query = {};
      
      // Apply filter logic
      let now = new Date();
      if (filter === "daily") {
          const today = new Date();
          query.createdAt = {
              $gte: new Date(today.setHours(0, 0, 0, 0)),
              $lt: new Date(today.setHours(23, 59, 59, 999)),
          };
      } else if (filter === "weekly") {
          const current = new Date();
          let weekStart = new Date(current.setDate(current.getDate() - current.getDay()));
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

      // Fetch orders with proper population
      const orders = await Order.find(query)
          .populate({
              path: 'user',
              model: 'User',
              select: 'name email'
          })
          .select('orderId user totalPrice finalAmound couponDiscount createdAt address status payment')
          .sort({ createdAt: -1 });

      // Process orders to handle potentially undefined values
      const processedOrders = orders.map(order => {
          const orderObj = order.toObject ? order.toObject() : order;
          return {
              ...orderObj,
              userName: orderObj.user?.name || orderObj.address?.name || 'Guest',
              userEmail: orderObj.user?.email || 'N/A',
              totalPrice: orderObj.totalPrice || 0,
              finalAmound: orderObj.finalAmound || 0,
              discount: (orderObj.totalPrice || 0) - (orderObj.finalAmound || 0)
          };
      });

      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Sales Report");

      // Style the headers
      const headerStyle = {
          font: { bold: true, size: 12, color: { argb: '00000000' } },
          fill: {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE0E0E0' }
          },
          alignment: { horizontal: 'center', vertical: 'middle' }
      };

      // Define columns with proper styling
      worksheet.columns = [
          { header: 'Order ID', key: 'orderId', width: 15 },
          { header: 'Customer', key: 'customer', width: 20 },
          { header: 'Email', key: 'email', width: 30 },
          { header: 'Total Price', key: 'totalPrice', width: 15 },
          { header: 'Final Amount', key: 'finalAmount', width: 15 },
          { header: 'Discount', key: 'discount', width: 15 },
          { header: 'Payment', key: 'payment', width: 15 },
          { header: 'Status', key: 'status', width: 15 },
          { header: 'Date', key: 'date', width: 20 }
      ];

      // Style the header row
      worksheet.getRow(1).eachCell((cell) => {
          cell.style = headerStyle;
      });

      // Add report title
      worksheet.insertRow(1, [`Sales Report - ${filter.toUpperCase()}`]);
      worksheet.mergeCells('A1:I1');
      worksheet.getCell('A1').style = {
          font: { bold: true, size: 14 },
          alignment: { horizontal: 'center' }
      };

      // Add date range info if applicable
      if (startDate && endDate) {
          worksheet.insertRow(2, [`Date Range: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`]);
          worksheet.mergeCells('A2:I2');
          worksheet.getCell('A2').style = {
              font: { italic: true },
              alignment: { horizontal: 'center' }
          };
      }

      // Add data rows
      processedOrders.forEach(order => {
          worksheet.addRow({
              orderId: order.orderId || order._id?.toString()?.slice(-8) || 'N/A',
              customer: order.userName,
              email: order.userEmail,
              totalPrice: Number(order.totalPrice).toFixed(2),
              finalAmount: Number(order.finalAmound).toFixed(2),
              discount: Number(order.discount).toFixed(2),
              payment: order.payment || 'N/A',
              status: order.status || 'N/A',
              date: new Date(order.createdAt).toLocaleDateString()
          });
      });

      // Add totals row
      const totalRow = worksheet.addRow({
          customer: 'TOTAL',
          totalPrice: Number(processedOrders.reduce((sum, order) => sum + order.totalPrice, 0)).toFixed(2),
          finalAmount: Number(processedOrders.reduce((sum, order) => sum + order.finalAmound, 0)).toFixed(2),
          discount: Number(processedOrders.reduce((sum, order) => sum + order.discount, 0)).toFixed(2)
      });
      totalRow.font = { bold: true };

      // Style number columns to show currency
      worksheet.getColumn('totalPrice').numFmt = '₹#,##0.00';
      worksheet.getColumn('finalAmount').numFmt = '₹#,##0.00';
      worksheet.getColumn('discount').numFmt = '₹#,##0.00';

      // Center align certain columns
      ['orderId', 'payment', 'status', 'date'].forEach(key => {
          worksheet.getColumn(key).alignment = { horizontal: 'center' };
      });

      // Generate file
      const timestamp = new Date().getTime();
      const filePath = path.join(__dirname, '../../public/reports');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(filePath)) {
          fs.mkdirSync(filePath, { recursive: true });
      }
      
      const fileName = `Trendora_Sales_Report_${filter}_${timestamp}.xlsx`;
      const fullPath = path.join(filePath, fileName);
      
      // Write file and send response
      await workbook.xlsx.writeFile(fullPath);
      res.download(fullPath, fileName, (err) => {
          if (err) {
              console.error("Download error:", err);
              res.status(500).json({ success: false, message: "Error downloading file" });
          }
          // Delete file after download
          fs.unlink(fullPath, (unlinkErr) => {
              if (unlinkErr) console.error("Error deleting file:", unlinkErr);
          });
      });

  } catch (error) {
      console.error("Excel Generation Error:", error.message);
      res.status(500).json({ 
          success: false, 
          message: "Error generating Excel",
          error: error.message 
      });
  }
};
const changeOrderStatus = async (req, res) => {
  try {
    const { orderId, status, itemId } = req.query;


    const validStatuses = [
      "Pending", "Processing", "Shipped", "Delivered", "Cancelled",
      "Return Request", "Returned"
    ];


    if (!validStatuses.includes(status)) {
      return res.status(400).json({ status: false, message: "Invalid status" });
    }


    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ status: false, message: "Order not found" });
    }
    if (!order.orderedItems || order.orderedItems.length === 0) {
      return res.status(400).json({ status: false, message: "No items found in the order" });
    }

    if (itemId) {

      const item = order.orderedItems.find((item) => item._id.toString() === itemId);
      if (!item) {
        return res.status(404).json({ status: false, message: "Item not found in the order" });
      }
      item.status = status;
    } else {

      order.orderedItems.forEach((item) => {
        item.status = status;
      });
    }



    order.orderStatus = status;
    await order.save();

    return res.status(200).json({ status: true, message: "Status updated successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "An error occurred" });
  }
};
  

module.exports = {
    getSalesReport,
    downloadSalesReportPDF,
    downloadSalesReportExcel,
    changeOrderStatus
};


