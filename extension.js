// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import { send } from "process";

// import { get } from "http";

// import vscode from "vscode"
const spawn = require("child_process").spawn;
const vscode = require("vscode");
// const tree = require("avl-tree");
const fs = require("fs");
const path = require("path");

// Function to create and write to a file
// function createAndWriteFile(filePath, content) {
// 	fs.writeFile(filePath, content, (err) => {
// 		if (err) {
// 			console.error(err);
// 			return;
// 		}
// 		console.log("File has been created");
// 	});
// }

// // Example usage
// const filePath = path.join(__dirname, "example.txt");
// createAndWriteFile(filePath, "Hello, world!");

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

// Handle data received from Python
// summarizer.stdout.on("data", (data) => {
// 	console.log(`Received data from Python: ${data}`);
// 	sendMessage(); // Send next message after receiving data
// });

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
	let messageQueue = []; // This is your wait queue
	let arrived = [];
	const summarizer = spawn("python", [path.join(__dirname, "summarizer.py")]);
	// Handle data received from Python
	summarizer.stdout.on("data", (data) => {
		// console.log(`Received data from Python: ${data}`);
		JSON.parse(data).forEach((element) => {
			const map = arrived.shift();
			map.set("summary", element);
		});
		if (messageQueue.length) sendMessage(); // Send next message after receiving data
	});

	// Send data to Python
	// summarizer.stdin.write("Hello from JavaScript\n");
	function sendMessage() {
		if (messageQueue.length) {
			// const message = messageQueue.shift(); // Get the next message from the queue
			summarizer.stdin.write(JSON.stringify(messageQueue) + "\n");
			messageQueue = []; // Clear the queue
		}
	}

	// Example function to add message to queue
	function addToQueue(message) {
		// if (priority) {
		// 	messageQueue.unshift(message); // Add message to the front of the queue for high priority
		arrived.push(message[0]);
		messageQueue.push(message[1]); // Add message to the end of the queue
		if (messageQueue.length) {
			sendMessage(); // If this is the only message in the queue, send it immediately
		}
	}

	// first check if there is an existing json cache
	// let avlIntervalTree = JSON.parse(path.join(__dirname, "codemap-cache.json"));
	let map = new Map();
	try {
		map = JSON.parse(
			fs.readFileSync(path.join(__dirname, "codemap-cache.json"))
		);
	} catch (err) {
		console.log(err);
	}

	async function dfs(document, defLocation) {
		//, depth = 3
		// if (depth === 0) return map;
		// const defLocation = await getDefinition(document, selection);

		console.log(defLocation.uri.fsPath);
		console.log(defLocation.range.start);
		console.log(defLocation.range.end);
		// if (!defLocation.length) return null; //if you highlight on a variable but it has no def.
		const header = defLocation.range.start;
		console.log(header);
		const defReferences = await getSortedReferences(defLocation, header);
		// summarizer.stdin.write(defLocation.uri.fsPath);
		if (!map.has(document.uri.fsPath)) {
			//if the file is not in the map, then add it
			map.set(document.uri.fsPath, new Map());
		}
		const currModule = map.get(document.uri.fsPath);
		if (currModule.has(header.line)) return currModule.get(header.line);
		let isClass = false;
		if (/\bclass\s/.test(document.lineAt(header.line).text)) isClass = true;
		if (!defReferences.length) {
			//if there are no references, then it is a standalone function
			// if (currModule.has(header.line)) return map; assume it doesnt have
			let [start, end] = getStartAndEndNoRef(
				document,
				header.line,
				isClass,
				currModule
			);
			const currAbs = new Map();
			currModule.set(header.line, currAbs);
			currAbs.set("start", start);
			currAbs.set("end", end);
			// currAbs.set("isClass", false);
			const content = document.getText(
				new vscode.Range(
					start,
					0,
					end,
					document.lineAt(end).range.end.character
				)
			);
			currAbs.set("content", content);
			// queryStr += `content: ${content}\n`;
			// console.log("queryStr: ", queryStr);
			let summary = lookForDocstring(document, start);
			if (summary) currAbs.set("summary", summary);
			else addToQueue([currAbs, `content: ${content}\n`]);
			currAbs.set("references", null);
			return currAbs;
			// return null;
		}

		let [start, end] = getStartAndEnd(
			document,
			header.line,
			defReferences,
			isClass
		);

		console.log("start, end: ");
		console.log(start, end);
		let summary = lookForDocstring(document, start);

		//for now, doesnt support reflecting changes in the document in real time
		// if (!currModule.has(header.line)) {
		const currAbs = new Map();
		currModule.set(header.line, currAbs);
		currAbs.set("start", start);
		currAbs.set("end", end);
		const content = document.getText(
			new vscode.Range(start, 0, end, document.lineAt(end).range.end.character)
		);
		if (summary) {
			currAbs.set("content", content);
			currAbs.set("summary", summary);
			const refs = new Set();
			currAbs.set("references", refs);
			defReferences.forEach(async (reference) => {
				const [_, ref] = await dfs(reference.to.uri, reference.to, map);
				refs.add(ref);
			});
		} else {
			// currAbs.set("isClass", false);

			// console.log(currAbs.get("content"));
			const refs = new Set();
			// const headerSummaryPair = [];
			let queryStr = "";
			currAbs.set("references", refs);
			defReferences.forEach(async (reference) => {
				const [header, ref] = await dfs(reference.to.uri, reference.to, map);
				queryStr += `${header.line}, summary: ${ref.get("summary")}\n`;
				// headerSummaryPair.push([header, ref.get("summary")]);
				refs.add(ref);
			});
			queryStr += `content: ${content}\n`;
			console.log("queryStr: ", queryStr);
			addToQueue([currAbs, queryStr]);
			// currAbs.set("summary", summary);
		}
		// }

		return currAbs;
	}

	// const summarizer = spawn("python", [path.join(__dirname, "summarizer.py")]);
	// // Handle data received from Python
	// summarizer.stdout.on("data", (data) => {
	// 	console.log(`Received data from Python: ${data}`);
	// });

	// // Send data to Python
	// summarizer.stdin.write("Hello from JavaScript\n");

	//default behavior = 用stdin和out来传输数据，如果是cloud的server就要用api了，用你写的那个flask

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "codemap" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand(
		"codemap.helloWorld",
		function () {
			// The code you place here will be executed every time your command is executed

			// Display a message box to the user
			vscode.window.showInformationMessage("Hello World from codemap!");
		}
	);

	context.subscriptions.push(disposable);

	// detect if there is a change in the active editor
	// if so, report to codemap and see if you need to update the avl tree
	// let activeEditor = vscode.window.activeTextEditor;
	// vscode.window.onDidChangeActiveTextEditor(
	// 	(editor) => {
	// 		if (editor) {
	// 			activeEditor = editor;
	// 			console.log(`Active editor changed: ${editor.document.fileName}`);
	// 			// Add more logic here if needed
	// 		}
	// 	},
	// 	null,
	// 	context.subscriptions
	// );

	let highlight = vscode.window.onDidChangeTextEditorSelection(
		async (event) => {
			if (event.selections.length) {
				const document = event.textEditor.document;
				if (!map.has(document.uri.fsPath))
					//if the file is not in the map, then add it
					map.set(document.uri.fsPath, new Map());
				const currModule = map.get(document.uri.fsPath);
				const selection = event.selections[0]; // Get the first selection
				if (!selection.isEmpty) {
					// Selection is not empty, so something is highlighted
					console.log(`Selected text: ${selection}`);
					// Add your logic here to handle the highlight

					// const selection = event.selections[0]; //doesn't handle multiple highlights..
					// Handle the highlighted text
					const loc = await getDefinition(document, selection.active);
					if (loc) {
						if (!currModule.has(loc))
							currModule.set(loc, dfs(document, loc, map));

						//display this: currModule.get(loc).get("summary");
					} else {
						//display nothing
					}
				}
			}
		}
	);

	context.subscriptions.push(highlight);
}

