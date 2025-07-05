const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const zlib = require("node:zlib");

/*

content of tree object
mode 

*/

function ls_tree(hash, arg) {
	let content = read_blob(hash, "-p");
	console.log(`content is :${content}`);
	console.log(`content type is :${typeof content}`);
	console.log(`hash is ${hash}`);
	console.log(content.split("\0"));
	parse_tree(content);
}

function parse_tree(content) {
	let header = "";
	let entries = [];
	let temp = "";
	let tempEntry = {};
	let ind = 0;
	while (ind < content.length) {
		if (!header) {
			if (content[ind] === "\0") {
				header = temp;
				temp = "";
				continue;
			}
			temp += content[ind];
			ind += 1;
			continue;
		}
		if (!tempEntry.mode) {
			if (content[ind] === " ") {
				tempEntry.mode = temp;
				temp = "";
				continue;
			}
			temp += content[ind];
			ind += 1;
			continue;
		}
		if (!tempEntry.name) {
			if (content[ind] === "\0") {
				tempEntry.name = temp;
				temp = "";
				continue;
			}
			temp += content[ind];
			ind += 1;
			continue;
		}
		if (!tempEntry.sha1) {
			let utfSha = content.slice(ind, ind + 20);
			console.log(utfSha);
			break;
		}
	}
}

function hash_object(data, write) {
	let type = "blob";
	let buffer = Buffer.from(data);
	let size = Buffer.byteLength(buffer, "ascii");
	const header = `${type} ${size}\0`;
	const sha1 = crypto
		.createHash("sha1")
		.update(`${header}${data}`)
		.digest("hex");
	if (write) {
		const compressedData = zlib.deflateSync(`${header}${data}`);
		addObject(sha1, compressedData);
	}
	process.stdout(sha1);
}

function addObject(sha1, compressedData) {
	const objectPath = path.join(
		process.cwd(),
		`.git/objects/${sha1.slice(0, 2)}/`
	);
	fs.mkdirSync(objectPath, { recursive: true });
	fs.writeFileSync(path.join(objectPath, sha1.slice(2)), compressedData);
}

function hash_object(data, write) {
	let type = "blob";
	let buffer = Buffer.from(data);
	let size = Buffer.byteLength(buffer, "ascii");
	const header = `${type} ${size}\0`;
	const sha1 = crypto
		.createHash("sha1")
		.update(`${header}${data}`)
		.digest("hex");
	const compressedData = zlib.deflateSync(`${header}${data}`);
	if (write) {
		addObject(sha1, compressedData);
	}
	console.log(sha1);
}

function cat_file(hash, arg) {
	if (!hash) {
		throw new Error("Expected a hash value");
	}
	if (!arg) {
		throw new Error("cat-file expects two arguments");
	}
	const fileData = read_blob(hash);
	let header = fileData.split("\0")[0];
	let length = header.length;
	switch (arg) {
		case "-p":
			let content = fileData.slice(length + 1).trimEnd();
			return content;
			break;
		case "-s":
			let size = header.split(" ")[1];
			return size;
			break;
		case "-t":
			let type = header.split(" ")[0];
			return type;
			break;
		default:
			throw new Error(`cat file doesn't recognize ${arg}`);
	}
}

function read_blob(hash) {
	const objectPath = path.join(
		process.cwd(),
		`.git/objects/${hash.slice(0, 2)}/${hash.slice(2)}`
	);
	let compressedData = fs.readFileSync(objectPath);
	let unzippedFile = zlib.unzipSync(compressedData);
	let fileData = unzippedFile.toString();
	return fileData;
}

module.exports = { hash_object, cat_file, ls_tree };
