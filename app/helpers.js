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

function update_ref(refPath, commitHash) {
	if (cat_file(commitHash, "-t") !== "commit") {
		throw new Error("The provided commitHash isnt a valid commit");
	}
	let dirPath = path.dirname(refPath);
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
	fs.writeFileSync(refPath, commitHash);
}

function commit_tree(tree, message, ...parents) {
	if (!tree) {
		throw new Error("Tree is required for a commit");
	}
	if (!message) {
		throw new Error("Message is required");
	}
	if (!cat_file(tree, "-t") === "tree") {
		throw new Error("Not valid Tree");
	}
	let parentString = "";
	parents.forEach((parent) => {
		if (!cat_file(parent, "-t") === "commit") {
			throw new Error("parent isnt a valid commit");
		}
		parentString += `parent ${parent}\n`;
	});
	let name = getConfig("user", "name");
	let email = getConfig("user", "email");
	let timeInSecond = Math.floor(Date.now() / 1000);
	const offset = new Date().getTimezoneOffset();
	const hours = Math.floor(Math.abs(offset) / 60)
		.toString()
		.padStart(2, 0);
	const minutes = (Math.abs(offset) % 60).toString().padStart(2, 0);
	const sign = offset <= 0 ? "+" : "-";
	let timeZoneOffset = `${sign}${hours}${minutes}`;
	let contentToWrite = `tree ${tree}\n${parentString}author ${name} <${email}> ${timeInSecond} ${timeZoneOffset}\ncommitter ${name} <${email}> ${timeInSecond} ${timeZoneOffset}\n\n${message}`;
	return hash_object("commit", contentToWrite, true).toString("hex");
}

// sample config
/*
[user] //block
	name = meow //key = value
	email = meow@mail.com
*/

function getConfig(block, key) {
	let filePath = path.join(process.cwd(), ".git", "config");
	let fileContent = fs.readFileSync(filePath).toString();
	let blockIndex = fileContent.indexOf(`[${block}]`);
	if (blockIndex == -1) {
		throw new Error(`${block} ${key} doesn't exist`);
	}
	let keyIndex = fileContent.indexOf(`${key}`);
	if (keyIndex === -1) {
		throw new Error(` ${key} doesnt exist`);
	}
	let equalSignIndex = fileContent.indexOf("=", keyIndex);
	let lineBreakIndex = fileContent.indexOf("\n", equalSignIndex);
	let value = fileContent.slice(equalSignIndex + 2, lineBreakIndex);
	return value;
}

function setConfig(block, key, value) {
	let filePath = path.join(process.cwd(), ".git", "config");
	let fileContent = fs.readFileSync(filePath);
	let blockIndex = fileContent.indexOf(Buffer.from(`[${block}]`));
	if (!fileContent.length) {
		let contentToWrite = Buffer.from(`[${block}]\n\t${key} = ${value}`);
		fs.appendFileSync(filePath, contentToWrite);
		return;
	}
	// if block isnt initialized
	if (blockIndex === -1) {
		let contentToWrite = Buffer.from(`\n[${block}]\n\t${key} = ${value}`);
		fs.appendFileSync(filePath, contentToWrite);
		return;
	}
	let keyIndex = fileContent.indexOf(Buffer.from(`\n\t${key} = `));
	// if key doesntExist
	if (keyIndex === -1) {
		let nextBlockIndex = fileContent.indexOf(Buffer.from("["), blockIndex + 1);
		// if nextBlock doent exist
		if (nextBlockIndex !== -1) {
			console.log(
				`fileContent cropped to nextBlockIndex${fileContent
					.subarray(0, nextBlockIndex)
					.toString()}`
			);
			let contentToWrite = Buffer.concat([
				fileContent.subarray(0, nextBlockIndex),
				Buffer.from(`\t${key} = ${value}\n`),
				fileContent.subarray(nextBlockIndex),
			]);
			fs.writeFileSync(filePath, contentToWrite);
			return;
		}
		let contentToWrite = Buffer.concat([
			fileContent.subarray(0),
			Buffer.from(`\n\t${key} = ${value}`),
		]);
		fs.writeFileSync(filePath, contentToWrite);
		return;
	}
	let contentToWrite = Buffer.concat([
		fileContent.subarray(0, keyIndex),
		Buffer.from(`\n\t${key} = ${value}`),
	]);
	fs.writeFileSync(filePath, contentToWrite);
	return;
}

