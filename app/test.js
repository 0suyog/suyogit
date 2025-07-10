let fileContent = Buffer.from("TEST");
fileContent.w("NOTTEST");
console.log(fileContent.toString());
