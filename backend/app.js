const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDb = require("./db/database");
const path = require("path");
const passport = require("./utils/passport.js");
const MongoStore = require("connect-mongo");
const session = require("express-session");
const userRoutes = require("./controllers/users");
const brandProfileRoutes = require("./controllers/brandProfile.js");
const designBookRoutes = require("./controllers/designBook.js");
const modelsRoutes = require("./controllers/models.js");
const fashionRoutes = require("./controllers/fashion.js");
const fabricRoutes = require("./controllers/fabric.js");
const contentRoutes = require("./controllers/content.js");
const designServiceRoutes = require("./controllers/designService.js");
const industryTrendsRoutes = require("./controllers/industryTrends.js");
const notificationsRoutes = require("./controllers/notifications.js");
const morgan = require("morgan");
const app = express();

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({
    path: ".env",
  });
}

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://aoraai.vercel.app",
      "https://b9fngmgw-5003.euw.devtunnels.ms",
      "https://reserve-documented-virtue-specifications.trycloudflare.com",
    ],
    credentials: true,
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "50mb" }));

app.use(cookieParser());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB,
      collectionName: "sessions",
      autoRemove: "native",
      ttl: 24 * 60 * 60,
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.use("/uploads", express.static("uploads"));
app.use("/output-uploads", express.static("output_uploads"));
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/brandProfile", brandProfileRoutes);
app.use("/api/v1/user/debo", designBookRoutes);
app.use("/api/v1/user/model", modelsRoutes);
app.use("/api/v1/user/fs", fashionRoutes);
app.use("/api/v1/user/fabric", fabricRoutes);
app.use("/api/v1/user/content", contentRoutes);
app.use("/api/v1/user/deserv", designServiceRoutes);
app.use("/api/v1/user/industryTrends", industryTrendsRoutes);
app.use("/api/v1/user/notifications", notificationsRoutes);
app.use(
  morgan(":method :url :status :res[content-length] - :response-time ms")
);
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

process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing server");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing server");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("warning", (warning) => {
  console.warn(
    `Warning: ${warning.name} - ${warning.message}\n${warning.stack}`
  );
});

process.on("rejectionHandled", (promise) => {
  console.log("Promise rejection handled:", promise);
});

process.on("beforeExit", (code) => {
  console.log("Process before Exit event with code:", code);
});

// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'build', 'index.html'))
//  })

app.get("/", (req, res) => {
  console.log("code:", req.query.code);
  res.send(req.user ? req.user : "Login pls");
});

app.get("/dice", (req, res) => {
  res.send("Url of ngrok functional");
});

const PORT = process.env.SERVER_PORT || 5002;

const server = app.listen(PORT, () => {
  console.log(`Server listening on Port ${PORT}`);
  console.log(`worker pid: ${process.pid}`);
});
