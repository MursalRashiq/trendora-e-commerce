const multer = require('multer');
 const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const destinationPath = path.join(__dirname, "../public/uploads/re-image");
      console.log("Destination Path:", destinationPath);
      cb(null, destinationPath);
    },
    filename: (req, file, cb) => {
      const filename = Date.now() + "." + file.originalname;
      console.log("Generated Filename:", filename);
      cb(null, filename);
    },
  });



// module.exports = storage
// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');

// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         const uploadPath = path.join(__dirname, "../public/uploads/re-image");

//         // Ensure the directory exists
//         if (!fs.existsSync(uploadPath)) {
//             fs.mkdirSync(uploadPath, { recursive: true });
//         }

//         cb(null, uploadPath);
//     },
//     filename: (req, file, cb) => {
//         cb(null, Date.now() + "-" + file.originalname);
//     }
// });

module.exports = storage;

