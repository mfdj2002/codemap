// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import { get } from "http";

// import vscode from "vscode"
const spawn = require("child_process").spawn;
const vscode = require("vscode");
const rangetree = require("avl-range-tree");
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

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
	// first check if there is an existing json cache
	let avlIntervalTree = JSON.parse(path.join(__dirname, "codemap-cache.json"));

	const summarizer = spawn("python", [path.join(__dirname, "summarizer.py")]);
	// Handle data received from Python
	summarizer.stdout.on("data", (data) => {
		console.log(`Received data from Python: ${data}`);
	});

	// Send data to Python
	summarizer.stdin.write("Hello from JavaScript\n");

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
	let activeEditor = vscode.window.activeTextEditor;
	vscode.window.onDidChangeActiveTextEditor(
		(editor) => {
			if (editor) {
				activeEditor = editor;
				console.log(`Active editor changed: ${editor.document.fileName}`);
				// Add more logic here if needed
			}
		},
		null,
		context.subscriptions
	);

	let highlight = vscode.window.onDidChangeTextEditorSelection(
		async (event) => {
			if (event.selections.length > 0) {
				const document = event.textEditor.document;
				const selection = event.selections[0]; // Get the first selection
				if (!selection.isEmpty) {
					// Selection is not empty, so something is highlighted
					console.log(`Selected text: ${selection}`);
					// Add your logic here to handle the highlight

					// const selection = event.selections[0]; //doesn't handle multiple highlights..

					let currContext = [];
					// Handle the highlighted text
					const defLocation = await getDefinition(document, selection.active);
					console.log(defLocation.uri.fsPath);
					console.log(defLocation.range.start);
					console.log(defLocation.range.end);

					const defReferences = await getReferences(document, selection.active);
					// summarizer.stdin.write(defLocation.uri.fsPath);
				}
			}
		}
	);

	context.subscriptions.push(highlight);
}

async function getDefinition(document, selection) {
	const start = performance.now();
	try {
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
				location = new vscode.Location(
					location.targetUri,
					location.targetRange
				);
			}
		});
		console.log("Definitions found:");
		console.log(definitions);

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
	} catch (error) {
		console.error("Error getting definitions:", error);
	} finally {
		const end = performance.now();
		console.log(`Function execution time: ${end - start} milliseconds`);
	}
}

async function getReferences() {
	vscode.prepareCallHierarchy;
}

// This method is called when your extension is deactivated
function deactivate() {
	//remember to stop other running processes
}

module.exports = {
	activate,
	deactivate,
};
