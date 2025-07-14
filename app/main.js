const fs = require("fs");
const path = require("path");
const {
	hash_object,
	ls_tree,
	cat_file,
	ls_files,
	write_tree,
	setConfig,
	commit_tree,
	update_ref,
} = require("./helpers.js");
const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
	case "init":
		createGitDirectory();
		break;
	case "cat-file": {
		let arg = args.find((arg) => arg.startsWith("-"));
		let hash = args.find((arg) => !arg.startsWith("-"));
		process.stdout.write(cat_file(hash, arg));
		break;
	}
	case "hash-object": {
		let write = args.some((arg) => arg === "-w");
		let stdin = args.some((arg) => arg === "--stdin");
		let file = args.find((arg) => !arg.startsWith("-"));
		let data = "";
		if (stdin) {
			process.stdin.on("data", (d) => {
				if (d) {
					data += d.toString("utf-8");
				}
			});
			process.stdin.on("end", () => {
				if (data) {
					process.stdout.write(
						hash_object("blob", data, write).toString("hex")
					);
				}
			});
		} else {
			data = fs.readFileSync(path.join(process.cwd(), file), "utf-8");
			process.stdout.write(hash_object(data, write));
		}
		break;
	}
	case "ls-tree": {
		let hash = args.find((arg) => !arg.startsWith("-"));
		let arg = args.find((arg) => arg.startsWith("--"));
		process.stdout.write(ls_tree(hash, arg));
		break;
	}
	case "ls-files": {
		let indexPath = args[0];
		process.stdout.write(JSON.stringify(ls_files(indexPath), undefined, 2));
		break;
	}
	case "write-tree": {
		process.stdout.write(write_tree(process.cwd()).toString("hex"));
		break;
	}
	case "config": {
		let block_key = args[0];
		let value = args[1];
		let [block, key] = block_key.split(".");
		setConfig(block, key, value);
		break;
	}
	case "commit-tree": {
		let tree = args[0];
		let message = "";
		let parents = [];

		let i = 1;
		while (i < args.length) {
			if (args[i] == "-p") {
				parents.push(args[i + 1]);
			} else if (args[i] == "-m") {
				message = args[i + 1];
			}
			i++;
		}
		process.stdout.write(commit_tree(tree, message, ...parents));
		break;
	}
	case "update-ref": {
		let branchName = args[0];
		let hash = args[1];
		update_ref(
			path.join(process.cwd(), ".git", "refs", "heads", branchName),
			hash
		);
		break;
	}

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
	fs.writeFileSync(path.join(process.cwd(), ".git", "config"), "");
	console.log("Initialized git directory");
}
