const { describe, it, beforeEach, afterEach } = require("node:test");
const { setConfig } = require("./helpers");
const fs = require("fs");
const path = require("path");
const assert = require("assert");

describe("Testing config files", () => {
	const configPath = path.join(process.cwd(), ".git", "config");

	beforeEach(() => {
		fs.writeFileSync(configPath, "");
	});

	afterEach(() => {
		fs.writeFileSync(configPath, "");
	});

	it("creates a new block if it doesn't exist", () => {
		let block = "user";
		let key = "name";
		let value = "suyog";
		setConfig(block, key, value);
		let shouldBe = `[${block}]\n\t${key} = ${value}`;
		let fileContents = fs.readFileSync(configPath, "utf8");
		assert.strictEqual(fileContents, shouldBe);
	});

	describe("when block exists", () => {
		let initial = `[user]\n\tname = suyog`;

		beforeEach(() => {
			fs.writeFileSync(configPath, initial);
		});

		it("adds a new key if it doesn't exist", () => {
			setConfig("user", "email", "suyog@mail.com");
			let expected = `[user]\n\tname = suyog\n\temail = suyog@mail.com`;
			let fileContents = fs.readFileSync(configPath, "utf8");
			assert.strictEqual(fileContents, expected);
		});

		it("updates existing key if it exists", () => {
			setConfig("user", "name", "longername");
			let expected = `[user]\n\tname = longername`;
			let fileContents = fs.readFileSync(configPath, "utf8");
			assert.strictEqual(fileContents, expected);
		});
	});

	describe("multiple blocks", () => {
		beforeEach(() => {
			const contents = `[core]\n\trepositoryformatversion = 0\n[user]\n\tname = suyog`;
			fs.writeFileSync(configPath, contents);
		});

		it("updates key in correct block without touching others", () => {
			setConfig("user", "name", "longername");
			const expected = `[core]\n\trepositoryformatversion = 0\n[user]\n\tname = longername`;
			let fileContents = fs.readFileSync(configPath, "utf8");
			assert.strictEqual(fileContents, expected);
		});

		it("adds key to correct block without touching others", () => {
			setConfig("core", "editor", "vim");
			const expected = `[core]\n\trepositoryformatversion = 0\n\teditor = vim\n[user]\n\tname = suyog`;
			let fileContents = fs.readFileSync(configPath, "utf8");
			assert.strictEqual(fileContents, expected);
		});
	});

	it("does not break if block is at the end of file", () => {
		fs.writeFileSync(configPath, `[user]\n\tname = suyog`);
		setConfig("user", "email", "suyog@mail.com");
		const expected = `[user]\n\tname = suyog\n\temail = suyog@mail.com`;
		let fileContents = fs.readFileSync(configPath, "utf8");
		assert.strictEqual(fileContents, expected);
	});
});
