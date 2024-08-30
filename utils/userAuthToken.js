const userAuthToken = (user, statusCode, res) => {
  const user_token = user.getJwtToken();
  console.log("token:", user_token);
  const JWT_EXPIRES_MS = 8 * 60 * 60 * 1000;

  const options = {
    maxAge: JWT_EXPIRES_MS,
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production" ? true : false,
  };

  res.status(statusCode).cookie("user_token", user_token, options).json({
    success: true,
    user,
  });
};

module.exports = userAuthToken;
