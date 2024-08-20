const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDb = require("./db/database");
const path = require("path");
const passport = require("./utils/passport.js");
const session = require("express-session");
const userRoutes = require("./controllers/users");

const app = express();

if (process.env.NODE_ENV !== "Production") {
  require("dotenv").config({
    path: ".env",
  });
}

app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.json());
app.use(
  session({
    secret: "lovedeathrobot",
    resave: false,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.use("/", express.static("uploads"));
app.use("/api/v1/user", userRoutes);
connectDb();

process.on("uncaughtException", (err) => {
  console.log(`Uncaught Exception Err: ${err}`);
  console.log("Shutting down server for uncaught exception");
});

process.on("unhandledRejection", (err) => {
  console.log(`Unhandled Rejection Err: ${err}`);
  console.log("Shutting down server for unhandled rejection");
  server.close(() => {
    process.exit(1);
  });
});

// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'build', 'index.html'))
//  })

app.get("/", (req, res) => {
  console.log("code:", req.query.code);
  res.send(req.user ? req.user : "Login pls");
});

app.get("/set-test-cookie", (req, res) => {
  res.cookie("testCookie", "testValue", { maxAge: 900000, httpOnly: true });
  res.send("Test cookie set");
});

app.get("/dice", (req, res) => {
  res.send("Url of ngrok functional");
});

const PORT = process.env.SERVER_PORT || 5002;

const server = app.listen(PORT, () => {
  console.log(`Server listening on Port ${PORT}`);
  console.log(`worker pid: ${process.pid}`);
});
