const fs = require("fs");
const path = require("path");
const { read_blob, hash_object } = require("./helpers.js");
const readline = require("node:readline");
// You can use print statements as follows for debugging, they'll be visible when running tests.
console.error("Logs from your program will appear here!");

// Uncomment this block to pass the first stage
const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
	case "init":
		createGitDirectory();
		break;
	case "cat-file":
		let arg = args.find((arg) => arg.startsWith("-"));
		let hash = args.find((arg) => !arg.startsWith("-"));
		read_blob(hash, arg);
		break;
	case "hash-object":
		let write = args.some((arg) => arg === "-w");
		let stdin = args.some((arg) => arg === "--stdin");
		let file = args.find((arg) => !arg.startsWith("-"));
		let data;
		if (stdin) {
			let rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
			});
			rl.question("", (inp) => {
				if (inp !== null) {
					data = inp;
					rl.close();
					hash_object(data, write);
				}
			});
		} else {
			data = fs.readFileSync(path.join(process.cwd(), file), "utf-8");
			hash_object(data, write);
		}
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