function lookForDocstring(document, start) {
	let startSymbol = null;
	let endSymbol = null;
	let isPython = false;
	switch (document.languageId) {
		case "python":
			startSymbol = '"""';
			endSymbol = '"""';
			isPython = true;
			break;
		case "csharp":
			startSymbol = "///";
			endSymbol = "///";
			break;
		case "java":
		case "cpp":
		case "typescript":
		case "javascript":
		case "php":
		case "kotlin":
		case "swift":
			startSymbol = "/**";
			endSymbol = "*/";
	}

	if (document.languageId === "python") {
		let i = start + 1;
		const initialIndent = document.lineAt(i).firstNonWhitespaceCharacterIndex;
		if (document.lineAt(i).firstNonWhitespaceCharacterIndex === initialIndent)
			if (!document.lineAt(i).text.trim().startsWith(startSymbol)) return null;
		while (i < document.lineCount - 1) {
			const line = document.lineAt(i);
			if (
				!line.isEmptyOrWhitespace &&
				line.firstNonWhitespaceCharacterIndex === initialIndent &&
				line.text.endsWith(endSymbol)
			)
				return document.getText(
					new vscode.Range(i, 0, i, document.lineAt(i).range.end.character)
				);
			i++;
		}
	} else {
		const initialIndent =
			document.lineAt(start).firstNonWhitespaceCharacterIndex;
		let i = start - 1;
		if (document.lineAt(i).firstNonWhitespaceCharacterIndex === initialIndent)
			if (!document.lineAt(i).text.trim().startsWith(endSymbol)) return null;
		const end = i;
		i--;
		if (document.languageId === "csharp") {
			while (i > 0) {
				const line = document.lineAt(i);
				if (
					!line.isEmptyOrWhitespace &&
					line.firstNonWhitespaceCharacterIndex === initialIndent &&
					!line.text.trim().startsWith(startSymbol)
				)
					return document.getText(
						new vscode.Range(
							i + 1,
							0,
							end,
							document.lineAt(end).range.end.character
						)
					);
				i--;
			}
		} else {
			while (i > 0) {
				const line = document.lineAt(i);
				if (
					!line.isEmptyOrWhitespace &&
					line.firstNonWhitespaceCharacterIndex === initialIndent &&
					line.text.trim().startsWith(startSymbol)
				)
					return document.getText(
						new vscode.Range(
							i,
							0,
							end,
							document.lineAt(end).range.end.character
						)
					);
				i--;
			}
		}
	}
}

