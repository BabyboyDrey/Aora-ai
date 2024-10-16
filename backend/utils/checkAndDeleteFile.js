const fs = require("fs");

// function checkAndDeleteFile(filePath, callback) {
//   fs.access(filePath, fs.constants.F_OK, (err) => {
//     if (err) {
//       return callback(null);
//     }

//     fs.unlink(filePath, (unlinkErr) => {
//       if (unlinkErr) {
//         return callback(unlinkErr);
//       }
//       return callback(null);
//     });
//   });
// }

function checkAndDeleteFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        // If the file does not exist, resolve the promise without deleting
        return resolve();
      }

      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          return reject(unlinkErr); // Reject if there was an error deleting the file
        }
        return resolve(); // Resolve if the file was deleted successfully
      });
    });
  });
}

module.exports = checkAndDeleteFile;
