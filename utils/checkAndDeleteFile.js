const fs = require("fs");

function checkAndDeleteFile(filePath, callback) {
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return callback(null);
    }

    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) {
        return callback(unlinkErr);
      }
      return callback(null);
    });
  });
}

module.exports = checkAndDeleteFile;
