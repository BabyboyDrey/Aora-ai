const MongoStore = require("connect-mongo");

async function deletePreviousSessions(userId) {
  try {
    const Session = mongoose.connection.collection("sessions");

    const sessions = await Session.find().toArray();

    for (const sessionDoc of sessions) {
      const sessionData = JSON.parse(sessionDoc.session); // Deserialize session data

      if (
        sessionData.passport &&
        sessionData.passport.user === userId.toString()
      ) {
        await Session.deleteOne({ _id: sessionDoc._id });
      }
    }

    console.log(`Previous sessions for user ${userId} have been deleted.`);
  } catch (error) {
    console.error("Error deleting sessions:", error);
  }
}

module.exports = deletePreviousSessions;
