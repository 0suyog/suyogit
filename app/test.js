const readline = require("node:readline");
const Stream = require("node:stream");
const takeInput = () => {
	let d = "";
	process.stdin.on("data", (data) => {
		d += data.toString("utf-8");
	});
	process.stdin.on("end", () => {
		console.log("end");
		console.log(0);
	});
};

takeInput();
