# Suyogit

An implementation of Git in TypeScript. This project aims to provide basic plumbing commands of Git, allowing you to create your own commits by walking through the internal processes that happen when you run something like:
``` bash
git commit -m "generic commit message"
```

# Motivation

I wanted to understand how Git works under the hood. It was always a mystery to me how a simple git add . and git commit -m "commit message" makes it so resilient — almost impossible to lose a file. To uncover the magic, I read the  [Progit](https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain) book and then began implementing my own version of Git (at least some of the plumbing commands).
# Usage

    Note: You don’t need to write the curly braces in the commands.
``` bash
  #Clone this repo with:
    git clone https://github.com/0suyog/suyogit.git

  #Cd into app
    cd Suyogit/app

  #Initialize a repo:
    node main.js init

  #Set your name:
    node main.js user.name {yourname}

  #Set your email:
    node main.js user.email {youremail}

  #Write the tree (like git add .):
    node main.js write-tree

  #Create a commit:
    node main.js commit-tree {tree_hash} -m {commit_message}

```
# Commands

These are the commands recognized by the program. They should be used after node main.js:

- `init`
	Initializes the current directory as a Git repository.

- `hash-object [flag] [data/filePath]`

	`--stdin`: Prompts user for input and returns the SHA-1 hash of the data (like Git does).

	 `-w`: Saves the object to .git/objects.

	You should pass a file path if not using `--stdin`.

- `cat-file [flag] sha1Hash`

	 `-t`: Shows the type of the object.

	 `-s`: Shows the size.

	 `-p`: Shows the content.

- `ls-tree [?flag] treeHash`

	`--name-only`: Shows only the filenames.

	No flag: Displays filenames along with metadata.

- `ls-files [?pathToIndex]`
	Parses the index file at the given path. If no path is given, defaults to .git/index in the current directory.

- `write-tree`
	Creates a tree from the current directory's files (excluding .git). Automatically hashes untracked files.

- `config {block.key value}`
	Stores config data for later use. (You can skip the curly braces.)

- `commit-tree treeHash [?-p parentCommitHash] -m "message"`

	`-m` [message]: Specifies the commit message.

	`-p` [parentHash]: Optionally includes one or more parent commits.

- `update-ref` branchName commitHash
	Creates or updates a branch to point to the given commit hash
