const fs = require("fs");
const path = require("path");
const zlib = require("node:zlib");
// You can use print statements as follows for debugging, they'll be visible when running tests.
console.error("Logs from your program will appear here!");

// Uncomment this block to pass the first stage
const command = process.argv[2];
const arg = process.argv[3];
const hash = process.argv[4];

switch (command) {
	case "init":
		createGitDirectory();
		break;
	case "cat-file":
		read_blob(hash, arg);
		break;
	default:
		throw new Error(`Unknown command ${command}`);
}

function createGitDirectory() {
	fs.mkdirSync(path.join(process.cwd(), ".git"), { recursive: true });
	fs.mkdirSync(path.join(process.cwd(), ".git", "objects"), {
		recursive: true,
	});
	fs.mkdirSync(path.join(process.cwd(), ".git", "refs"), { recursive: true });
	fs.writeFileSync(
		path.join(process.cwd(), ".git", "HEAD"),
		"ref: refs/heads/main\n"
	);
	console.log("Initialized git directory");
}

function read_blob(hash, arg) {
	if (!hash) {
		throw new Error("Expected a hash value");
	}
	if (!arg) {
		throw new Error("cat-file expects two arguments");
	}
	const objectPath = path.join(
		process.cwd(),
		`.git/objects/${hash.slice(0, 2)}/${hash.slice(2)}`
	);
	let compressedData = fs.readFileSync(objectPath);
	let enflated = zlib.unzipSync(compressedData);
	let fileData = enflated.toString();
	let header = fileData.split("\0")[0];
	let length = header.length;
	switch (arg) {
		case "-p":
			let content = fileData.slice(length);
			console.log(content);
			break;
		case "-s":
			let size = header.split(" ")[1];
			console.log(size);
			break;
		case "-t":
			let type = header.split(" ")[0];
			console.log(type);
			break;
		default:
			throw new Error(`cat file doesn't recognize ${arg}`);
	}
}
