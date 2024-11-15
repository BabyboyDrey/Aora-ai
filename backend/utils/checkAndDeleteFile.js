const fs = require("fs");

function checkAndDeleteFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        return resolve();
      }

      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          return reject(unlinkErr);
        }
        return resolve();
      });
    });
  });
}

module.exports = checkAndDeleteFile;
