#!/usr/bin/env npx tsx
/**
 * Build-time check: Ensure <Box> is never nested inside <Text>
 *
 * This catches the Ink error: "<Box> can't be nested inside <Text> component"
 *
 * Usage:
 *   npx tsx scripts/check-box-in-text.ts [directory]
 *   # or add to package.json scripts:
 *   # "lint:ink": "tsx scripts/check-box-in-text.ts src"
 */

import * as fs from "fs";
import * as path from "path";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import type { JSXElement, JSXOpeningElement } from "@babel/types";

interface Violation {
	file: string;
	line: number;
	column: number;
	message: string;
}

function getElementName(openingElement: JSXOpeningElement): string | null {
	if (openingElement.name.type === "JSXIdentifier") {
		return openingElement.name.name;
	}
	return null;
}

function isInsideTextElement(path: NodePath<JSXElement>): boolean {
	let parent = path.parentPath;
	while (parent) {
		if (
			parent.isJSXElement() &&
			parent.node.openingElement.name.type === "JSXIdentifier" &&
			parent.node.openingElement.name.name === "Text"
		) {
			return true;
		}
		parent = parent.parentPath;
	}
	return false;
}

function checkFile(filePath: string): Violation[] {
	const violations: Violation[] = [];
	const code = fs.readFileSync(filePath, "utf-8");

	let ast;
	try {
		ast = parse(code, {
			sourceType: "module",
			plugins: ["jsx", "typescript"],
		});
	} catch {
		// Skip files that can't be parsed
		return violations;
	}

	traverse(ast, {
		JSXElement(path) {
			const elementName = getElementName(path.node.openingElement);

			if (elementName === "Box" && isInsideTextElement(path)) {
				const loc = path.node.loc;
				violations.push({
					file: filePath,
					line: loc?.start.line ?? 0,
					column: loc?.start.column ?? 0,
					message: "<Box> can't be nested inside <Text> component",
				});
			}
		},
	});

	return violations;
}

function findTsxFiles(dir: string): string[] {
	const files: string[] = [];

	function walk(currentDir: string) {
		const entries = fs.readdirSync(currentDir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(currentDir, entry.name);
			if (entry.isDirectory()) {
				// Skip node_modules and hidden directories
				if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
					walk(fullPath);
				}
			} else if (entry.isFile() && /\.(tsx|jsx)$/.test(entry.name)) {
				files.push(fullPath);
			}
		}
	}

	walk(dir);
	return files;
}

function main() {
	const targetDir = process.argv[2] || "src";

	if (!fs.existsSync(targetDir)) {
		console.error(`Directory not found: ${targetDir}`);
		process.exit(1);
	}

	console.log(`Checking for <Box> inside <Text> violations in ${targetDir}...`);

	const files = findTsxFiles(targetDir);
	const allViolations: Violation[] = [];

	for (const file of files) {
		const violations = checkFile(file);
		allViolations.push(...violations);
	}

	if (allViolations.length > 0) {
		console.error(`\nFound ${allViolations.length} violation(s):\n`);
		for (const v of allViolations) {
			console.error(`  ${v.file}:${v.line}:${v.column}`);
			console.error(`    ${v.message}\n`);
		}
		process.exit(1);
	}

	console.log(`Checked ${files.length} files - no violations found.`);
	process.exit(0);
}

main();
