const mongoose = require("mongoose");

const connectDb = async () => {
  try {
    await mongoose
      .connect(process.env.MONGODB)
      .then(console.log(`Mongodb server connected`));
  } catch (err) {
    console.log(`Mongodb Err: ${err}`);
  }
};

module.exports = connectDb;