async function getDefinition(document, selection) {
	// try {
	// const document = await vscode.workspace.openTextDocument(vscode.Uri.file("/Users/kite/miniconda3/envs/torch/lib/python3.9/site-packages/langchain/client/langchain.py"));

	// Execute the command and wait for the result
	const definitions = await vscode.commands.executeCommand(
		"vscode.executeDefinitionProvider",
		document.uri,
		// new vscode.Selection(0, 5, 0, 15)
		selection
	);
	// if (definitions.length) {
	console.log("Definitions found:");
	console.log(definitions);
	definitions.forEach((location) => {
		if (location.targetUri && location.targetRange) {
			// Handle as a DefinitionLink
			location = new vscode.Location(location.targetUri, location.targetRange);
		}
	});
	console.log("Definitions found:");
	console.log(definitions);
	if (definitions.length) {
		if (definitions.length > 1) {
			// Custom sort function
			definitions.sort((a, b) => {
				// Check if both files are in the current directory
				const aInSameFile = a.uri.fsPath === document.uri.fsPath;
				const bInSameFile = b.uri.fsPath === document.uri.fsPath;

				if (aInSameFile && !bInSameFile) {
					return -1; // a comes first
				} else if (!aInSameFile && bInSameFile) {
					return 1; // b comes first
				} else {
					// If both are in the current directory or both are not,
					// sort by range.start in descending order
					if (!aInSameFile && !bInSameFile) {
						//to be implemented
						//need to look at import statements
						throw new Error("Potentially Conflicting Definitions");
					}
					return (
						b.range.start.line - a.range.start.line ||
						b.range.start.character - a.range.start.character
					);
				}
			});
			// }

			// const end = performance.now();
			// console.log(`Function execution time: ${end - start} milliseconds`);
		}
		return definitions[0];
	}
	// } catch (error) {
	// 	console.error("Error getting definitions:", error);
	// } finally {
	// 	const end = performance.now();
	// 	console.log(`Function execution time: ${end - start} milliseconds`);
	// }
}

async function getSortedReferences(document, selection) {
	const callItems = await vscode.commands.executeCommand(
		"vscode.prepareCallHierarchy",
		document.uri,
		selection
	);
	if (callItems.length) {
		console.log("References found:");
		if (callItems.length > 1) {
			console.log("ambiguous references");
		} else {
			const references = await vscode.commands.executeCommand(
				"vscode.provideOutgoingCalls",
				callItems[0]
			);
			console.log(references);
			// console.log(reference.uri);
			// console.log(reference.range);
			// console.log(a);
			// a.line;

			references.sort((a, b) => {
				return a.fromRanges[0].start.line - b.fromRanges[0].start.line;
			});

			return references;
		}
	} else {
		console.log("No references found");
	}
}

