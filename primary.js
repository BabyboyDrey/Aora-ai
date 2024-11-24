const cluster = require("cluster");
const os = require("os");

if (cluster.isMaster) {
  const cpuCount = os.cpus().length;
  console.log(`The total number of CPUs is ${cpuCount}`);
  console.log(`Primary pid: ${process.pid}`);

  cluster.setupMaster({
    exec: __dirname + "/app.js",
  });

  for (let i = 0; i < cpuCount; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} has been killed`);
    console.log(`Starting another worker`);
    cluster.fork();
  });
} else {
  require("./app.js");
}
