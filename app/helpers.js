const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const zlib = require("node:zlib");

const entryPartByte = {
	ctimeS: 4,
	ctimeM: 4,
	mtimeS: 4,
	mtimeM: 4,
	devNum: 4,
	inode: 4,
	mode: 4,
	uid: 4,
	gid: 4,
	fileSize: 4,
	hash: 20,
	flag: 2,
};

const fileModesDictionary = {
	"100644": "blob",
	"100755": "blob",
	"120000": "blob",
	"040000": "tree",
};



function parse_index(content) {
	let parsedData = {
		entries: [],
	};
	let headerSignature = content.subarray(0, 4);
	if (headerSignature.toString() !== "DIRC") {
		throw new Error("Not a git index file");
	}
	parsedData.signature = headerSignature.toString();
	let versionNumber = content.subarray(4, 8).readUint32BE();
	if (versionNumber !== 2) {
		throw new Error("Unsupported Version");
	}
	let checkSum = content.subarray(content.length - 20);
	let dataForCheckSum = content.subarray(0, content.length - 20);
	if (checkSum.toString() !== dataForCheckSum.toString("hex")) {
		throw new Error("CheckSum didnt match");
	}
	let numberOfEntries = content.subarray(8, 12).readUint32BE();
	let offset = 12;
	let entry = {};
	for (let i = 0; i < numberOfEntries; i++) {
		entry = {};
		let ctime = `${content
			.subarray(offset, offset + entryPartByte.ctimeS)
			.readUint32BE()}.${content
			.subarray(offset + entryPartByte.ctimeM)
			.readUint32BE()}`;
		offset += entryPartByte.ctimeS + entryPartByte.ctimeM;
		let mtime = `${content
			.subarray(offset, offset + entryPartByte.mtimeS)
			.readUint32BE()}.${content
			.subarray(offset + entryPartByte.mtimeM)
			.readUint32BE()}`;
		offset += entryPartByte.mtimeS + entryPartByte.mtimeM;
		let deviceNum = content
			.subarray(offset, (offset += entryPartByte.devNum))
			.readUint32BE();
		let inodeNum = content
			.subarray(offset, (offset += entryPartByte.inode))
			.readUint32BE();
		let mode = content
			.subarray(offset, (offset += entryPartByte.mode))
			.readUint32BE()
			.toString(8);
		let uid = content
			.subarray(offset, (offset += entryPartByte.uid))
			.readUint32BE();
		let gid = content
			.subarray(offset, (offset += entryPartByte.gid))
			.readUint32BE();
		let fileSize = content
			.subarray(offset, (offset += entryPartByte.fileSize))
			.readUint32BE();
		let hash = content
			.subarray(offset, (offset += entryPartByte.hash))
			.toString("hex");
		let flags = parseFlag(
			content.subarray(offset, (offset += entryPartByte.flag))
		);
		// each entry length is 62 long upto flags then name is varialbe
		let entryLength = 62;
		let name = content
			.subarray(offset, (offset += flags.nameLength))
			.toString();
		entryLength += flags.nameLength;
		// offset += 1; // Index entries are always null terminated
		entry = {
			no: i + 1,
			ctime,
			mtime,
			uid,
			gid,
			deviceNum,
			inodeNum,
			mode,
			fileSize,
			hash,
			flags,
			name,
		};
		parsedData.entries.push(entry);
		let rem = entryLength % 8;
		offset += 8 - rem || 8;
	}
	console.log(content.subarray(0, content.length - 20).toString("hex"));
	console.log("\n____________");
	let generatedCheckSum = crypto
		.createHash("sha1")
		.update(dataForCheckSum, false)
		.digest();
	console.log(
		`is checksum equal to generatedCheckum?: ${
			checkSum.toString("hex") === generatedCheckSum.toString("hex")
		}`
	);
	// offset += 20;
	return parsedData;
}

function parseFlag(flag) {
	let num = flag.readUint16BE();
	let assumeValid = (num >>> 14) & 0b1;
	let extendedFlag = (num >>> 13) & 0b1;
	let twoBitStage = (num >>> 11) & 0b11;
	let nameLength = num & 0xfff;
	return {
		assumeValid,
		extendedFlag,
		twoBitStage,
		nameLength,
	};
}

function ls_files() {
	let content = fs.readFileSync("./.git/index");
	parse_index(content);
}

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
				header = content.subarray(0, ind).toString();
				prevInd = ind + 1;
			}
			ind += 1;
			continue;
		}

		if (!tempEntry.mode) {
			//  32 means space
			if (content[ind] === 32) {
				tempEntry.mode = content.subarray(prevInd, ind).toString();
				prevInd = ind + 1;
			}
			ind += 1;
			continue;
		}
		if (!tempEntry.fileName) {
			if (content[ind] === 0) {
				tempEntry.fileName = content.subarray(prevInd, ind).toString();
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
	let size = Buffer.byteLength(buffer);
	const header = `${type} ${size}\0`;
	const sha1 = crypto
		.createHash("sha1")
		.update(`${header}${data}`)
		.digest("hex");
	if (write) {
		const compressedData = zlib.deflateSync(`${header}${data}`);
		addObject(sha1, compressedData);
	}
	return sha1;
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
	return sha1;
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

module.exports = { hash_object, cat_file, ls_tree, ls_files };
