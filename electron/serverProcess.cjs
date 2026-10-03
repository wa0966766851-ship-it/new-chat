// The server may move to the next port if the development preview is running.
// Its own stdout is authoritative; never attach to another process's health API.
function waitForOwnServer(child, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    const finish = (error, port) => {
      clearTimeout(timeout);
      child.stdout.off("data", onData);
      child.off("exit", onExit);
      child.off("error", onError);
      error ? reject(error) : resolve(port);
    };
    const onData = data => {
      stdout = (stdout + data.toString()).slice(-4096);
      const match = stdout.match(/Server running on http:\/\/localhost:(\d+)\r?\n/);
      if (match) {
        const port = Number(match[1]);
        if (port > 0 && port <= 65535) finish(null, port);
      }
    };
    const onExit = code => finish(new Error(`本機伺服器啟動失敗（${code}）`));
    const onError = error => finish(error);
    const timeout = setTimeout(() => finish(new Error("本機伺服器啟動逾時")), timeoutMs);
    child.stdout.on("data", onData);
    child.once("exit", onExit);
    child.once("error", onError);
  });
}
module.exports = { waitForOwnServer };