function write_tree(path) {
	// let treeContent = "";
	let directoryContents = fs.readdirSync(path).sort();
	let buffers = [];
	if (!directoryContents.length) {
		return;
	}
	directoryContents.forEach((fileName) => {
		if (fileName === ".git") {
			return;
		}
		let fileStatus = fs.statSync(path.join(path, fileName));
		if (fileStatus.isFile()) {
			let hash = hash_object(
				"blob",
				fs.readFileSync(path.join(path, fileName)),
				true
			);
			buffers.push(Buffer.concat([Buffer.from(`100644 ${fileName}\0`), hash]));
		}
		if (fileStatus.isDirectory()) {
			let hash = write_tree(path.join(path, fileName));
			if (hash) {
				buffers.push(Buffer.concat([Buffer.from(`40000 ${fileName}\0`), hash]));
			}
		}
	});
	let contentBuffer = Buffer.concat(buffers);
	let headerBuffer = Buffer.from(`tree ${contentBuffer.byteLength}\0`);
	let treeBuffer = Buffer.concat([headerBuffer, contentBuffer]);
	let treeHash = crypto.createHash("sha1").update(treeBuffer).digest();
	const compressedData = zlib.deflateSync(treeBuffer);
	addObject(treeHash.toString("hex"), compressedData);
	return treeHash;
}
// Function to update index to add file to index
function update_index(hash, mode, fileName) {
	let fileContent;
	if (fs.existsSync(path.join(process.cwd(), ".git", "index"))) {
		fileContent = fs.readFileSync(path.join(process.cwd(), ".git", "index"));
	} else {
		fileContent = Buffer.alloc(32);
		fileContent.write("DIRC");
		fileContent.writeInt32BE(2, 4);
		fileContent.writeInt32BE(0, 8);
		let sha = crypto.createHash("sha1").update(fileContent).digest();
		sha.copy(fileContent, 12);
	}
	let parsedIndex = ls_files();
	let previousEntry = parsedIndex.find((entry) => entry.name === fileName);
	let position = fileContent.length - 20;
	if (previousEntry) {
		position = previousEntry.entryStart;
	}
	let dataAfterThisEntry = Buffer.from(
		fileContent.subarray(previousEntry.entryEnd).toString()
	);
	let entry = Buffer.alloc(62 + fileName.length);
}

// update_index("dsf", "df", "d");

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
	let generatedCheckSum = crypto
		.createHash("sha1")
		.update(dataForCheckSum)
		.digest();
	if (checkSum.toString("hex") !== generatedCheckSum.toString("hex")) {
		throw new Error("CheckSum didn't match");
	}
	let numberOfEntries = content.subarray(8, 12).readUint32BE();
	let offset = 12;
	let entry = {};
	let EntryStart = 0;
	for (let i = 0; i < numberOfEntries; i++) {
		let EntryStart = offset;
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
		let rem = entryLength % 8;
		offset += 8 - rem || 8;
		entry = {
			no: i + 1,
			entryStart: EntryStart,
			entryEnd: offset,
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
	}
	// Havent figured out extension yet
	// if (offset < content.length - 20) {
	// 	console.log(`My file Pointer Position: ${offset}`);
	// 	let extensions = {};
	// 	let signature = content.subarray(offset, (offset += 4));
	// 	extensions.signature = signature;
	// 	let numberOfEntries = content.subarray(offset, (offset += 4));
	// 	console.log(`number of entries: ${numberOfEntries.readUint32BE()}`);
	// 	console.log(
	// 		`hex content after nullbyte: ${content
	// 			.subarray(offset - 8)
	// 			.toString("ascii")}`
	// 	);
	// 	let nextNull = content.indexOf("\n", offset);
	// 	console.log(
	// 		`after next null${content.subarray(offset, nextNull).toString()}`
	// 	);
	// }
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

function ls_files(indexPath) {
	let content;
	if (indexPath) {
		content = fs.readFileSync(indexPath);
	}
	if (!content) {
		content = fs.readFileSync("./.git/index");
	}
	return parse_index(content);
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
				returnValue += `${file.mode.toString().padStart(6, 0)} ${
					fileModesDictionary[file.mode.toString().padStart(6, 0)]
				} ${file.sha1}    ${file.fileName}\n`;
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

function hash_object(type, data, write) {
	let buffer = Buffer.from(data);
	let size = Buffer.byteLength(buffer);
	const header = `${type} ${size}\0`;
	const sha1 = crypto.createHash("sha1").update(`${header}${data}`).digest();
	if (write) {
		const compressedData = zlib.deflateSync(`${header}${data}`);
		addObject(sha1.toString("hex"), compressedData);
	}
	// console.log(sha1);
	return sha1;
}

function addObject(sha1, compressedData) {
	const objectPath = path.join(
		process.cwd(),
		".git",
		"objects",
		`${sha1.slice(0, 2)}/`
	);
	fs.mkdirSync(objectPath, { recursive: true });
	fs.writeFileSync(path.join(objectPath, sha1.slice(2)), compressedData);
}

// function hash_object(data, write) {
// 	let type = "blob";
// 	let buffer = Buffer.from(data);
// 	let size = Buffer.byteLength(buffer, "ascii");
// 	const header = `${type} ${size}\0`;
// 	const sha1 = crypto
// 		.createHash("sha1")
// 		.update(`${header}${data}`)
// 		.digest("hex");
// 	const compressedData = zlib.deflateSync(`${header}${data}`);
// 	if (write) {
// 		addObject(sha1, compressedData);
// 	}
// 	return sha1;
// }

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
		".git",
		"objects",
		"${hash.slice(0, 2)}",
		`${hash.slice(2)}`
	);
	let compressedData = fs.readFileSync(objectPath);
	let unzippedFile = zlib.unzipSync(compressedData);
	return unzippedFile;
}

module.exports = {
	hash_object,
	cat_file,
	ls_tree,
	ls_files,
	write_tree,
	setConfig,
	commit_tree,
	update_ref,
};