function getStartAndEnd(document, headerLine, references, isClass) {
	console.log("headerline: ", headerLine);
	let initialIndent =
		document.lineAt(headerLine).firstNonWhitespaceCharacterIndex;
	if (isClass) {
		let i = headerLine + 1;
		while (document.lineAt(i).isEmptyOrWhitespace) i += 1;
		console.log("i: ", i);
		initialIndent = document.lineAt(i).firstNonWhitespaceCharacterIndex;
		if (
			document.lineAt(headerLine).firstNonWhitespaceCharacterIndex ===
			initialIndent
		)
			return headerLine, i;
	}
	console.log("initialIndent: ", initialIndent);

	// console.log("headerline: ", headerLine);
	let start = references[0].fromRanges[0].start.line;
	console.log("start: ", start, "type: ", typeof start);
	let end = references[references.length - 1].fromRanges[0].start.line;
	console.log("end: ", end, "type: ", typeof end);
	// const cand = -1;

	while (start > headerLine) {
		const line = document.lineAt(start);
		console.log(line);
		if (
			!line.isEmptyOrWhitespace &&
			line.firstNonWhitespaceCharacterIndex <= initialIndent
		)
			break;
		// console.log(start);
		start--;
	}
	console.log("start: ", start);

	// let isClass = false;
	// if (start != headerLine) {
	// 	let tmp = start;
	// 	while (tmp < headerLine) {
	// 		if (!document.lineAt(tmp).isEmptyOrWhitespace) isClass = true;
	// 		tmp++;
	// 	}
	// }

	while (end < document.lineCount - 1) {
		const line = document.lineAt(end);
		if (
			!line.isEmptyOrWhitespace &&
			line.firstNonWhitespaceCharacterIndex <= initialIndent
		)
			break;
		end++;
	}

	return [start, end - 1];

	// references.forEach(async (reference) => {
	// 	console.log(reference);
	// 	// console.log(reference.uri);
	// 	// console.log(reference.range);
	// 	reference;
	// 	console.log(reference.to.uri.path);
	// 	console.log(reference.to.range.start);
	// 	console.log(reference.to.range.end);
	// });
}

function getStartAndEndNoRef(document, headerLine, isClass, currModule) {
	let i = headerLine + 1;
	if (isClass) {
		const classIndent =
			document.lineAt(headerLine).firstNonWhitespaceCharacterIndex;
		while (document.lineAt(i).isEmptyOrWhitespace) i += 1;
		const initialIndent = document.lineAt(i).firstNonWhitespaceCharacterIndex;
		while (i < document.lineCount - 1) {
			const line = document.lineAt(i);
			if (
				!line.isEmptyOrWhitespace &&
				line.firstNonWhitespaceCharacterIndex <= classIndent
			)
				return [null, null];
			if (line.firstNonWhitespaceCharacterIndex === initialIndent) {
				if (currModule.has(i)) {
					i = currModule.get(i).get("end") + 1;
				} else {
					const className = /\bclass\s(\w+)/.exec(document.lineAt(i).text)[1];
					if (isConstructor(document, className, i)) {
						const start = i;
						while (i < document.lineCount - 1) {
							const line = document.lineAt(i);
							if (
								!line.isEmptyOrWhitespace &&
								line.firstNonWhitespaceCharacterIndex <= initialIndent
							)
								break;
							i++;
						}
						return [start, i - 1];
					} else {
						//if it is not a constructor, then it is an unknown standalone function
						//ideally we can insert nodes here to avoid rerunning the dfs, but to be implemented.
					}
				}
			}
			i++;
		}
		// if (
		// 	document.lineAt(headerLine).firstNonWhitespaceCharacterIndex ===
		// 	document.lineAt(i).firstNonWhitespaceCharacterIndex
		// )
		// 	return headerLine, i;
	} else {
		const initialIndent =
			document.lineAt(headerLine).firstNonWhitespaceCharacterIndex;
		const start = headerLine;
		while (i < document.lineCount - 1) {
			const line = document.lineAt(i);
			if (
				!line.isEmptyOrWhitespace &&
				line.firstNonWhitespaceCharacterIndex <= initialIndent
			)
				break;
			i++;
		}
		return [start, i - 1];
	}
}

function isConstructor(document, className, i) {
	return (
		((document.languageId === "java" ||
			document.languageId === "csharp" ||
			document.languageId === "cpp" ||
			document.languageId === "kotlin") &&
			new RegExp(`\b${className}(`).test(document.lineAt(i).text)) ||
		((document.languageId === "javascript" ||
			document.languageId === "typescript") &&
			new RegExp(`\bconstructor(`).test(document.lineAt(i).text)) ||
		(document.languageId === "python" &&
			new RegExp(`\b__init__(`).test(document.lineAt(i).text)) ||
		(document.languageId === "swift" &&
			new RegExp(`\binit(`).test(document.lineAt(i).text)) ||
		(document.languageId === "php" &&
			new RegExp(`\b__construct(`).test(document.lineAt(i).text))
	);
}

// This method is called when your extension is deactivated
function deactivate() {
	//remember to stop other running processes
}

module.exports = {
	activate,
	deactivate,
};
