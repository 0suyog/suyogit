const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const zlib = require("node:zlib");

/*

content of tree object
tree size\0<fileEntries><fileEntry><fileEntry><fileEntry>
fileEntries :100644 fileName.ext\0sha1Hash( 40 long hex)
*/

const fileModesDictionary = {
	"100644": "blob",
	"100755": "blob",
	"120000": "blob",
	"040000": "tree",
};

function ls_tree(hash, arg) {
	let parsedTree = parseTreeHash(hash);
	switch (arg) {
		case "--name-only": {
			let names = "";
			for (let file of parsedTree) {
				names += `${file.fileName}\n`;
			}
			return names;
		}
		case undefined: {
			let returnValue = "";
			for (let file of parsedTree) {
				returnValue += `${file.mode} ${fileModesDictionary[file.mode]} ${
					file.sha1
				}    ${file.fileName}\n`;
			}
			return returnValue;
		}
		default:
			throw new Error(`ls-tree doesn't recognize ${arg}`);
	}
}

function parseTreeHash(hash) {
	let content = read_blob(hash);
	let ind = 0;
	let header = "";
	let prevInd = 0;
	let tempEntry = {};
	let entries = [];
	while (ind < content.length) {
		if (!header) {
			// 0 means null byte
			if (content[ind] === 0) {
				header = content.subarray(0, ind).toString("utf-8");
				prevInd = ind + 1;
			}
			ind += 1;
			continue;
		}

		if (!tempEntry.mode) {
			//  32 means space
			if (content[ind] === 32) {
				tempEntry.mode = content.subarray(prevInd, ind).toString("utf-8");
				prevInd = ind + 1;
			}
			ind += 1;
			continue;
		}
		if (!tempEntry.fileName) {
			if (content[ind] === 0) {
				tempEntry.fileName = content.subarray(prevInd, ind).toString("utf-8");
				prevInd = ind + 1;
			}
			ind += 1;
			continue;
		}
		if (!tempEntry.sha1) {
			ind += 20;
			tempEntry.sha1 = content.subarray(prevInd, ind).toString("hex");
			// this is not going to be ind+1  cuz there is no delimiter to seperate sha1 from the mode of next entry
			prevInd = ind;
			entries.push(tempEntry);
			tempEntry = {};
		}
	}
	return entries;
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
	const fileData = read_blob(hash).toString();
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
	return unzippedFile;
}

module.exports = { hash_object, cat_file, ls_tree };
