// vite.config.js
import path3 from "node:path";
import react from "file:///C:/Users/Cykes/Desktop/Espol/sistema-gestion-adr/node_modules/@vitejs/plugin-react/dist/index.mjs";
import { createLogger, defineConfig } from "file:///C:/Users/Cykes/Desktop/Espol/sistema-gestion-adr/node_modules/vite/dist/node/index.js";

// plugins/visual-editor/vite-plugin-react-inline-editor.js
import path2 from "path";
import { parse as parse2 } from "file:///C:/Users/Cykes/Desktop/Espol/sistema-gestion-adr/node_modules/@babel/parser/lib/index.js";
import traverseBabel2 from "file:///C:/Users/Cykes/Desktop/Espol/sistema-gestion-adr/node_modules/@babel/traverse/lib/index.js";
import * as t from "file:///C:/Users/Cykes/Desktop/Espol/sistema-gestion-adr/node_modules/@babel/types/lib/index.js";
import fs2 from "fs";

// plugins/utils/ast-utils.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import generate from "file:///C:/Users/Cykes/Desktop/Espol/sistema-gestion-adr/node_modules/@babel/generator/lib/index.js";
import { parse } from "file:///C:/Users/Cykes/Desktop/Espol/sistema-gestion-adr/node_modules/@babel/parser/lib/index.js";
import traverseBabel from "file:///C:/Users/Cykes/Desktop/Espol/sistema-gestion-adr/node_modules/@babel/traverse/lib/index.js";
import {
  isJSXIdentifier,
  isJSXMemberExpression
} from "file:///C:/Users/Cykes/Desktop/Espol/sistema-gestion-adr/node_modules/@babel/types/lib/index.js";
var __vite_injected_original_import_meta_url = "file:///C:/Users/Cykes/Desktop/Espol/sistema-gestion-adr/plugins/utils/ast-utils.js";
var __filename = fileURLToPath(__vite_injected_original_import_meta_url);
var __dirname2 = path.dirname(__filename);
var VITE_PROJECT_ROOT = path.resolve(__dirname2, "../..");
function validateFilePath(filePath) {
  if (!filePath) {
    return { isValid: false, error: "Missing filePath" };
  }
  const absoluteFilePath = path.resolve(VITE_PROJECT_ROOT, filePath);
  if (filePath.includes("..") || !absoluteFilePath.startsWith(VITE_PROJECT_ROOT) || absoluteFilePath.includes("node_modules")) {
    return { isValid: false, error: "Invalid path" };
  }
  if (!fs.existsSync(absoluteFilePath)) {
    return { isValid: false, error: "File not found" };
  }
  return { isValid: true, absolutePath: absoluteFilePath };
}
function parseFileToAST(absoluteFilePath) {
  const content = fs.readFileSync(absoluteFilePath, "utf-8");
  return parse(content, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
    errorRecovery: true
  });
}
function findJSXElementAtPosition(ast, line, column) {
  let targetNodePath = null;
  let closestNodePath = null;
  let closestDistance = Infinity;
  const allNodesOnLine = [];
  const visitor = {
    JSXOpeningElement(path4) {
      const node = path4.node;
      if (node.loc) {
        if (node.loc.start.line === line && Math.abs(node.loc.start.column - column) <= 1) {
          targetNodePath = path4;
          path4.stop();
          return;
        }
        if (node.loc.start.line === line) {
          allNodesOnLine.push({
            path: path4,
            column: node.loc.start.column,
            distance: Math.abs(node.loc.start.column - column)
          });
        }
        if (node.loc.start.line === line) {
          const distance = Math.abs(node.loc.start.column - column);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestNodePath = path4;
          }
        }
      }
    },
    // Also check JSXElement nodes that contain the position
    JSXElement(path4) {
      var _a;
      const node = path4.node;
      if (!node.loc) {
        return;
      }
      if (node.loc.start.line > line || node.loc.end.line < line) {
        return;
      }
      if (!((_a = path4.node.openingElement) == null ? void 0 : _a.loc)) {
        return;
      }
      const openingLine = path4.node.openingElement.loc.start.line;
      const openingCol = path4.node.openingElement.loc.start.column;
      if (openingLine === line) {
        const distance = Math.abs(openingCol - column);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestNodePath = path4.get("openingElement");
        }
        return;
      }
      if (openingLine < line) {
        const distance = (line - openingLine) * 100;
        if (distance < closestDistance) {
          closestDistance = distance;
          closestNodePath = path4.get("openingElement");
        }
      }
    }
  };
  traverseBabel.default(ast, visitor);
  const threshold = closestDistance < 100 ? 50 : 500;
  return targetNodePath || (closestDistance <= threshold ? closestNodePath : null);
}
function generateCode(node, options = {}) {
  const generateFunction = generate.default || generate;
  const output = generateFunction(node, options);
  return output.code;
}
function generateSourceWithMap(ast, sourceFileName, originalCode) {
  const generateFunction = generate.default || generate;
  return generateFunction(ast, {
    sourceMaps: true,
    sourceFileName
  }, originalCode);
}

// plugins/visual-editor/vite-plugin-react-inline-editor.js
var EDITABLE_HTML_TAGS = ["a", "Button", "button", "p", "span", "h1", "h2", "h3", "h4", "h5", "h6", "label", "Label", "img"];
function parseEditId(editId) {
  const parts = editId.split(":");
  if (parts.length < 3) {
    return null;
  }
  const column = parseInt(parts.at(-1), 10);
  const line = parseInt(parts.at(-2), 10);
  const filePath = parts.slice(0, -2).join(":");
  if (!filePath || isNaN(line) || isNaN(column)) {
    return null;
  }
  return { filePath, line, column };
}
function checkTagNameEditable(openingElementNode, editableTagsList) {
  if (!openingElementNode || !openingElementNode.name)
    return false;
  const nameNode = openingElementNode.name;
  if (nameNode.type === "JSXIdentifier" && editableTagsList.includes(nameNode.name)) {
    return true;
  }
  if (nameNode.type === "JSXMemberExpression" && nameNode.property && nameNode.property.type === "JSXIdentifier" && editableTagsList.includes(nameNode.property.name)) {
    return true;
  }
  return false;
}
function validateImageSrc(openingNode) {
  var _a;
  if (!openingNode || !openingNode.name || openingNode.name.name !== "img" && ((_a = openingNode.name.property) == null ? void 0 : _a.name) !== "img") {
    return { isValid: true, reason: null };
  }
  const hasPropsSpread = openingNode.attributes.some(
    (attr) => t.isJSXSpreadAttribute(attr) && attr.argument && t.isIdentifier(attr.argument) && attr.argument.name === "props"
  );
  if (hasPropsSpread) {
    return { isValid: false, reason: "props-spread" };
  }
  const srcAttr = openingNode.attributes.find(
    (attr) => t.isJSXAttribute(attr) && attr.name && attr.name.name === "src"
  );
  if (!srcAttr) {
    return { isValid: false, reason: "missing-src" };
  }
  if (!t.isStringLiteral(srcAttr.value)) {
    return { isValid: false, reason: "dynamic-src" };
  }
  if (!srcAttr.value.value || srcAttr.value.value.trim() === "") {
    return { isValid: false, reason: "empty-src" };
  }
  return { isValid: true, reason: null };
}
function inlineEditPlugin() {
  return {
    name: "vite-inline-edit-plugin",
    enforce: "pre",
    transform(code, id) {
      if (!/\.(jsx|tsx)$/.test(id) || !id.startsWith(VITE_PROJECT_ROOT) || id.includes("node_modules")) {
        return null;
      }
      const relativeFilePath = path2.relative(VITE_PROJECT_ROOT, id);
      const webRelativeFilePath = relativeFilePath.split(path2.sep).join("/");
      try {
        const babelAst = parse2(code, {
          sourceType: "module",
          plugins: ["jsx", "typescript"],
          errorRecovery: true
        });
        let attributesAdded = 0;
        traverseBabel2.default(babelAst, {
          enter(path4) {
            if (path4.isJSXOpeningElement()) {
              const openingNode = path4.node;
              const elementNode = path4.parentPath.node;
              if (!openingNode.loc) {
                return;
              }
              const alreadyHasId = openingNode.attributes.some(
                (attr) => t.isJSXAttribute(attr) && attr.name.name === "data-edit-id"
              );
              if (alreadyHasId) {
                return;
              }
              const isCurrentElementEditable = checkTagNameEditable(openingNode, EDITABLE_HTML_TAGS);
              if (!isCurrentElementEditable) {
                return;
              }
              const imageValidation = validateImageSrc(openingNode);
              if (!imageValidation.isValid) {
                const disabledAttribute = t.jsxAttribute(
                  t.jsxIdentifier("data-edit-disabled"),
                  t.stringLiteral("true")
                );
                openingNode.attributes.push(disabledAttribute);
                attributesAdded++;
                return;
              }
              let shouldBeDisabledDueToChildren = false;
              if (t.isJSXElement(elementNode) && elementNode.children) {
                const hasPropsSpread = openingNode.attributes.some(
                  (attr) => t.isJSXSpreadAttribute(attr) && attr.argument && t.isIdentifier(attr.argument) && attr.argument.name === "props"
                );
                const hasDynamicChild = elementNode.children.some(
                  (child) => t.isJSXExpressionContainer(child)
                );
                if (hasDynamicChild || hasPropsSpread) {
                  shouldBeDisabledDueToChildren = true;
                }
              }
              if (!shouldBeDisabledDueToChildren && t.isJSXElement(elementNode) && elementNode.children) {
                const hasEditableJsxChild = elementNode.children.some((child) => {
                  if (t.isJSXElement(child)) {
                    return checkTagNameEditable(child.openingElement, EDITABLE_HTML_TAGS);
                  }
                  return false;
                });
                if (hasEditableJsxChild) {
                  shouldBeDisabledDueToChildren = true;
                }
              }
              if (shouldBeDisabledDueToChildren) {
                const disabledAttribute = t.jsxAttribute(
                  t.jsxIdentifier("data-edit-disabled"),
                  t.stringLiteral("true")
                );
                openingNode.attributes.push(disabledAttribute);
                attributesAdded++;
                return;
              }
              if (t.isJSXElement(elementNode) && elementNode.children && elementNode.children.length > 0) {
                let hasNonEditableJsxChild = false;
                for (const child of elementNode.children) {
                  if (t.isJSXElement(child)) {
                    if (!checkTagNameEditable(child.openingElement, EDITABLE_HTML_TAGS)) {
                      hasNonEditableJsxChild = true;
                      break;
                    }
                  }
                }
                if (hasNonEditableJsxChild) {
                  const disabledAttribute = t.jsxAttribute(
                    t.jsxIdentifier("data-edit-disabled"),
                    t.stringLiteral("true")
                  );
                  openingNode.attributes.push(disabledAttribute);
                  attributesAdded++;
                  return;
                }
              }
              let currentAncestorCandidatePath = path4.parentPath.parentPath;
              while (currentAncestorCandidatePath) {
                const ancestorJsxElementPath = currentAncestorCandidatePath.isJSXElement() ? currentAncestorCandidatePath : currentAncestorCandidatePath.findParent((p) => p.isJSXElement());
                if (!ancestorJsxElementPath) {
                  break;
                }
                if (checkTagNameEditable(ancestorJsxElementPath.node.openingElement, EDITABLE_HTML_TAGS)) {
                  return;
                }
                currentAncestorCandidatePath = ancestorJsxElementPath.parentPath;
              }
              const line = openingNode.loc.start.line;
              const column = openingNode.loc.start.column + 1;
              const editId = `${webRelativeFilePath}:${line}:${column}`;
              const idAttribute = t.jsxAttribute(
                t.jsxIdentifier("data-edit-id"),
                t.stringLiteral(editId)
              );
              openingNode.attributes.push(idAttribute);
              attributesAdded++;
            }
          }
        });
        if (attributesAdded > 0) {
          const output = generateSourceWithMap(babelAst, webRelativeFilePath, code);
          return { code: output.code, map: output.map };
        }
        return null;
      } catch (error) {
        console.error(`[vite][visual-editor] Error transforming ${id}:`, error);
        return null;
      }
    },
    // Updates source code based on the changes received from the client
    configureServer(server) {
      server.middlewares.use("/api/apply-edit", async (req, res, next) => {
        if (req.method !== "POST")
          return next();
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", async () => {
          var _a;
          let absoluteFilePath = "";
          try {
            const { editId, newFullText } = JSON.parse(body);
            if (!editId || typeof newFullText === "undefined") {
              res.writeHead(400, { "Content-Type": "application/json" });
              return res.end(JSON.stringify({ error: "Missing editId or newFullText" }));
            }
            const parsedId = parseEditId(editId);
            if (!parsedId) {
              res.writeHead(400, { "Content-Type": "application/json" });
              return res.end(JSON.stringify({ error: "Invalid editId format (filePath:line:column)" }));
            }
            const { filePath, line, column } = parsedId;
            const validation = validateFilePath(filePath);
            if (!validation.isValid) {
              res.writeHead(400, { "Content-Type": "application/json" });
              return res.end(JSON.stringify({ error: validation.error }));
            }
            absoluteFilePath = validation.absolutePath;
            const originalContent = fs2.readFileSync(absoluteFilePath, "utf-8");
            const babelAst = parseFileToAST(absoluteFilePath);
            const targetNodePath = findJSXElementAtPosition(babelAst, line, column + 1);
            if (!targetNodePath) {
              res.writeHead(404, { "Content-Type": "application/json" });
              return res.end(JSON.stringify({ error: "Target node not found by line/column", editId }));
            }
            const targetOpeningElement = targetNodePath.node;
            const parentElementNode = (_a = targetNodePath.parentPath) == null ? void 0 : _a.node;
            const isImageElement = targetOpeningElement.name && targetOpeningElement.name.name === "img";
            let beforeCode = "";
            let afterCode = "";
            let modified = false;
            if (isImageElement) {
              beforeCode = generateCode(targetOpeningElement);
              const srcAttr = targetOpeningElement.attributes.find(
                (attr) => t.isJSXAttribute(attr) && attr.name && attr.name.name === "src"
              );
              if (srcAttr && t.isStringLiteral(srcAttr.value)) {
                srcAttr.value = t.stringLiteral(newFullText);
                modified = true;
                afterCode = generateCode(targetOpeningElement);
              }
            } else {
              if (parentElementNode && t.isJSXElement(parentElementNode)) {
                beforeCode = generateCode(parentElementNode);
                parentElementNode.children = [];
                if (newFullText && newFullText.trim() !== "") {
                  const newTextNode = t.jsxText(newFullText);
                  parentElementNode.children.push(newTextNode);
                }
                modified = true;
                afterCode = generateCode(parentElementNode);
              }
            }
            if (!modified) {
              res.writeHead(409, { "Content-Type": "application/json" });
              return res.end(JSON.stringify({ error: "Could not apply changes to AST." }));
            }
            const webRelativeFilePath = path2.relative(VITE_PROJECT_ROOT, absoluteFilePath).split(path2.sep).join("/");
            const output = generateSourceWithMap(babelAst, webRelativeFilePath, originalContent);
            const newContent = output.code;
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              success: true,
              newFileContent: newContent,
              beforeCode,
              afterCode
            }));
          } catch (error) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error during edit application." }));
          }
        });
      });
    }
  };
}

// plugins/visual-editor/vite-plugin-edit-mode.js
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";

// plugins/visual-editor/visual-editor-config.js
var EDIT_MODE_STYLES = `
	#root[data-edit-mode-enabled="true"] [data-edit-id] {
		cursor: pointer; 
		outline: 2px dashed #357DF9; 
		outline-offset: 2px;
		min-height: 1em;
	}
	#root[data-edit-mode-enabled="true"] img[data-edit-id] {
		outline-offset: -2px;
	}
	#root[data-edit-mode-enabled="true"] {
		cursor: pointer;
	}
	#root[data-edit-mode-enabled="true"] [data-edit-id]:hover {
		background-color: #357DF933;
		outline-color: #357DF9; 
	}

	@keyframes fadeInTooltip {
		from {
			opacity: 0;
			transform: translateY(5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	#inline-editor-disabled-tooltip {
		display: none; 
		opacity: 0; 
		position: absolute;
		background-color: #1D1E20;
		color: white;
		padding: 4px 8px;
		border-radius: 8px;
		z-index: 10001;
		font-size: 14px;
		border: 1px solid #3B3D4A;
		max-width: 184px;
		text-align: center;
	}

	#inline-editor-disabled-tooltip.tooltip-active {
		display: block;
		animation: fadeInTooltip 0.2s ease-out forwards;
	}
`;

// plugins/visual-editor/vite-plugin-edit-mode.js
var __vite_injected_original_import_meta_url2 = "file:///C:/Users/Cykes/Desktop/Espol/sistema-gestion-adr/plugins/visual-editor/vite-plugin-edit-mode.js";
var __filename2 = fileURLToPath2(__vite_injected_original_import_meta_url2);
var __dirname3 = resolve(__filename2, "..");
function inlineEditDevPlugin() {
  return {
    name: "vite:inline-edit-dev",
    apply: "serve",
    transformIndexHtml() {
      const scriptPath = resolve(__dirname3, "edit-mode-script.js");
      const scriptContent = readFileSync(scriptPath, "utf-8");
      return [
        {
          tag: "script",
          attrs: { type: "module" },
          children: scriptContent,
          injectTo: "body"
        },
        {
          tag: "style",
          children: EDIT_MODE_STYLES,
          injectTo: "head"
        }
      ];
    }
  };
}

// plugins/vite-plugin-iframe-route-restoration.js
function iframeRouteRestorationPlugin() {
  return {
    name: "vite:iframe-route-restoration",
    apply: "serve",
    transformIndexHtml() {
      const script = `
      const ALLOWED_PARENT_ORIGINS = [
          "https://horizons.hostinger.com",
          "https://horizons.hostinger.dev",
          "https://horizons-frontend-local.hostinger.dev",
      ];

        // Check to see if the page is in an iframe
        if (window.self !== window.top) {
          const STORAGE_KEY = 'horizons-iframe-saved-route';

          const getCurrentRoute = () => location.pathname + location.search + location.hash;

          const save = () => {
            try {
              const currentRoute = getCurrentRoute();
              sessionStorage.setItem(STORAGE_KEY, currentRoute);
              window.parent.postMessage({message: 'route-changed', route: currentRoute}, '*');
            } catch {}
          };

          const replaceHistoryState = (url) => {
            try {
              history.replaceState(null, '', url);
              window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
              return true;
            } catch {}
            return false;
          };

          const restore = () => {
            try {
              const saved = sessionStorage.getItem(STORAGE_KEY);
              if (!saved) return;

              if (!saved.startsWith('/')) {
                sessionStorage.removeItem(STORAGE_KEY);
                return;
              }

              const current = getCurrentRoute();
              if (current !== saved) {
                if (!replaceHistoryState(saved)) {
                  replaceHistoryState('/');
                }

                requestAnimationFrame(() => setTimeout(() => {
                  try {
                    const text = (document.body?.innerText || '').trim();

                    // If the restored route results in too little content, assume it is invalid and navigate home
                    if (text.length < 50) {
                      replaceHistoryState('/');
                    }
                  } catch {}
                }, 1000));
              }
            } catch {}
          };

          const originalPushState = history.pushState;
          history.pushState = function(...args) {
            originalPushState.apply(this, args);
            save();
          };

          const originalReplaceState = history.replaceState;
          history.replaceState = function(...args) {
            originalReplaceState.apply(this, args);
            save();
          };

          const getParentOrigin = () => {
              if (
                  window.location.ancestorOrigins &&
                  window.location.ancestorOrigins.length > 0
              ) {
                  return window.location.ancestorOrigins[0];
              }

              if (document.referrer) {
                  try {
                      return new URL(document.referrer).origin;
                  } catch (e) {
                      console.warn("Invalid referrer URL:", document.referrer);
                  }
              }

              return null;
          };

          window.addEventListener('popstate', save);
          window.addEventListener('hashchange', save);
          window.addEventListener("message", function (event) {
              const parentOrigin = getParentOrigin();

              if (event.data?.type === "redirect-home" && parentOrigin && ALLOWED_PARENT_ORIGINS.includes(parentOrigin)) {
                const saved = sessionStorage.getItem(STORAGE_KEY);

                if(saved && saved !== '/') {
                  replaceHistoryState('/')
                }
              }
          });

          restore();
        }
      `;
      return [
        {
          tag: "script",
          attrs: { type: "module" },
          children: script,
          injectTo: "head"
        }
      ];
    }
  };
}

// plugins/selection-mode/vite-plugin-selection-mode.js
import { readFileSync as readFileSync2 } from "node:fs";
import { resolve as resolve2 } from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";
var __vite_injected_original_import_meta_url3 = "file:///C:/Users/Cykes/Desktop/Espol/sistema-gestion-adr/plugins/selection-mode/vite-plugin-selection-mode.js";
var __filename3 = fileURLToPath3(__vite_injected_original_import_meta_url3);
var __dirname4 = resolve2(__filename3, "..");
function selectionModePlugin() {
  return {
    name: "vite:selection-mode",
    apply: "serve",
    transformIndexHtml() {
      const scriptPath = resolve2(__dirname4, "selection-mode-script.js");
      const scriptContent = readFileSync2(scriptPath, "utf-8");
      return [
        {
          tag: "script",
          attrs: { type: "module" },
          children: scriptContent,
          injectTo: "body"
        }
      ];
    }
  };
}

// vite.config.js
var __vite_injected_original_dirname = "C:\\Users\\Cykes\\Desktop\\Espol\\sistema-gestion-adr";
var isDev = process.env.NODE_ENV !== "production";
var configHorizonsViteErrorHandler = `
const observer = new MutationObserver((mutations) => {
	for (const mutation of mutations) {
		for (const addedNode of mutation.addedNodes) {
			if (
				addedNode.nodeType === Node.ELEMENT_NODE &&
				(
					addedNode.tagName?.toLowerCase() === 'vite-error-overlay' ||
					addedNode.classList?.contains('backdrop')
				)
			) {
				handleViteOverlay(addedNode);
			}
		}
	}
});

observer.observe(document.documentElement, {
	childList: true,
	subtree: true
});

function handleViteOverlay(node) {
	if (!node.shadowRoot) {
		return;
	}

	const backdrop = node.shadowRoot.querySelector('.backdrop');

	if (backdrop) {
		const overlayHtml = backdrop.outerHTML;
		const parser = new DOMParser();
		const doc = parser.parseFromString(overlayHtml, 'text/html');
		const messageBodyElement = doc.querySelector('.message-body');
		const fileElement = doc.querySelector('.file');
		const messageText = messageBodyElement ? messageBodyElement.textContent.trim() : '';
		const fileText = fileElement ? fileElement.textContent.trim() : '';
		const error = messageText + (fileText ? ' File:' + fileText : '');

		window.parent.postMessage({
			type: 'horizons-vite-error',
			error,
		}, '*');
	}
}
`;
var configHorizonsRuntimeErrorHandler = `
window.onerror = (message, source, lineno, colno, errorObj) => {
	const errorDetails = errorObj ? JSON.stringify({
		name: errorObj.name,
		message: errorObj.message,
		stack: errorObj.stack,
		source,
		lineno,
		colno,
	}) : null;

	window.parent.postMessage({
		type: 'horizons-runtime-error',
		message,
		error: errorDetails
	}, '*');
};
`;
var configHorizonsConsoleErrroHandler = `
const originalConsoleError = console.error;
console.error = function(...args) {
	originalConsoleError.apply(console, args);

	let errorString = '';

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg instanceof Error) {
			errorString = arg.stack || \`\${arg.name}: \${arg.message}\`;
			break;
		}
	}

	if (!errorString) {
		errorString = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
	}

	window.parent.postMessage({
		type: 'horizons-console-error',
		error: errorString
	}, '*');
};
`;
var configWindowFetchMonkeyPatch = `
const originalFetch = window.fetch;

window.fetch = function(...args) {
	const url = args[0] instanceof Request ? args[0].url : args[0];

	// Skip WebSocket URLs
	if (url.startsWith('ws:') || url.startsWith('wss:')) {
		return originalFetch.apply(this, args);
	}

	return originalFetch.apply(this, args)
		.then(async response => {
			const contentType = response.headers.get('Content-Type') || '';

			// Exclude HTML document responses
			const isDocumentResponse =
				contentType.includes('text/html') ||
				contentType.includes('application/xhtml+xml');

			if (!response.ok && !isDocumentResponse) {
					const responseClone = response.clone();
					const errorFromRes = await responseClone.text();
					const requestUrl = response.url;
					console.error(\`Fetch error from \${requestUrl}: \${errorFromRes}\`);
			}

			return response;
		})
		.catch(error => {
			if (!url.match(/.html?$/i)) {
				console.error(error);
			}

			throw error;
		});
};
`;
var configNavigationHandler = `
if (window.navigation && window.self !== window.top) {
	window.navigation.addEventListener('navigate', (event) => {
		const url = event.destination.url;

		try {
			const destinationUrl = new URL(url);
			const destinationOrigin = destinationUrl.origin;
			const currentOrigin = window.location.origin;

			if (destinationOrigin === currentOrigin) {
				return;
			}
		} catch (error) {
			return;
		}

		window.parent.postMessage({
			type: 'horizons-navigation-error',
			url,
		}, '*');
	});
}
`;
var addTransformIndexHtml = {
  name: "add-transform-index-html",
  transformIndexHtml(html) {
    const tags = [
      {
        tag: "script",
        attrs: { type: "module" },
        children: configHorizonsRuntimeErrorHandler,
        injectTo: "head"
      },
      {
        tag: "script",
        attrs: { type: "module" },
        children: configHorizonsViteErrorHandler,
        injectTo: "head"
      },
      {
        tag: "script",
        attrs: { type: "module" },
        children: configHorizonsConsoleErrroHandler,
        injectTo: "head"
      },
      {
        tag: "script",
        attrs: { type: "module" },
        children: configWindowFetchMonkeyPatch,
        injectTo: "head"
      },
      {
        tag: "script",
        attrs: { type: "module" },
        children: configNavigationHandler,
        injectTo: "head"
      }
    ];
    if (!isDev && process.env.TEMPLATE_BANNER_SCRIPT_URL && process.env.TEMPLATE_REDIRECT_URL) {
      tags.push(
        {
          tag: "script",
          attrs: {
            src: process.env.TEMPLATE_BANNER_SCRIPT_URL,
            "template-redirect-url": process.env.TEMPLATE_REDIRECT_URL
          },
          injectTo: "head"
        }
      );
    }
    return {
      html,
      tags
    };
  }
};
console.warn = () => {
};
var logger = createLogger();
var loggerError = logger.error;
logger.error = (msg, options) => {
  var _a;
  if ((_a = options == null ? void 0 : options.error) == null ? void 0 : _a.toString().includes("CssSyntaxError: [postcss]")) {
    return;
  }
  loggerError(msg, options);
};
var vite_config_default = defineConfig({
  customLogger: logger,
  plugins: [
    ...isDev ? [inlineEditPlugin(), inlineEditDevPlugin(), iframeRouteRestorationPlugin(), selectionModePlugin()] : [],
    react(),
    addTransformIndexHtml
  ],
  server: {
    cors: true,
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless"
    },
    allowedHosts: true
  },
  resolve: {
    extensions: [".jsx", ".js", ".tsx", ".ts", ".json"],
    alias: {
      "@": path3.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  build: {
    rollupOptions: {
      external: [
        "@babel/parser",
        "@babel/traverse",
        "@babel/generator",
        "@babel/types"
      ]
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiLCAicGx1Z2lucy92aXN1YWwtZWRpdG9yL3ZpdGUtcGx1Z2luLXJlYWN0LWlubGluZS1lZGl0b3IuanMiLCAicGx1Z2lucy91dGlscy9hc3QtdXRpbHMuanMiLCAicGx1Z2lucy92aXN1YWwtZWRpdG9yL3ZpdGUtcGx1Z2luLWVkaXQtbW9kZS5qcyIsICJwbHVnaW5zL3Zpc3VhbC1lZGl0b3IvdmlzdWFsLWVkaXRvci1jb25maWcuanMiLCAicGx1Z2lucy92aXRlLXBsdWdpbi1pZnJhbWUtcm91dGUtcmVzdG9yYXRpb24uanMiLCAicGx1Z2lucy9zZWxlY3Rpb24tbW9kZS92aXRlLXBsdWdpbi1zZWxlY3Rpb24tbW9kZS5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXEN5a2VzXFxcXERlc2t0b3BcXFxcRXNwb2xcXFxcc2lzdGVtYS1nZXN0aW9uLWFkclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQ3lrZXNcXFxcRGVza3RvcFxcXFxFc3BvbFxcXFxzaXN0ZW1hLWdlc3Rpb24tYWRyXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9DeWtlcy9EZXNrdG9wL0VzcG9sL3Npc3RlbWEtZ2VzdGlvbi1hZHIvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xyXG5pbXBvcnQgeyBjcmVhdGVMb2dnZXIsIGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnO1xyXG5pbXBvcnQgaW5saW5lRWRpdFBsdWdpbiBmcm9tICcuL3BsdWdpbnMvdmlzdWFsLWVkaXRvci92aXRlLXBsdWdpbi1yZWFjdC1pbmxpbmUtZWRpdG9yLmpzJztcclxuaW1wb3J0IGVkaXRNb2RlRGV2UGx1Z2luIGZyb20gJy4vcGx1Z2lucy92aXN1YWwtZWRpdG9yL3ZpdGUtcGx1Z2luLWVkaXQtbW9kZS5qcyc7XHJcbmltcG9ydCBpZnJhbWVSb3V0ZVJlc3RvcmF0aW9uUGx1Z2luIGZyb20gJy4vcGx1Z2lucy92aXRlLXBsdWdpbi1pZnJhbWUtcm91dGUtcmVzdG9yYXRpb24uanMnO1xyXG5pbXBvcnQgc2VsZWN0aW9uTW9kZVBsdWdpbiBmcm9tICcuL3BsdWdpbnMvc2VsZWN0aW9uLW1vZGUvdml0ZS1wbHVnaW4tc2VsZWN0aW9uLW1vZGUuanMnO1xyXG5cclxuY29uc3QgaXNEZXYgPSBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nO1xyXG5cclxuY29uc3QgY29uZmlnSG9yaXpvbnNWaXRlRXJyb3JIYW5kbGVyID0gYFxyXG5jb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKChtdXRhdGlvbnMpID0+IHtcclxuXHRmb3IgKGNvbnN0IG11dGF0aW9uIG9mIG11dGF0aW9ucykge1xyXG5cdFx0Zm9yIChjb25zdCBhZGRlZE5vZGUgb2YgbXV0YXRpb24uYWRkZWROb2Rlcykge1xyXG5cdFx0XHRpZiAoXHJcblx0XHRcdFx0YWRkZWROb2RlLm5vZGVUeXBlID09PSBOb2RlLkVMRU1FTlRfTk9ERSAmJlxyXG5cdFx0XHRcdChcclxuXHRcdFx0XHRcdGFkZGVkTm9kZS50YWdOYW1lPy50b0xvd2VyQ2FzZSgpID09PSAndml0ZS1lcnJvci1vdmVybGF5JyB8fFxyXG5cdFx0XHRcdFx0YWRkZWROb2RlLmNsYXNzTGlzdD8uY29udGFpbnMoJ2JhY2tkcm9wJylcclxuXHRcdFx0XHQpXHJcblx0XHRcdCkge1xyXG5cdFx0XHRcdGhhbmRsZVZpdGVPdmVybGF5KGFkZGVkTm9kZSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcbn0pO1xyXG5cclxub2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsIHtcclxuXHRjaGlsZExpc3Q6IHRydWUsXHJcblx0c3VidHJlZTogdHJ1ZVxyXG59KTtcclxuXHJcbmZ1bmN0aW9uIGhhbmRsZVZpdGVPdmVybGF5KG5vZGUpIHtcclxuXHRpZiAoIW5vZGUuc2hhZG93Um9vdCkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0Y29uc3QgYmFja2Ryb3AgPSBub2RlLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignLmJhY2tkcm9wJyk7XHJcblxyXG5cdGlmIChiYWNrZHJvcCkge1xyXG5cdFx0Y29uc3Qgb3ZlcmxheUh0bWwgPSBiYWNrZHJvcC5vdXRlckhUTUw7XHJcblx0XHRjb25zdCBwYXJzZXIgPSBuZXcgRE9NUGFyc2VyKCk7XHJcblx0XHRjb25zdCBkb2MgPSBwYXJzZXIucGFyc2VGcm9tU3RyaW5nKG92ZXJsYXlIdG1sLCAndGV4dC9odG1sJyk7XHJcblx0XHRjb25zdCBtZXNzYWdlQm9keUVsZW1lbnQgPSBkb2MucXVlcnlTZWxlY3RvcignLm1lc3NhZ2UtYm9keScpO1xyXG5cdFx0Y29uc3QgZmlsZUVsZW1lbnQgPSBkb2MucXVlcnlTZWxlY3RvcignLmZpbGUnKTtcclxuXHRcdGNvbnN0IG1lc3NhZ2VUZXh0ID0gbWVzc2FnZUJvZHlFbGVtZW50ID8gbWVzc2FnZUJvZHlFbGVtZW50LnRleHRDb250ZW50LnRyaW0oKSA6ICcnO1xyXG5cdFx0Y29uc3QgZmlsZVRleHQgPSBmaWxlRWxlbWVudCA/IGZpbGVFbGVtZW50LnRleHRDb250ZW50LnRyaW0oKSA6ICcnO1xyXG5cdFx0Y29uc3QgZXJyb3IgPSBtZXNzYWdlVGV4dCArIChmaWxlVGV4dCA/ICcgRmlsZTonICsgZmlsZVRleHQgOiAnJyk7XHJcblxyXG5cdFx0d2luZG93LnBhcmVudC5wb3N0TWVzc2FnZSh7XHJcblx0XHRcdHR5cGU6ICdob3Jpem9ucy12aXRlLWVycm9yJyxcclxuXHRcdFx0ZXJyb3IsXHJcblx0XHR9LCAnKicpO1xyXG5cdH1cclxufVxyXG5gO1xyXG5cclxuY29uc3QgY29uZmlnSG9yaXpvbnNSdW50aW1lRXJyb3JIYW5kbGVyID0gYFxyXG53aW5kb3cub25lcnJvciA9IChtZXNzYWdlLCBzb3VyY2UsIGxpbmVubywgY29sbm8sIGVycm9yT2JqKSA9PiB7XHJcblx0Y29uc3QgZXJyb3JEZXRhaWxzID0gZXJyb3JPYmogPyBKU09OLnN0cmluZ2lmeSh7XHJcblx0XHRuYW1lOiBlcnJvck9iai5uYW1lLFxyXG5cdFx0bWVzc2FnZTogZXJyb3JPYmoubWVzc2FnZSxcclxuXHRcdHN0YWNrOiBlcnJvck9iai5zdGFjayxcclxuXHRcdHNvdXJjZSxcclxuXHRcdGxpbmVubyxcclxuXHRcdGNvbG5vLFxyXG5cdH0pIDogbnVsbDtcclxuXHJcblx0d2luZG93LnBhcmVudC5wb3N0TWVzc2FnZSh7XHJcblx0XHR0eXBlOiAnaG9yaXpvbnMtcnVudGltZS1lcnJvcicsXHJcblx0XHRtZXNzYWdlLFxyXG5cdFx0ZXJyb3I6IGVycm9yRGV0YWlsc1xyXG5cdH0sICcqJyk7XHJcbn07XHJcbmA7XHJcblxyXG5jb25zdCBjb25maWdIb3Jpem9uc0NvbnNvbGVFcnJyb0hhbmRsZXIgPSBgXHJcbmNvbnN0IG9yaWdpbmFsQ29uc29sZUVycm9yID0gY29uc29sZS5lcnJvcjtcclxuY29uc29sZS5lcnJvciA9IGZ1bmN0aW9uKC4uLmFyZ3MpIHtcclxuXHRvcmlnaW5hbENvbnNvbGVFcnJvci5hcHBseShjb25zb2xlLCBhcmdzKTtcclxuXHJcblx0bGV0IGVycm9yU3RyaW5nID0gJyc7XHJcblxyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xyXG5cdFx0Y29uc3QgYXJnID0gYXJnc1tpXTtcclxuXHRcdGlmIChhcmcgaW5zdGFuY2VvZiBFcnJvcikge1xyXG5cdFx0XHRlcnJvclN0cmluZyA9IGFyZy5zdGFjayB8fCBcXGBcXCR7YXJnLm5hbWV9OiBcXCR7YXJnLm1lc3NhZ2V9XFxgO1xyXG5cdFx0XHRicmVhaztcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlmICghZXJyb3JTdHJpbmcpIHtcclxuXHRcdGVycm9yU3RyaW5nID0gYXJncy5tYXAoYXJnID0+IHR5cGVvZiBhcmcgPT09ICdvYmplY3QnID8gSlNPTi5zdHJpbmdpZnkoYXJnKSA6IFN0cmluZyhhcmcpKS5qb2luKCcgJyk7XHJcblx0fVxyXG5cclxuXHR3aW5kb3cucGFyZW50LnBvc3RNZXNzYWdlKHtcclxuXHRcdHR5cGU6ICdob3Jpem9ucy1jb25zb2xlLWVycm9yJyxcclxuXHRcdGVycm9yOiBlcnJvclN0cmluZ1xyXG5cdH0sICcqJyk7XHJcbn07XHJcbmA7XHJcblxyXG5jb25zdCBjb25maWdXaW5kb3dGZXRjaE1vbmtleVBhdGNoID0gYFxyXG5jb25zdCBvcmlnaW5hbEZldGNoID0gd2luZG93LmZldGNoO1xyXG5cclxud2luZG93LmZldGNoID0gZnVuY3Rpb24oLi4uYXJncykge1xyXG5cdGNvbnN0IHVybCA9IGFyZ3NbMF0gaW5zdGFuY2VvZiBSZXF1ZXN0ID8gYXJnc1swXS51cmwgOiBhcmdzWzBdO1xyXG5cclxuXHQvLyBTa2lwIFdlYlNvY2tldCBVUkxzXHJcblx0aWYgKHVybC5zdGFydHNXaXRoKCd3czonKSB8fCB1cmwuc3RhcnRzV2l0aCgnd3NzOicpKSB7XHJcblx0XHRyZXR1cm4gb3JpZ2luYWxGZXRjaC5hcHBseSh0aGlzLCBhcmdzKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiBvcmlnaW5hbEZldGNoLmFwcGx5KHRoaXMsIGFyZ3MpXHJcblx0XHQudGhlbihhc3luYyByZXNwb25zZSA9PiB7XHJcblx0XHRcdGNvbnN0IGNvbnRlbnRUeXBlID0gcmVzcG9uc2UuaGVhZGVycy5nZXQoJ0NvbnRlbnQtVHlwZScpIHx8ICcnO1xyXG5cclxuXHRcdFx0Ly8gRXhjbHVkZSBIVE1MIGRvY3VtZW50IHJlc3BvbnNlc1xyXG5cdFx0XHRjb25zdCBpc0RvY3VtZW50UmVzcG9uc2UgPVxyXG5cdFx0XHRcdGNvbnRlbnRUeXBlLmluY2x1ZGVzKCd0ZXh0L2h0bWwnKSB8fFxyXG5cdFx0XHRcdGNvbnRlbnRUeXBlLmluY2x1ZGVzKCdhcHBsaWNhdGlvbi94aHRtbCt4bWwnKTtcclxuXHJcblx0XHRcdGlmICghcmVzcG9uc2Uub2sgJiYgIWlzRG9jdW1lbnRSZXNwb25zZSkge1xyXG5cdFx0XHRcdFx0Y29uc3QgcmVzcG9uc2VDbG9uZSA9IHJlc3BvbnNlLmNsb25lKCk7XHJcblx0XHRcdFx0XHRjb25zdCBlcnJvckZyb21SZXMgPSBhd2FpdCByZXNwb25zZUNsb25lLnRleHQoKTtcclxuXHRcdFx0XHRcdGNvbnN0IHJlcXVlc3RVcmwgPSByZXNwb25zZS51cmw7XHJcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKFxcYEZldGNoIGVycm9yIGZyb20gXFwke3JlcXVlc3RVcmx9OiBcXCR7ZXJyb3JGcm9tUmVzfVxcYCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiByZXNwb25zZTtcclxuXHRcdH0pXHJcblx0XHQuY2F0Y2goZXJyb3IgPT4ge1xyXG5cdFx0XHRpZiAoIXVybC5tYXRjaCgvXFwuaHRtbD8kL2kpKSB7XHJcblx0XHRcdFx0Y29uc29sZS5lcnJvcihlcnJvcik7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRocm93IGVycm9yO1xyXG5cdFx0fSk7XHJcbn07XHJcbmA7XHJcblxyXG5jb25zdCBjb25maWdOYXZpZ2F0aW9uSGFuZGxlciA9IGBcclxuaWYgKHdpbmRvdy5uYXZpZ2F0aW9uICYmIHdpbmRvdy5zZWxmICE9PSB3aW5kb3cudG9wKSB7XHJcblx0d2luZG93Lm5hdmlnYXRpb24uYWRkRXZlbnRMaXN0ZW5lcignbmF2aWdhdGUnLCAoZXZlbnQpID0+IHtcclxuXHRcdGNvbnN0IHVybCA9IGV2ZW50LmRlc3RpbmF0aW9uLnVybDtcclxuXHJcblx0XHR0cnkge1xyXG5cdFx0XHRjb25zdCBkZXN0aW5hdGlvblVybCA9IG5ldyBVUkwodXJsKTtcclxuXHRcdFx0Y29uc3QgZGVzdGluYXRpb25PcmlnaW4gPSBkZXN0aW5hdGlvblVybC5vcmlnaW47XHJcblx0XHRcdGNvbnN0IGN1cnJlbnRPcmlnaW4gPSB3aW5kb3cubG9jYXRpb24ub3JpZ2luO1xyXG5cclxuXHRcdFx0aWYgKGRlc3RpbmF0aW9uT3JpZ2luID09PSBjdXJyZW50T3JpZ2luKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHR9IGNhdGNoIChlcnJvcikge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0d2luZG93LnBhcmVudC5wb3N0TWVzc2FnZSh7XHJcblx0XHRcdHR5cGU6ICdob3Jpem9ucy1uYXZpZ2F0aW9uLWVycm9yJyxcclxuXHRcdFx0dXJsLFxyXG5cdFx0fSwgJyonKTtcclxuXHR9KTtcclxufVxyXG5gO1xyXG5cclxuY29uc3QgYWRkVHJhbnNmb3JtSW5kZXhIdG1sID0ge1xyXG5cdG5hbWU6ICdhZGQtdHJhbnNmb3JtLWluZGV4LWh0bWwnLFxyXG5cdHRyYW5zZm9ybUluZGV4SHRtbChodG1sKSB7XHJcblx0XHRjb25zdCB0YWdzID0gW1xyXG5cdFx0XHR7XHJcblx0XHRcdFx0dGFnOiAnc2NyaXB0JyxcclxuXHRcdFx0XHRhdHRyczogeyB0eXBlOiAnbW9kdWxlJyB9LFxyXG5cdFx0XHRcdGNoaWxkcmVuOiBjb25maWdIb3Jpem9uc1J1bnRpbWVFcnJvckhhbmRsZXIsXHJcblx0XHRcdFx0aW5qZWN0VG86ICdoZWFkJyxcclxuXHRcdFx0fSxcclxuXHRcdFx0e1xyXG5cdFx0XHRcdHRhZzogJ3NjcmlwdCcsXHJcblx0XHRcdFx0YXR0cnM6IHsgdHlwZTogJ21vZHVsZScgfSxcclxuXHRcdFx0XHRjaGlsZHJlbjogY29uZmlnSG9yaXpvbnNWaXRlRXJyb3JIYW5kbGVyLFxyXG5cdFx0XHRcdGluamVjdFRvOiAnaGVhZCcsXHJcblx0XHRcdH0sXHJcblx0XHRcdHtcclxuXHRcdFx0XHR0YWc6ICdzY3JpcHQnLFxyXG5cdFx0XHRcdGF0dHJzOiB7dHlwZTogJ21vZHVsZSd9LFxyXG5cdFx0XHRcdGNoaWxkcmVuOiBjb25maWdIb3Jpem9uc0NvbnNvbGVFcnJyb0hhbmRsZXIsXHJcblx0XHRcdFx0aW5qZWN0VG86ICdoZWFkJyxcclxuXHRcdFx0fSxcclxuXHRcdFx0e1xyXG5cdFx0XHRcdHRhZzogJ3NjcmlwdCcsXHJcblx0XHRcdFx0YXR0cnM6IHsgdHlwZTogJ21vZHVsZScgfSxcclxuXHRcdFx0XHRjaGlsZHJlbjogY29uZmlnV2luZG93RmV0Y2hNb25rZXlQYXRjaCxcclxuXHRcdFx0XHRpbmplY3RUbzogJ2hlYWQnLFxyXG5cdFx0XHR9LFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0dGFnOiAnc2NyaXB0JyxcclxuXHRcdFx0XHRhdHRyczogeyB0eXBlOiAnbW9kdWxlJyB9LFxyXG5cdFx0XHRcdGNoaWxkcmVuOiBjb25maWdOYXZpZ2F0aW9uSGFuZGxlcixcclxuXHRcdFx0XHRpbmplY3RUbzogJ2hlYWQnLFxyXG5cdFx0XHR9LFxyXG5cdFx0XTtcclxuXHJcblx0XHRpZiAoIWlzRGV2ICYmIHByb2Nlc3MuZW52LlRFTVBMQVRFX0JBTk5FUl9TQ1JJUFRfVVJMICYmIHByb2Nlc3MuZW52LlRFTVBMQVRFX1JFRElSRUNUX1VSTCkge1xyXG5cdFx0XHR0YWdzLnB1c2goXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0dGFnOiAnc2NyaXB0JyxcclxuXHRcdFx0XHRcdGF0dHJzOiB7XHJcblx0XHRcdFx0XHRcdHNyYzogcHJvY2Vzcy5lbnYuVEVNUExBVEVfQkFOTkVSX1NDUklQVF9VUkwsXHJcblx0XHRcdFx0XHRcdCd0ZW1wbGF0ZS1yZWRpcmVjdC11cmwnOiBwcm9jZXNzLmVudi5URU1QTEFURV9SRURJUkVDVF9VUkwsXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0aW5qZWN0VG86ICdoZWFkJyxcclxuXHRcdFx0XHR9XHJcblx0XHRcdCk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0aHRtbCxcclxuXHRcdFx0dGFncyxcclxuXHRcdH07XHJcblx0fSxcclxufTtcclxuXHJcbmNvbnNvbGUud2FybiA9ICgpID0+IHt9O1xyXG5cclxuY29uc3QgbG9nZ2VyID0gY3JlYXRlTG9nZ2VyKClcclxuY29uc3QgbG9nZ2VyRXJyb3IgPSBsb2dnZXIuZXJyb3JcclxuXHJcbmxvZ2dlci5lcnJvciA9IChtc2csIG9wdGlvbnMpID0+IHtcclxuXHRpZiAob3B0aW9ucz8uZXJyb3I/LnRvU3RyaW5nKCkuaW5jbHVkZXMoJ0Nzc1N5bnRheEVycm9yOiBbcG9zdGNzc10nKSkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0bG9nZ2VyRXJyb3IobXNnLCBvcHRpb25zKTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuXHRjdXN0b21Mb2dnZXI6IGxvZ2dlcixcclxuXHRwbHVnaW5zOiBbXHJcblx0XHQuLi4oaXNEZXYgPyBbaW5saW5lRWRpdFBsdWdpbigpLCBlZGl0TW9kZURldlBsdWdpbigpLCBpZnJhbWVSb3V0ZVJlc3RvcmF0aW9uUGx1Z2luKCksIHNlbGVjdGlvbk1vZGVQbHVnaW4oKV0gOiBbXSksXHJcblx0XHRyZWFjdCgpLFxyXG5cdFx0YWRkVHJhbnNmb3JtSW5kZXhIdG1sXHJcblx0XSxcclxuXHRzZXJ2ZXI6IHtcclxuXHRcdGNvcnM6IHRydWUsXHJcblx0XHRoZWFkZXJzOiB7XHJcblx0XHRcdCdDcm9zcy1PcmlnaW4tRW1iZWRkZXItUG9saWN5JzogJ2NyZWRlbnRpYWxsZXNzJyxcclxuXHRcdH0sXHJcblx0XHRhbGxvd2VkSG9zdHM6IHRydWUsXHJcblx0fSxcclxuXHRyZXNvbHZlOiB7XHJcblx0XHRleHRlbnNpb25zOiBbJy5qc3gnLCAnLmpzJywgJy50c3gnLCAnLnRzJywgJy5qc29uJywgXSxcclxuXHRcdGFsaWFzOiB7XHJcblx0XHRcdCdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXHJcblx0XHR9LFxyXG5cdH0sXHJcblx0YnVpbGQ6IHtcclxuXHRcdHJvbGx1cE9wdGlvbnM6IHtcclxuXHRcdFx0ZXh0ZXJuYWw6IFtcclxuXHRcdFx0XHQnQGJhYmVsL3BhcnNlcicsXHJcblx0XHRcdFx0J0BiYWJlbC90cmF2ZXJzZScsXHJcblx0XHRcdFx0J0BiYWJlbC9nZW5lcmF0b3InLFxyXG5cdFx0XHRcdCdAYmFiZWwvdHlwZXMnXHJcblx0XHRcdF1cclxuXHRcdH1cclxuXHR9XHJcbn0pO1xyXG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXEN5a2VzXFxcXERlc2t0b3BcXFxcRXNwb2xcXFxcc2lzdGVtYS1nZXN0aW9uLWFkclxcXFxwbHVnaW5zXFxcXHZpc3VhbC1lZGl0b3JcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXEN5a2VzXFxcXERlc2t0b3BcXFxcRXNwb2xcXFxcc2lzdGVtYS1nZXN0aW9uLWFkclxcXFxwbHVnaW5zXFxcXHZpc3VhbC1lZGl0b3JcXFxcdml0ZS1wbHVnaW4tcmVhY3QtaW5saW5lLWVkaXRvci5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvQ3lrZXMvRGVza3RvcC9Fc3BvbC9zaXN0ZW1hLWdlc3Rpb24tYWRyL3BsdWdpbnMvdmlzdWFsLWVkaXRvci92aXRlLXBsdWdpbi1yZWFjdC1pbmxpbmUtZWRpdG9yLmpzXCI7aW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XHJcbmltcG9ydCB7IHBhcnNlIH0gZnJvbSAnQGJhYmVsL3BhcnNlcic7XHJcbmltcG9ydCB0cmF2ZXJzZUJhYmVsIGZyb20gJ0BiYWJlbC90cmF2ZXJzZSc7XHJcbmltcG9ydCAqIGFzIHQgZnJvbSAnQGJhYmVsL3R5cGVzJztcclxuaW1wb3J0IGZzIGZyb20gJ2ZzJztcclxuaW1wb3J0IHsgXHJcblx0dmFsaWRhdGVGaWxlUGF0aCwgXHJcblx0cGFyc2VGaWxlVG9BU1QsIFxyXG5cdGZpbmRKU1hFbGVtZW50QXRQb3NpdGlvbixcclxuXHRnZW5lcmF0ZUNvZGUsXHJcblx0Z2VuZXJhdGVTb3VyY2VXaXRoTWFwLFxyXG5cdFZJVEVfUFJPSkVDVF9ST09UXHJcbn0gZnJvbSAnLi4vdXRpbHMvYXN0LXV0aWxzLmpzJztcclxuXHJcbmNvbnN0IEVESVRBQkxFX0hUTUxfVEFHUyA9IFtcImFcIiwgXCJCdXR0b25cIiwgXCJidXR0b25cIiwgXCJwXCIsIFwic3BhblwiLCBcImgxXCIsIFwiaDJcIiwgXCJoM1wiLCBcImg0XCIsIFwiaDVcIiwgXCJoNlwiLCBcImxhYmVsXCIsIFwiTGFiZWxcIiwgXCJpbWdcIl07XHJcblxyXG5mdW5jdGlvbiBwYXJzZUVkaXRJZChlZGl0SWQpIHtcclxuXHRjb25zdCBwYXJ0cyA9IGVkaXRJZC5zcGxpdCgnOicpO1xyXG5cclxuXHRpZiAocGFydHMubGVuZ3RoIDwgMykge1xyXG5cdFx0cmV0dXJuIG51bGw7XHJcblx0fVxyXG5cclxuXHRjb25zdCBjb2x1bW4gPSBwYXJzZUludChwYXJ0cy5hdCgtMSksIDEwKTtcclxuXHRjb25zdCBsaW5lID0gcGFyc2VJbnQocGFydHMuYXQoLTIpLCAxMCk7XHJcblx0Y29uc3QgZmlsZVBhdGggPSBwYXJ0cy5zbGljZSgwLCAtMikuam9pbignOicpO1xyXG5cclxuXHRpZiAoIWZpbGVQYXRoIHx8IGlzTmFOKGxpbmUpIHx8IGlzTmFOKGNvbHVtbikpIHtcclxuXHRcdHJldHVybiBudWxsO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHsgZmlsZVBhdGgsIGxpbmUsIGNvbHVtbiB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBjaGVja1RhZ05hbWVFZGl0YWJsZShvcGVuaW5nRWxlbWVudE5vZGUsIGVkaXRhYmxlVGFnc0xpc3QpIHtcclxuXHRpZiAoIW9wZW5pbmdFbGVtZW50Tm9kZSB8fCAhb3BlbmluZ0VsZW1lbnROb2RlLm5hbWUpIHJldHVybiBmYWxzZTtcclxuXHRjb25zdCBuYW1lTm9kZSA9IG9wZW5pbmdFbGVtZW50Tm9kZS5uYW1lO1xyXG5cclxuXHQvLyBDaGVjayAxOiBEaXJlY3QgbmFtZSAoZm9yIDxwPiwgPEJ1dHRvbj4pXHJcblx0aWYgKG5hbWVOb2RlLnR5cGUgPT09ICdKU1hJZGVudGlmaWVyJyAmJiBlZGl0YWJsZVRhZ3NMaXN0LmluY2x1ZGVzKG5hbWVOb2RlLm5hbWUpKSB7XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdC8vIENoZWNrIDI6IFByb3BlcnR5IG5hbWUgb2YgYSBtZW1iZXIgZXhwcmVzc2lvbiAoZm9yIDxtb3Rpb24uaDE+LCBjaGVjayBpZiBcImgxXCIgaXMgaW4gZWRpdGFibGVUYWdzTGlzdClcclxuXHRpZiAobmFtZU5vZGUudHlwZSA9PT0gJ0pTWE1lbWJlckV4cHJlc3Npb24nICYmIG5hbWVOb2RlLnByb3BlcnR5ICYmIG5hbWVOb2RlLnByb3BlcnR5LnR5cGUgPT09ICdKU1hJZGVudGlmaWVyJyAmJiBlZGl0YWJsZVRhZ3NMaXN0LmluY2x1ZGVzKG5hbWVOb2RlLnByb3BlcnR5Lm5hbWUpKSB7XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdHJldHVybiBmYWxzZTtcclxufVxyXG5cclxuZnVuY3Rpb24gdmFsaWRhdGVJbWFnZVNyYyhvcGVuaW5nTm9kZSkge1xyXG5cdGlmICghb3BlbmluZ05vZGUgfHwgIW9wZW5pbmdOb2RlLm5hbWUgfHwgKCBvcGVuaW5nTm9kZS5uYW1lLm5hbWUgIT09ICdpbWcnICYmIG9wZW5pbmdOb2RlLm5hbWUucHJvcGVydHk/Lm5hbWUgIT09ICdpbWcnKSkge1xyXG5cdFx0cmV0dXJuIHsgaXNWYWxpZDogdHJ1ZSwgcmVhc29uOiBudWxsIH07IC8vIE5vdCBhbiBpbWFnZSwgc2tpcCB2YWxpZGF0aW9uXHJcblx0fVxyXG5cclxuXHRjb25zdCBoYXNQcm9wc1NwcmVhZCA9IG9wZW5pbmdOb2RlLmF0dHJpYnV0ZXMuc29tZShhdHRyID0+XHJcblx0XHR0LmlzSlNYU3ByZWFkQXR0cmlidXRlKGF0dHIpICYmXHJcblx0XHRhdHRyLmFyZ3VtZW50ICYmXHJcblx0XHR0LmlzSWRlbnRpZmllcihhdHRyLmFyZ3VtZW50KSAmJlxyXG5cdFx0YXR0ci5hcmd1bWVudC5uYW1lID09PSAncHJvcHMnXHJcblx0KTtcclxuXHJcblx0aWYgKGhhc1Byb3BzU3ByZWFkKSB7XHJcblx0XHRyZXR1cm4geyBpc1ZhbGlkOiBmYWxzZSwgcmVhc29uOiAncHJvcHMtc3ByZWFkJyB9O1xyXG5cdH1cclxuXHJcblx0Y29uc3Qgc3JjQXR0ciA9IG9wZW5pbmdOb2RlLmF0dHJpYnV0ZXMuZmluZChhdHRyID0+XHJcblx0XHR0LmlzSlNYQXR0cmlidXRlKGF0dHIpICYmXHJcblx0XHRhdHRyLm5hbWUgJiZcclxuXHRcdGF0dHIubmFtZS5uYW1lID09PSAnc3JjJ1xyXG5cdCk7XHJcblxyXG5cdGlmICghc3JjQXR0cikge1xyXG5cdFx0cmV0dXJuIHsgaXNWYWxpZDogZmFsc2UsIHJlYXNvbjogJ21pc3Npbmctc3JjJyB9O1xyXG5cdH1cclxuXHJcblx0aWYgKCF0LmlzU3RyaW5nTGl0ZXJhbChzcmNBdHRyLnZhbHVlKSkge1xyXG5cdFx0cmV0dXJuIHsgaXNWYWxpZDogZmFsc2UsIHJlYXNvbjogJ2R5bmFtaWMtc3JjJyB9O1xyXG5cdH1cclxuXHJcblx0aWYgKCFzcmNBdHRyLnZhbHVlLnZhbHVlIHx8IHNyY0F0dHIudmFsdWUudmFsdWUudHJpbSgpID09PSAnJykge1xyXG5cdFx0cmV0dXJuIHsgaXNWYWxpZDogZmFsc2UsIHJlYXNvbjogJ2VtcHR5LXNyYycgfTtcclxuXHR9XHJcblxyXG5cdHJldHVybiB7IGlzVmFsaWQ6IHRydWUsIHJlYXNvbjogbnVsbCB9O1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBpbmxpbmVFZGl0UGx1Z2luKCkge1xyXG5cdHJldHVybiB7XHJcblx0XHRuYW1lOiAndml0ZS1pbmxpbmUtZWRpdC1wbHVnaW4nLFxyXG5cdFx0ZW5mb3JjZTogJ3ByZScsXHJcblxyXG5cdFx0dHJhbnNmb3JtKGNvZGUsIGlkKSB7XHJcblx0XHRcdGlmICghL1xcLihqc3h8dHN4KSQvLnRlc3QoaWQpIHx8ICFpZC5zdGFydHNXaXRoKFZJVEVfUFJPSkVDVF9ST09UKSB8fCBpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzJykpIHtcclxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgcmVsYXRpdmVGaWxlUGF0aCA9IHBhdGgucmVsYXRpdmUoVklURV9QUk9KRUNUX1JPT1QsIGlkKTtcclxuXHRcdFx0Y29uc3Qgd2ViUmVsYXRpdmVGaWxlUGF0aCA9IHJlbGF0aXZlRmlsZVBhdGguc3BsaXQocGF0aC5zZXApLmpvaW4oJy8nKTtcclxuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0Y29uc3QgYmFiZWxBc3QgPSBwYXJzZShjb2RlLCB7XHJcblx0XHRcdFx0XHRzb3VyY2VUeXBlOiAnbW9kdWxlJyxcclxuXHRcdFx0XHRcdHBsdWdpbnM6IFsnanN4JywgJ3R5cGVzY3JpcHQnXSxcclxuXHRcdFx0XHRcdGVycm9yUmVjb3Zlcnk6IHRydWVcclxuXHRcdFx0XHR9KTtcclxuXHJcblx0XHRcdFx0bGV0IGF0dHJpYnV0ZXNBZGRlZCA9IDA7XHJcblxyXG5cdFx0XHRcdHRyYXZlcnNlQmFiZWwuZGVmYXVsdChiYWJlbEFzdCwge1xyXG5cdFx0XHRcdFx0ZW50ZXIocGF0aCkge1xyXG5cdFx0XHRcdFx0XHRpZiAocGF0aC5pc0pTWE9wZW5pbmdFbGVtZW50KCkpIHtcclxuXHRcdFx0XHRcdFx0XHRjb25zdCBvcGVuaW5nTm9kZSA9IHBhdGgubm9kZTtcclxuXHRcdFx0XHRcdFx0XHRjb25zdCBlbGVtZW50Tm9kZSA9IHBhdGgucGFyZW50UGF0aC5ub2RlOyAvLyBUaGUgSlNYRWxlbWVudCBpdHNlbGZcclxuXHJcblx0XHRcdFx0XHRcdFx0aWYgKCFvcGVuaW5nTm9kZS5sb2MpIHtcclxuXHRcdFx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGFscmVhZHlIYXNJZCA9IG9wZW5pbmdOb2RlLmF0dHJpYnV0ZXMuc29tZShcclxuXHRcdFx0XHRcdFx0XHRcdChhdHRyKSA9PiB0LmlzSlNYQXR0cmlidXRlKGF0dHIpICYmIGF0dHIubmFtZS5uYW1lID09PSAnZGF0YS1lZGl0LWlkJ1xyXG5cdFx0XHRcdFx0XHRcdCk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdGlmIChhbHJlYWR5SGFzSWQpIHtcclxuXHRcdFx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRcdC8vIENvbmRpdGlvbiAxOiBJcyB0aGUgY3VycmVudCBlbGVtZW50IHRhZyB0eXBlIGVkaXRhYmxlP1xyXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGlzQ3VycmVudEVsZW1lbnRFZGl0YWJsZSA9IGNoZWNrVGFnTmFtZUVkaXRhYmxlKG9wZW5pbmdOb2RlLCBFRElUQUJMRV9IVE1MX1RBR1MpO1xyXG5cdFx0XHRcdFx0XHRcdGlmICghaXNDdXJyZW50RWxlbWVudEVkaXRhYmxlKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0XHRjb25zdCBpbWFnZVZhbGlkYXRpb24gPSB2YWxpZGF0ZUltYWdlU3JjKG9wZW5pbmdOb2RlKTtcclxuXHRcdFx0XHRcdFx0XHRpZiAoIWltYWdlVmFsaWRhdGlvbi5pc1ZhbGlkKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBkaXNhYmxlZEF0dHJpYnV0ZSA9IHQuanN4QXR0cmlidXRlKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHR0LmpzeElkZW50aWZpZXIoJ2RhdGEtZWRpdC1kaXNhYmxlZCcpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHR0LnN0cmluZ0xpdGVyYWwoJ3RydWUnKVxyXG5cdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdFx0XHRcdFx0XHRcdG9wZW5pbmdOb2RlLmF0dHJpYnV0ZXMucHVzaChkaXNhYmxlZEF0dHJpYnV0ZSk7XHJcblx0XHRcdFx0XHRcdFx0XHRhdHRyaWJ1dGVzQWRkZWQrKztcclxuXHRcdFx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRcdGxldCBzaG91bGRCZURpc2FibGVkRHVlVG9DaGlsZHJlbiA9IGZhbHNlO1xyXG5cclxuXHRcdFx0XHRcdFx0XHQvLyBDb25kaXRpb24gMjogRG9lcyB0aGUgZWxlbWVudCBoYXZlIGR5bmFtaWMgb3IgZWRpdGFibGUgY2hpbGRyZW5cclxuXHRcdFx0XHRcdFx0XHRpZiAodC5pc0pTWEVsZW1lbnQoZWxlbWVudE5vZGUpICYmIGVsZW1lbnROb2RlLmNoaWxkcmVuKSB7XHJcblx0XHRcdFx0XHRcdFx0XHQvLyBDaGVjayBpZiBlbGVtZW50IGhhcyB7Li4ucHJvcHN9IHNwcmVhZCBhdHRyaWJ1dGUgLSBkaXNhYmxlIGVkaXRpbmcgaWYgaXQgZG9lc1xyXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgaGFzUHJvcHNTcHJlYWQgPSBvcGVuaW5nTm9kZS5hdHRyaWJ1dGVzLnNvbWUoYXR0ciA9PiB0LmlzSlNYU3ByZWFkQXR0cmlidXRlKGF0dHIpXHJcblx0XHRcdFx0XHRcdFx0XHRcdCYmIGF0dHIuYXJndW1lbnRcclxuXHRcdFx0XHRcdFx0XHRcdFx0JiYgdC5pc0lkZW50aWZpZXIoYXR0ci5hcmd1bWVudClcclxuXHRcdFx0XHRcdFx0XHRcdFx0JiYgYXR0ci5hcmd1bWVudC5uYW1lID09PSAncHJvcHMnXHJcblx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGhhc0R5bmFtaWNDaGlsZCA9IGVsZW1lbnROb2RlLmNoaWxkcmVuLnNvbWUoY2hpbGQgPT5cclxuXHRcdFx0XHRcdFx0XHRcdFx0dC5pc0pTWEV4cHJlc3Npb25Db250YWluZXIoY2hpbGQpXHJcblx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdGlmIChoYXNEeW5hbWljQ2hpbGQgfHwgaGFzUHJvcHNTcHJlYWQpIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0c2hvdWxkQmVEaXNhYmxlZER1ZVRvQ2hpbGRyZW4gPSB0cnVlO1xyXG5cdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdFx0aWYgKCFzaG91bGRCZURpc2FibGVkRHVlVG9DaGlsZHJlbiAmJiB0LmlzSlNYRWxlbWVudChlbGVtZW50Tm9kZSkgJiYgZWxlbWVudE5vZGUuY2hpbGRyZW4pIHtcclxuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGhhc0VkaXRhYmxlSnN4Q2hpbGQgPSBlbGVtZW50Tm9kZS5jaGlsZHJlbi5zb21lKGNoaWxkID0+IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKHQuaXNKU1hFbGVtZW50KGNoaWxkKSkge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiBjaGVja1RhZ05hbWVFZGl0YWJsZShjaGlsZC5vcGVuaW5nRWxlbWVudCwgRURJVEFCTEVfSFRNTF9UQUdTKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRcdFx0XHRcdFx0fSk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0aWYgKGhhc0VkaXRhYmxlSnN4Q2hpbGQpIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0c2hvdWxkQmVEaXNhYmxlZER1ZVRvQ2hpbGRyZW4gPSB0cnVlO1xyXG5cdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdFx0aWYgKHNob3VsZEJlRGlzYWJsZWREdWVUb0NoaWxkcmVuKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBkaXNhYmxlZEF0dHJpYnV0ZSA9IHQuanN4QXR0cmlidXRlKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHR0LmpzeElkZW50aWZpZXIoJ2RhdGEtZWRpdC1kaXNhYmxlZCcpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHR0LnN0cmluZ0xpdGVyYWwoJ3RydWUnKVxyXG5cdFx0XHRcdFx0XHRcdFx0KTtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRvcGVuaW5nTm9kZS5hdHRyaWJ1dGVzLnB1c2goZGlzYWJsZWRBdHRyaWJ1dGUpO1xyXG5cdFx0XHRcdFx0XHRcdFx0YXR0cmlidXRlc0FkZGVkKys7XHJcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0XHQvLyBDb25kaXRpb24gMzogUGFyZW50IGlzIG5vbi1lZGl0YWJsZSBpZiBBVCBMRUFTVCBPTkUgY2hpbGQgSlNYRWxlbWVudCBpcyBhIG5vbi1lZGl0YWJsZSB0eXBlLlxyXG5cdFx0XHRcdFx0XHRcdGlmICh0LmlzSlNYRWxlbWVudChlbGVtZW50Tm9kZSkgJiYgZWxlbWVudE5vZGUuY2hpbGRyZW4gJiYgZWxlbWVudE5vZGUuY2hpbGRyZW4ubGVuZ3RoID4gMCkge1xyXG5cdFx0XHRcdFx0XHRcdFx0bGV0IGhhc05vbkVkaXRhYmxlSnN4Q2hpbGQgPSBmYWxzZTtcclxuXHRcdFx0XHRcdFx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2YgZWxlbWVudE5vZGUuY2hpbGRyZW4pIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKHQuaXNKU1hFbGVtZW50KGNoaWxkKSkge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGlmICghY2hlY2tUYWdOYW1lRWRpdGFibGUoY2hpbGQub3BlbmluZ0VsZW1lbnQsIEVESVRBQkxFX0hUTUxfVEFHUykpIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGhhc05vbkVkaXRhYmxlSnN4Q2hpbGQgPSB0cnVlO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRpZiAoaGFzTm9uRWRpdGFibGVKc3hDaGlsZCkge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zdCBkaXNhYmxlZEF0dHJpYnV0ZSA9IHQuanN4QXR0cmlidXRlKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHQuanN4SWRlbnRpZmllcignZGF0YS1lZGl0LWRpc2FibGVkJyksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0dC5zdHJpbmdMaXRlcmFsKFwidHJ1ZVwiKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRvcGVuaW5nTm9kZS5hdHRyaWJ1dGVzLnB1c2goZGlzYWJsZWRBdHRyaWJ1dGUpO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRhdHRyaWJ1dGVzQWRkZWQrKztcclxuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdFx0Ly8gQ29uZGl0aW9uIDQ6IElzIGFueSBhbmNlc3RvciBKU1hFbGVtZW50IGFsc28gZWRpdGFibGU/XHJcblx0XHRcdFx0XHRcdFx0bGV0IGN1cnJlbnRBbmNlc3RvckNhbmRpZGF0ZVBhdGggPSBwYXRoLnBhcmVudFBhdGgucGFyZW50UGF0aDtcclxuXHRcdFx0XHRcdFx0XHR3aGlsZSAoY3VycmVudEFuY2VzdG9yQ2FuZGlkYXRlUGF0aCkge1xyXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgYW5jZXN0b3JKc3hFbGVtZW50UGF0aCA9IGN1cnJlbnRBbmNlc3RvckNhbmRpZGF0ZVBhdGguaXNKU1hFbGVtZW50KClcclxuXHRcdFx0XHRcdFx0XHRcdFx0PyBjdXJyZW50QW5jZXN0b3JDYW5kaWRhdGVQYXRoXHJcblx0XHRcdFx0XHRcdFx0XHRcdDogY3VycmVudEFuY2VzdG9yQ2FuZGlkYXRlUGF0aC5maW5kUGFyZW50KHAgPT4gcC5pc0pTWEVsZW1lbnQoKSk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0aWYgKCFhbmNlc3RvckpzeEVsZW1lbnRQYXRoKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdGlmIChjaGVja1RhZ05hbWVFZGl0YWJsZShhbmNlc3RvckpzeEVsZW1lbnRQYXRoLm5vZGUub3BlbmluZ0VsZW1lbnQsIEVESVRBQkxFX0hUTUxfVEFHUykpIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0Y3VycmVudEFuY2VzdG9yQ2FuZGlkYXRlUGF0aCA9IGFuY2VzdG9ySnN4RWxlbWVudFBhdGgucGFyZW50UGF0aDtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGxpbmUgPSBvcGVuaW5nTm9kZS5sb2Muc3RhcnQubGluZTtcclxuXHRcdFx0XHRcdFx0XHRjb25zdCBjb2x1bW4gPSBvcGVuaW5nTm9kZS5sb2Muc3RhcnQuY29sdW1uICsgMTtcclxuXHRcdFx0XHRcdFx0XHRjb25zdCBlZGl0SWQgPSBgJHt3ZWJSZWxhdGl2ZUZpbGVQYXRofToke2xpbmV9OiR7Y29sdW1ufWA7XHJcblxyXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGlkQXR0cmlidXRlID0gdC5qc3hBdHRyaWJ1dGUoXHJcblx0XHRcdFx0XHRcdFx0XHR0LmpzeElkZW50aWZpZXIoJ2RhdGEtZWRpdC1pZCcpLFxyXG5cdFx0XHRcdFx0XHRcdFx0dC5zdHJpbmdMaXRlcmFsKGVkaXRJZClcclxuXHRcdFx0XHRcdFx0XHQpO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRvcGVuaW5nTm9kZS5hdHRyaWJ1dGVzLnB1c2goaWRBdHRyaWJ1dGUpO1xyXG5cdFx0XHRcdFx0XHRcdGF0dHJpYnV0ZXNBZGRlZCsrO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSk7XHJcblxyXG5cdFx0XHRcdGlmIChhdHRyaWJ1dGVzQWRkZWQgPiAwKSB7XHJcblx0XHRcdFx0XHRjb25zdCBvdXRwdXQgPSBnZW5lcmF0ZVNvdXJjZVdpdGhNYXAoYmFiZWxBc3QsIHdlYlJlbGF0aXZlRmlsZVBhdGgsIGNvZGUpO1xyXG5cdFx0XHRcdFx0cmV0dXJuIHsgY29kZTogb3V0cHV0LmNvZGUsIG1hcDogb3V0cHV0Lm1hcCB9O1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XHJcblx0XHRcdFx0Y29uc29sZS5lcnJvcihgW3ZpdGVdW3Zpc3VhbC1lZGl0b3JdIEVycm9yIHRyYW5zZm9ybWluZyAke2lkfTpgLCBlcnJvcik7XHJcblx0XHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHRcdH1cclxuXHRcdH0sXHJcblxyXG5cclxuXHRcdC8vIFVwZGF0ZXMgc291cmNlIGNvZGUgYmFzZWQgb24gdGhlIGNoYW5nZXMgcmVjZWl2ZWQgZnJvbSB0aGUgY2xpZW50XHJcblx0XHRjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XHJcblx0XHRcdHNlcnZlci5taWRkbGV3YXJlcy51c2UoJy9hcGkvYXBwbHktZWRpdCcsIGFzeW5jIChyZXEsIHJlcywgbmV4dCkgPT4ge1xyXG5cdFx0XHRcdGlmIChyZXEubWV0aG9kICE9PSAnUE9TVCcpIHJldHVybiBuZXh0KCk7XHJcblxyXG5cdFx0XHRcdGxldCBib2R5ID0gJyc7XHJcblx0XHRcdFx0cmVxLm9uKCdkYXRhJywgY2h1bmsgPT4geyBib2R5ICs9IGNodW5rLnRvU3RyaW5nKCk7IH0pO1xyXG5cclxuXHRcdFx0XHRyZXEub24oJ2VuZCcsIGFzeW5jICgpID0+IHtcclxuXHRcdFx0XHRcdGxldCBhYnNvbHV0ZUZpbGVQYXRoID0gJyc7XHJcblx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHRjb25zdCB7IGVkaXRJZCwgbmV3RnVsbFRleHQgfSA9IEpTT04ucGFyc2UoYm9keSk7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoIWVkaXRJZCB8fCB0eXBlb2YgbmV3RnVsbFRleHQgPT09ICd1bmRlZmluZWQnKSB7XHJcblx0XHRcdFx0XHRcdFx0cmVzLndyaXRlSGVhZCg0MDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnTWlzc2luZyBlZGl0SWQgb3IgbmV3RnVsbFRleHQnIH0pKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0Y29uc3QgcGFyc2VkSWQgPSBwYXJzZUVkaXRJZChlZGl0SWQpO1xyXG5cdFx0XHRcdFx0XHRpZiAoIXBhcnNlZElkKSB7XHJcblx0XHRcdFx0XHRcdFx0cmVzLndyaXRlSGVhZCg0MDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnSW52YWxpZCBlZGl0SWQgZm9ybWF0IChmaWxlUGF0aDpsaW5lOmNvbHVtbiknIH0pKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0Y29uc3QgeyBmaWxlUGF0aCwgbGluZSwgY29sdW1uIH0gPSBwYXJzZWRJZDtcclxuXHJcblx0XHRcdFx0XHRcdC8vIFZhbGlkYXRlIGZpbGUgcGF0aFxyXG5cdFx0XHRcdFx0XHRjb25zdCB2YWxpZGF0aW9uID0gdmFsaWRhdGVGaWxlUGF0aChmaWxlUGF0aCk7XHJcblx0XHRcdFx0XHRcdGlmICghdmFsaWRhdGlvbi5pc1ZhbGlkKSB7XHJcblx0XHRcdFx0XHRcdFx0cmVzLndyaXRlSGVhZCg0MDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiB2YWxpZGF0aW9uLmVycm9yIH0pKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRhYnNvbHV0ZUZpbGVQYXRoID0gdmFsaWRhdGlvbi5hYnNvbHV0ZVBhdGg7XHJcblxyXG5cdFx0XHRcdFx0XHQvLyBQYXJzZSBBU1RcclxuXHRcdFx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxDb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKGFic29sdXRlRmlsZVBhdGgsICd1dGYtOCcpO1xyXG5cdFx0XHRcdFx0XHRjb25zdCBiYWJlbEFzdCA9IHBhcnNlRmlsZVRvQVNUKGFic29sdXRlRmlsZVBhdGgpO1xyXG5cclxuXHRcdFx0XHRcdFx0Ly8gRmluZCB0YXJnZXQgbm9kZSAobm90ZTogYXBwbHktZWRpdCB1c2VzIGNvbHVtbisxKVxyXG5cdFx0XHRcdFx0XHRjb25zdCB0YXJnZXROb2RlUGF0aCA9IGZpbmRKU1hFbGVtZW50QXRQb3NpdGlvbihiYWJlbEFzdCwgbGluZSwgY29sdW1uICsgMSk7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoIXRhcmdldE5vZGVQYXRoKSB7XHJcblx0XHRcdFx0XHRcdFx0cmVzLndyaXRlSGVhZCg0MDQsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnVGFyZ2V0IG5vZGUgbm90IGZvdW5kIGJ5IGxpbmUvY29sdW1uJywgZWRpdElkIH0pKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0Y29uc3QgdGFyZ2V0T3BlbmluZ0VsZW1lbnQgPSB0YXJnZXROb2RlUGF0aC5ub2RlO1xyXG5cdFx0XHRcdFx0XHRjb25zdCBwYXJlbnRFbGVtZW50Tm9kZSA9IHRhcmdldE5vZGVQYXRoLnBhcmVudFBhdGg/Lm5vZGU7XHJcblxyXG5cdFx0XHRcdFx0XHRjb25zdCBpc0ltYWdlRWxlbWVudCA9IHRhcmdldE9wZW5pbmdFbGVtZW50Lm5hbWUgJiYgdGFyZ2V0T3BlbmluZ0VsZW1lbnQubmFtZS5uYW1lID09PSAnaW1nJztcclxuXHJcblx0XHRcdFx0XHRcdGxldCBiZWZvcmVDb2RlID0gJyc7XHJcblx0XHRcdFx0XHRcdGxldCBhZnRlckNvZGUgPSAnJztcclxuXHRcdFx0XHRcdFx0bGV0IG1vZGlmaWVkID0gZmFsc2U7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoaXNJbWFnZUVsZW1lbnQpIHtcclxuXHRcdFx0XHRcdFx0XHQvLyBIYW5kbGUgaW1hZ2Ugc3JjIGF0dHJpYnV0ZSB1cGRhdGVcclxuXHRcdFx0XHRcdFx0XHRiZWZvcmVDb2RlID0gZ2VuZXJhdGVDb2RlKHRhcmdldE9wZW5pbmdFbGVtZW50KTtcclxuXHJcblx0XHRcdFx0XHRcdFx0Y29uc3Qgc3JjQXR0ciA9IHRhcmdldE9wZW5pbmdFbGVtZW50LmF0dHJpYnV0ZXMuZmluZChhdHRyID0+XHJcblx0XHRcdFx0XHRcdFx0XHR0LmlzSlNYQXR0cmlidXRlKGF0dHIpICYmIGF0dHIubmFtZSAmJiBhdHRyLm5hbWUubmFtZSA9PT0gJ3NyYydcclxuXHRcdFx0XHRcdFx0XHQpO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRpZiAoc3JjQXR0ciAmJiB0LmlzU3RyaW5nTGl0ZXJhbChzcmNBdHRyLnZhbHVlKSkge1xyXG5cdFx0XHRcdFx0XHRcdFx0c3JjQXR0ci52YWx1ZSA9IHQuc3RyaW5nTGl0ZXJhbChuZXdGdWxsVGV4dCk7XHJcblx0XHRcdFx0XHRcdFx0XHRtb2RpZmllZCA9IHRydWU7XHJcblx0XHRcdFx0XHRcdFx0XHRhZnRlckNvZGUgPSBnZW5lcmF0ZUNvZGUodGFyZ2V0T3BlbmluZ0VsZW1lbnQpO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHRpZiAocGFyZW50RWxlbWVudE5vZGUgJiYgdC5pc0pTWEVsZW1lbnQocGFyZW50RWxlbWVudE5vZGUpKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRiZWZvcmVDb2RlID0gZ2VuZXJhdGVDb2RlKHBhcmVudEVsZW1lbnROb2RlKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRwYXJlbnRFbGVtZW50Tm9kZS5jaGlsZHJlbiA9IFtdO1xyXG5cdFx0XHRcdFx0XHRcdFx0aWYgKG5ld0Z1bGxUZXh0ICYmIG5ld0Z1bGxUZXh0LnRyaW0oKSAhPT0gJycpIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgbmV3VGV4dE5vZGUgPSB0LmpzeFRleHQobmV3RnVsbFRleHQpO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRwYXJlbnRFbGVtZW50Tm9kZS5jaGlsZHJlbi5wdXNoKG5ld1RleHROb2RlKTtcclxuXHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdG1vZGlmaWVkID0gdHJ1ZTtcclxuXHRcdFx0XHRcdFx0XHRcdGFmdGVyQ29kZSA9IGdlbmVyYXRlQ29kZShwYXJlbnRFbGVtZW50Tm9kZSk7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoIW1vZGlmaWVkKSB7XHJcblx0XHRcdFx0XHRcdFx0cmVzLndyaXRlSGVhZCg0MDksIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnQ291bGQgbm90IGFwcGx5IGNoYW5nZXMgdG8gQVNULicgfSkpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRjb25zdCB3ZWJSZWxhdGl2ZUZpbGVQYXRoID0gcGF0aC5yZWxhdGl2ZShWSVRFX1BST0pFQ1RfUk9PVCwgYWJzb2x1dGVGaWxlUGF0aCkuc3BsaXQocGF0aC5zZXApLmpvaW4oJy8nKTtcclxuXHRcdFx0XHRcdFx0Y29uc3Qgb3V0cHV0ID0gZ2VuZXJhdGVTb3VyY2VXaXRoTWFwKGJhYmVsQXN0LCB3ZWJSZWxhdGl2ZUZpbGVQYXRoLCBvcmlnaW5hbENvbnRlbnQpO1xyXG5cdFx0XHRcdFx0XHRjb25zdCBuZXdDb250ZW50ID0gb3V0cHV0LmNvZGU7XHJcblxyXG5cdFx0XHRcdFx0XHRyZXMud3JpdGVIZWFkKDIwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xyXG5cdFx0XHRcdFx0XHRyZXMuZW5kKEpTT04uc3RyaW5naWZ5KHtcclxuXHRcdFx0XHRcdFx0XHRzdWNjZXNzOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdG5ld0ZpbGVDb250ZW50OiBuZXdDb250ZW50LFxyXG5cdFx0XHRcdFx0XHRcdGJlZm9yZUNvZGUsXHJcblx0XHRcdFx0XHRcdFx0YWZ0ZXJDb2RlLFxyXG5cdFx0XHRcdFx0XHR9KSk7XHJcblxyXG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcclxuXHRcdFx0XHRcdFx0cmVzLndyaXRlSGVhZCg1MDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcclxuXHRcdFx0XHRcdFx0cmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnSW50ZXJuYWwgc2VydmVyIGVycm9yIGR1cmluZyBlZGl0IGFwcGxpY2F0aW9uLicgfSkpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHR9O1xyXG59IiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxDeWtlc1xcXFxEZXNrdG9wXFxcXEVzcG9sXFxcXHNpc3RlbWEtZ2VzdGlvbi1hZHJcXFxccGx1Z2luc1xcXFx1dGlsc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQ3lrZXNcXFxcRGVza3RvcFxcXFxFc3BvbFxcXFxzaXN0ZW1hLWdlc3Rpb24tYWRyXFxcXHBsdWdpbnNcXFxcdXRpbHNcXFxcYXN0LXV0aWxzLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9DeWtlcy9EZXNrdG9wL0VzcG9sL3Npc3RlbWEtZ2VzdGlvbi1hZHIvcGx1Z2lucy91dGlscy9hc3QtdXRpbHMuanNcIjtpbXBvcnQgZnMgZnJvbSAnbm9kZTpmcyc7XHJcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XHJcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tICdub2RlOnVybCc7XHJcbmltcG9ydCBnZW5lcmF0ZSBmcm9tICdAYmFiZWwvZ2VuZXJhdG9yJztcclxuaW1wb3J0IHsgcGFyc2UgfSBmcm9tICdAYmFiZWwvcGFyc2VyJztcclxuaW1wb3J0IHRyYXZlcnNlQmFiZWwgZnJvbSAnQGJhYmVsL3RyYXZlcnNlJztcclxuaW1wb3J0IHtcclxuXHRpc0pTWElkZW50aWZpZXIsXHJcblx0aXNKU1hNZW1iZXJFeHByZXNzaW9uLFxyXG59IGZyb20gJ0BiYWJlbC90eXBlcyc7XHJcblxyXG5jb25zdCBfX2ZpbGVuYW1lID0gZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpO1xyXG5jb25zdCBfX2Rpcm5hbWUgPSBwYXRoLmRpcm5hbWUoX19maWxlbmFtZSk7XHJcbmNvbnN0IFZJVEVfUFJPSkVDVF9ST09UID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uJyk7XHJcblxyXG4vLyBCbGFja2xpc3Qgb2YgY29tcG9uZW50cyB0aGF0IHNob3VsZCBub3QgYmUgZXh0cmFjdGVkICh1dGlsaXR5L25vbi12aXN1YWwgY29tcG9uZW50cylcclxuY29uc3QgQ09NUE9ORU5UX0JMQUNLTElTVCA9IG5ldyBTZXQoW1xyXG5cdCdIZWxtZXQnLFxyXG5cdCdIZWxtZXRQcm92aWRlcicsXHJcblx0J0hlYWQnLFxyXG5cdCdoZWFkJyxcclxuXHQnTWV0YScsXHJcblx0J21ldGEnLFxyXG5cdCdTY3JpcHQnLFxyXG5cdCdzY3JpcHQnLFxyXG5cdCdOb1NjcmlwdCcsXHJcblx0J25vc2NyaXB0JyxcclxuXHQnU3R5bGUnLFxyXG5cdCdzdHlsZScsXHJcblx0J3RpdGxlJyxcclxuXHQnVGl0bGUnLFxyXG5cdCdsaW5rJyxcclxuXHQnTGluaycsXHJcbl0pO1xyXG5cclxuLyoqXHJcbiAqIFZhbGlkYXRlcyB0aGF0IGEgZmlsZSBwYXRoIGlzIHNhZmUgdG8gYWNjZXNzXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBmaWxlUGF0aCAtIFJlbGF0aXZlIGZpbGUgcGF0aFxyXG4gKiBAcmV0dXJucyB7eyBpc1ZhbGlkOiBib29sZWFuLCBhYnNvbHV0ZVBhdGg/OiBzdHJpbmcsIGVycm9yPzogc3RyaW5nIH19IC0gT2JqZWN0IGNvbnRhaW5pbmcgdmFsaWRhdGlvbiByZXN1bHRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZUZpbGVQYXRoKGZpbGVQYXRoKSB7XHJcblx0aWYgKCFmaWxlUGF0aCkge1xyXG5cdFx0cmV0dXJuIHsgaXNWYWxpZDogZmFsc2UsIGVycm9yOiAnTWlzc2luZyBmaWxlUGF0aCcgfTtcclxuXHR9XHJcblxyXG5cdGNvbnN0IGFic29sdXRlRmlsZVBhdGggPSBwYXRoLnJlc29sdmUoVklURV9QUk9KRUNUX1JPT1QsIGZpbGVQYXRoKTtcclxuXHJcblx0aWYgKGZpbGVQYXRoLmluY2x1ZGVzKCcuLicpXHJcblx0XHR8fCAhYWJzb2x1dGVGaWxlUGF0aC5zdGFydHNXaXRoKFZJVEVfUFJPSkVDVF9ST09UKVxyXG5cdFx0fHwgYWJzb2x1dGVGaWxlUGF0aC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzJykpIHtcclxuXHRcdHJldHVybiB7IGlzVmFsaWQ6IGZhbHNlLCBlcnJvcjogJ0ludmFsaWQgcGF0aCcgfTtcclxuXHR9XHJcblxyXG5cdGlmICghZnMuZXhpc3RzU3luYyhhYnNvbHV0ZUZpbGVQYXRoKSkge1xyXG5cdFx0cmV0dXJuIHsgaXNWYWxpZDogZmFsc2UsIGVycm9yOiAnRmlsZSBub3QgZm91bmQnIH07XHJcblx0fVxyXG5cclxuXHRyZXR1cm4geyBpc1ZhbGlkOiB0cnVlLCBhYnNvbHV0ZVBhdGg6IGFic29sdXRlRmlsZVBhdGggfTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFBhcnNlcyBhIGZpbGUgaW50byBhIEJhYmVsIEFTVFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gYWJzb2x1dGVGaWxlUGF0aCAtIEFic29sdXRlIHBhdGggdG8gZmlsZVxyXG4gKiBAcmV0dXJucyB7b2JqZWN0fSBCYWJlbCBBU1RcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUZpbGVUb0FTVChhYnNvbHV0ZUZpbGVQYXRoKSB7XHJcblx0Y29uc3QgY29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhhYnNvbHV0ZUZpbGVQYXRoLCAndXRmLTgnKTtcclxuXHJcblx0cmV0dXJuIHBhcnNlKGNvbnRlbnQsIHtcclxuXHRcdHNvdXJjZVR5cGU6ICdtb2R1bGUnLFxyXG5cdFx0cGx1Z2luczogWydqc3gnLCAndHlwZXNjcmlwdCddLFxyXG5cdFx0ZXJyb3JSZWNvdmVyeTogdHJ1ZSxcclxuXHR9KTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEZpbmRzIGEgSlNYIG9wZW5pbmcgZWxlbWVudCBhdCBhIHNwZWNpZmljIGxpbmUgYW5kIGNvbHVtblxyXG4gKiBAcGFyYW0ge29iamVjdH0gYXN0IC0gQmFiZWwgQVNUXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBsaW5lIC0gTGluZSBudW1iZXIgKDEtaW5kZXhlZClcclxuICogQHBhcmFtIHtudW1iZXJ9IGNvbHVtbiAtIENvbHVtbiBudW1iZXIgKDAtaW5kZXhlZCBmb3IgZ2V0LWNvZGUtYmxvY2ssIDEtaW5kZXhlZCBmb3IgYXBwbHktZWRpdClcclxuICogQHJldHVybnMge29iamVjdCB8IG51bGx9IEJhYmVsIHBhdGggdG8gdGhlIEpTWCBvcGVuaW5nIGVsZW1lbnRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmaW5kSlNYRWxlbWVudEF0UG9zaXRpb24oYXN0LCBsaW5lLCBjb2x1bW4pIHtcclxuXHRsZXQgdGFyZ2V0Tm9kZVBhdGggPSBudWxsO1xyXG5cdGxldCBjbG9zZXN0Tm9kZVBhdGggPSBudWxsO1xyXG5cdGxldCBjbG9zZXN0RGlzdGFuY2UgPSBJbmZpbml0eTtcclxuXHRjb25zdCBhbGxOb2Rlc09uTGluZSA9IFtdO1xyXG5cclxuXHRjb25zdCB2aXNpdG9yID0ge1xyXG5cdFx0SlNYT3BlbmluZ0VsZW1lbnQocGF0aCkge1xyXG5cdFx0XHRjb25zdCBub2RlID0gcGF0aC5ub2RlO1xyXG5cdFx0XHRpZiAobm9kZS5sb2MpIHtcclxuXHRcdFx0XHQvLyBFeGFjdCBtYXRjaCAod2l0aCB0b2xlcmFuY2UgZm9yIG9mZi1ieS1vbmUgY29sdW1uIGRpZmZlcmVuY2VzKVxyXG5cdFx0XHRcdGlmIChub2RlLmxvYy5zdGFydC5saW5lID09PSBsaW5lXHJcblx0XHRcdFx0XHQmJiBNYXRoLmFicyhub2RlLmxvYy5zdGFydC5jb2x1bW4gLSBjb2x1bW4pIDw9IDEpIHtcclxuXHRcdFx0XHRcdHRhcmdldE5vZGVQYXRoID0gcGF0aDtcclxuXHRcdFx0XHRcdHBhdGguc3RvcCgpO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gVHJhY2sgYWxsIG5vZGVzIG9uIHRoZSBzYW1lIGxpbmVcclxuXHRcdFx0XHRpZiAobm9kZS5sb2Muc3RhcnQubGluZSA9PT0gbGluZSkge1xyXG5cdFx0XHRcdFx0YWxsTm9kZXNPbkxpbmUucHVzaCh7XHJcblx0XHRcdFx0XHRcdHBhdGgsXHJcblx0XHRcdFx0XHRcdGNvbHVtbjogbm9kZS5sb2Muc3RhcnQuY29sdW1uLFxyXG5cdFx0XHRcdFx0XHRkaXN0YW5jZTogTWF0aC5hYnMobm9kZS5sb2Muc3RhcnQuY29sdW1uIC0gY29sdW1uKSxcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gVHJhY2sgY2xvc2VzdCBtYXRjaCBvbiB0aGUgc2FtZSBsaW5lIGZvciBmYWxsYmFja1xyXG5cdFx0XHRcdGlmIChub2RlLmxvYy5zdGFydC5saW5lID09PSBsaW5lKSB7XHJcblx0XHRcdFx0XHRjb25zdCBkaXN0YW5jZSA9IE1hdGguYWJzKG5vZGUubG9jLnN0YXJ0LmNvbHVtbiAtIGNvbHVtbik7XHJcblx0XHRcdFx0XHRpZiAoZGlzdGFuY2UgPCBjbG9zZXN0RGlzdGFuY2UpIHtcclxuXHRcdFx0XHRcdFx0Y2xvc2VzdERpc3RhbmNlID0gZGlzdGFuY2U7XHJcblx0XHRcdFx0XHRcdGNsb3Nlc3ROb2RlUGF0aCA9IHBhdGg7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9LFxyXG5cdFx0Ly8gQWxzbyBjaGVjayBKU1hFbGVtZW50IG5vZGVzIHRoYXQgY29udGFpbiB0aGUgcG9zaXRpb25cclxuXHRcdEpTWEVsZW1lbnQocGF0aCkge1xyXG5cdFx0XHRjb25zdCBub2RlID0gcGF0aC5ub2RlO1xyXG5cdFx0XHRpZiAoIW5vZGUubG9jKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBDaGVjayBpZiB0aGlzIGVsZW1lbnQgc3BhbnMgdGhlIHRhcmdldCBsaW5lIChmb3IgbXVsdGktbGluZSBlbGVtZW50cylcclxuXHRcdFx0aWYgKG5vZGUubG9jLnN0YXJ0LmxpbmUgPiBsaW5lIHx8IG5vZGUubG9jLmVuZC5saW5lIDwgbGluZSkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gSWYgd2UncmUgaW5zaWRlIHRoaXMgZWxlbWVudCdzIHJhbmdlLCBjb25zaWRlciBpdHMgb3BlbmluZyBlbGVtZW50XHJcblx0XHRcdGlmICghcGF0aC5ub2RlLm9wZW5pbmdFbGVtZW50Py5sb2MpIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IG9wZW5pbmdMaW5lID0gcGF0aC5ub2RlLm9wZW5pbmdFbGVtZW50LmxvYy5zdGFydC5saW5lO1xyXG5cdFx0XHRjb25zdCBvcGVuaW5nQ29sID0gcGF0aC5ub2RlLm9wZW5pbmdFbGVtZW50LmxvYy5zdGFydC5jb2x1bW47XHJcblxyXG5cdFx0XHQvLyBQcmVmZXIgZWxlbWVudHMgdGhhdCBzdGFydCBvbiB0aGUgZXhhY3QgbGluZVxyXG5cdFx0XHRpZiAob3BlbmluZ0xpbmUgPT09IGxpbmUpIHtcclxuXHRcdFx0XHRjb25zdCBkaXN0YW5jZSA9IE1hdGguYWJzKG9wZW5pbmdDb2wgLSBjb2x1bW4pO1xyXG5cdFx0XHRcdGlmIChkaXN0YW5jZSA8IGNsb3Nlc3REaXN0YW5jZSkge1xyXG5cdFx0XHRcdFx0Y2xvc2VzdERpc3RhbmNlID0gZGlzdGFuY2U7XHJcblx0XHRcdFx0XHRjbG9zZXN0Tm9kZVBhdGggPSBwYXRoLmdldCgnb3BlbmluZ0VsZW1lbnQnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBIYW5kbGUgZWxlbWVudHMgdGhhdCBzdGFydCBiZWZvcmUgdGhlIHRhcmdldCBsaW5lXHJcblx0XHRcdGlmIChvcGVuaW5nTGluZSA8IGxpbmUpIHtcclxuXHRcdFx0XHRjb25zdCBkaXN0YW5jZSA9IChsaW5lIC0gb3BlbmluZ0xpbmUpICogMTAwOyAvLyBQZW5hbGl6ZSBieSBsaW5lIGRpc3RhbmNlXHJcblx0XHRcdFx0aWYgKGRpc3RhbmNlIDwgY2xvc2VzdERpc3RhbmNlKSB7XHJcblx0XHRcdFx0XHRjbG9zZXN0RGlzdGFuY2UgPSBkaXN0YW5jZTtcclxuXHRcdFx0XHRcdGNsb3Nlc3ROb2RlUGF0aCA9IHBhdGguZ2V0KCdvcGVuaW5nRWxlbWVudCcpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSxcclxuXHR9O1xyXG5cclxuXHR0cmF2ZXJzZUJhYmVsLmRlZmF1bHQoYXN0LCB2aXNpdG9yKTtcclxuXHJcblx0Ly8gUmV0dXJuIGV4YWN0IG1hdGNoIGlmIGZvdW5kLCBvdGhlcndpc2UgcmV0dXJuIGNsb3Nlc3QgbWF0Y2ggaWYgd2l0aGluIHJlYXNvbmFibGUgZGlzdGFuY2VcclxuXHQvLyBVc2UgbGFyZ2VyIHRocmVzaG9sZCAoNTAgY2hhcnMpIGZvciBzYW1lLWxpbmUgZWxlbWVudHMsIDUgbGluZXMgZm9yIG11bHRpLWxpbmUgZWxlbWVudHNcclxuXHRjb25zdCB0aHJlc2hvbGQgPSBjbG9zZXN0RGlzdGFuY2UgPCAxMDAgPyA1MCA6IDUwMDtcclxuXHRyZXR1cm4gdGFyZ2V0Tm9kZVBhdGggfHwgKGNsb3Nlc3REaXN0YW5jZSA8PSB0aHJlc2hvbGQgPyBjbG9zZXN0Tm9kZVBhdGggOiBudWxsKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENoZWNrcyBpZiBhIEpTWCBlbGVtZW50IG5hbWUgaXMgYmxhY2tsaXN0ZWRcclxuICogQHBhcmFtIHtvYmplY3R9IGpzeE9wZW5pbmdFbGVtZW50IC0gQmFiZWwgSlNYIG9wZW5pbmcgZWxlbWVudCBub2RlXHJcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIGJsYWNrbGlzdGVkXHJcbiAqL1xyXG5mdW5jdGlvbiBpc0JsYWNrbGlzdGVkQ29tcG9uZW50KGpzeE9wZW5pbmdFbGVtZW50KSB7XHJcblx0aWYgKCFqc3hPcGVuaW5nRWxlbWVudCB8fCAhanN4T3BlbmluZ0VsZW1lbnQubmFtZSkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0Ly8gSGFuZGxlIEpTWElkZW50aWZpZXIgKGUuZy4sIDxIZWxtZXQ+KVxyXG5cdGlmIChpc0pTWElkZW50aWZpZXIoanN4T3BlbmluZ0VsZW1lbnQubmFtZSkpIHtcclxuXHRcdHJldHVybiBDT01QT05FTlRfQkxBQ0tMSVNULmhhcyhqc3hPcGVuaW5nRWxlbWVudC5uYW1lLm5hbWUpO1xyXG5cdH1cclxuXHJcblx0Ly8gSGFuZGxlIEpTWE1lbWJlckV4cHJlc3Npb24gKGUuZy4sIDxSZWFjdC5GcmFnbWVudD4pXHJcblx0aWYgKGlzSlNYTWVtYmVyRXhwcmVzc2lvbihqc3hPcGVuaW5nRWxlbWVudC5uYW1lKSkge1xyXG5cdFx0bGV0IGN1cnJlbnQgPSBqc3hPcGVuaW5nRWxlbWVudC5uYW1lO1xyXG5cdFx0d2hpbGUgKGlzSlNYTWVtYmVyRXhwcmVzc2lvbihjdXJyZW50KSkge1xyXG5cdFx0XHRjdXJyZW50ID0gY3VycmVudC5wcm9wZXJ0eTtcclxuXHRcdH1cclxuXHRcdGlmIChpc0pTWElkZW50aWZpZXIoY3VycmVudCkpIHtcclxuXHRcdFx0cmV0dXJuIENPTVBPTkVOVF9CTEFDS0xJU1QuaGFzKGN1cnJlbnQubmFtZSk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gZmFsc2U7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHZW5lcmF0ZXMgY29kZSBmcm9tIGFuIEFTVCBub2RlXHJcbiAqIEBwYXJhbSB7b2JqZWN0fSBub2RlIC0gQmFiZWwgQVNUIG5vZGVcclxuICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgLSBHZW5lcmF0b3Igb3B0aW9uc1xyXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBHZW5lcmF0ZWQgY29kZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlQ29kZShub2RlLCBvcHRpb25zID0ge30pIHtcclxuXHRjb25zdCBnZW5lcmF0ZUZ1bmN0aW9uID0gZ2VuZXJhdGUuZGVmYXVsdCB8fCBnZW5lcmF0ZTtcclxuXHRjb25zdCBvdXRwdXQgPSBnZW5lcmF0ZUZ1bmN0aW9uKG5vZGUsIG9wdGlvbnMpO1xyXG5cdHJldHVybiBvdXRwdXQuY29kZTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEdlbmVyYXRlcyBhIGZ1bGwgc291cmNlIGZpbGUgZnJvbSBBU1Qgd2l0aCBzb3VyY2UgbWFwc1xyXG4gKiBAcGFyYW0ge29iamVjdH0gYXN0IC0gQmFiZWwgQVNUXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBzb3VyY2VGaWxlTmFtZSAtIFNvdXJjZSBmaWxlIG5hbWUgZm9yIHNvdXJjZSBtYXBcclxuICogQHBhcmFtIHtzdHJpbmd9IG9yaWdpbmFsQ29kZSAtIE9yaWdpbmFsIHNvdXJjZSBjb2RlXHJcbiAqIEByZXR1cm5zIHt7Y29kZTogc3RyaW5nLCBtYXA6IG9iamVjdH19IC0gT2JqZWN0IGNvbnRhaW5pbmcgZ2VuZXJhdGVkIGNvZGUgYW5kIHNvdXJjZSBtYXBcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZVNvdXJjZVdpdGhNYXAoYXN0LCBzb3VyY2VGaWxlTmFtZSwgb3JpZ2luYWxDb2RlKSB7XHJcblx0Y29uc3QgZ2VuZXJhdGVGdW5jdGlvbiA9IGdlbmVyYXRlLmRlZmF1bHQgfHwgZ2VuZXJhdGU7XHJcblx0cmV0dXJuIGdlbmVyYXRlRnVuY3Rpb24oYXN0LCB7XHJcblx0XHRzb3VyY2VNYXBzOiB0cnVlLFxyXG5cdFx0c291cmNlRmlsZU5hbWUsXHJcblx0fSwgb3JpZ2luYWxDb2RlKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEV4dHJhY3RzIGNvZGUgYmxvY2tzIGZyb20gYSBKU1ggZWxlbWVudCBhdCBhIHNwZWNpZmljIGxvY2F0aW9uXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBmaWxlUGF0aCAtIFJlbGF0aXZlIGZpbGUgcGF0aFxyXG4gKiBAcGFyYW0ge251bWJlcn0gbGluZSAtIExpbmUgbnVtYmVyXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBjb2x1bW4gLSBDb2x1bW4gbnVtYmVyXHJcbiAqIEBwYXJhbSB7b2JqZWN0fSBbZG9tQ29udGV4dF0gLSBPcHRpb25hbCBET00gY29udGV4dCB0byByZXR1cm4gb24gZmFpbHVyZVxyXG4gKiBAcmV0dXJucyB7e3N1Y2Nlc3M6IGJvb2xlYW4sIGZpbGVQYXRoPzogc3RyaW5nLCBzcGVjaWZpY0xpbmU/OiBzdHJpbmcsIGVycm9yPzogc3RyaW5nLCBkb21Db250ZXh0Pzogb2JqZWN0fX0gLSBPYmplY3Qgd2l0aCBtZXRhZGF0YSBmb3IgTExNXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdENvZGVCbG9ja3MoZmlsZVBhdGgsIGxpbmUsIGNvbHVtbiwgZG9tQ29udGV4dCkge1xyXG5cdHRyeSB7XHJcblx0XHQvLyBWYWxpZGF0ZSBmaWxlIHBhdGhcclxuXHRcdGNvbnN0IHZhbGlkYXRpb24gPSB2YWxpZGF0ZUZpbGVQYXRoKGZpbGVQYXRoKTtcclxuXHRcdGlmICghdmFsaWRhdGlvbi5pc1ZhbGlkKSB7XHJcblx0XHRcdHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogdmFsaWRhdGlvbi5lcnJvciwgZG9tQ29udGV4dCB9O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFBhcnNlIEFTVFxyXG5cdFx0Y29uc3QgYXN0ID0gcGFyc2VGaWxlVG9BU1QodmFsaWRhdGlvbi5hYnNvbHV0ZVBhdGgpO1xyXG5cclxuXHRcdC8vIEZpbmQgdGFyZ2V0IG5vZGVcclxuXHRcdGNvbnN0IHRhcmdldE5vZGVQYXRoID0gZmluZEpTWEVsZW1lbnRBdFBvc2l0aW9uKGFzdCwgbGluZSwgY29sdW1uKTtcclxuXHJcblx0XHRpZiAoIXRhcmdldE5vZGVQYXRoKSB7XHJcblx0XHRcdHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1RhcmdldCBub2RlIG5vdCBmb3VuZCBhdCBzcGVjaWZpZWQgbGluZS9jb2x1bW4nLCBkb21Db250ZXh0IH07XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gQ2hlY2sgaWYgdGhlIHRhcmdldCBub2RlIGlzIGEgYmxhY2tsaXN0ZWQgY29tcG9uZW50XHJcblx0XHRjb25zdCBpc0JsYWNrbGlzdGVkID0gaXNCbGFja2xpc3RlZENvbXBvbmVudCh0YXJnZXROb2RlUGF0aC5ub2RlKTtcclxuXHJcblx0XHRpZiAoaXNCbGFja2xpc3RlZCkge1xyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdHN1Y2Nlc3M6IHRydWUsXHJcblx0XHRcdFx0ZmlsZVBhdGgsXHJcblx0XHRcdFx0c3BlY2lmaWNMaW5lOiAnJyxcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBHZXQgc3BlY2lmaWMgbGluZSBjb2RlXHJcblx0XHRjb25zdCBzcGVjaWZpY0xpbmUgPSBnZW5lcmF0ZUNvZGUodGFyZ2V0Tm9kZVBhdGgucGFyZW50UGF0aD8ubm9kZSB8fCB0YXJnZXROb2RlUGF0aC5ub2RlKTtcclxuXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRzdWNjZXNzOiB0cnVlLFxyXG5cdFx0XHRmaWxlUGF0aCxcclxuXHRcdFx0c3BlY2lmaWNMaW5lLFxyXG5cdFx0fTtcclxuXHR9IGNhdGNoIChlcnJvcikge1xyXG5cdFx0Y29uc29sZS5lcnJvcignW2FzdC11dGlsc10gRXJyb3IgZXh0cmFjdGluZyBjb2RlIGJsb2NrczonLCBlcnJvcik7XHJcblx0XHRyZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdGYWlsZWQgdG8gZXh0cmFjdCBjb2RlIGJsb2NrcycsIGRvbUNvbnRleHQgfTtcclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBQcm9qZWN0IHJvb3QgcGF0aFxyXG4gKi9cclxuZXhwb3J0IHsgVklURV9QUk9KRUNUX1JPT1QgfTtcclxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxDeWtlc1xcXFxEZXNrdG9wXFxcXEVzcG9sXFxcXHNpc3RlbWEtZ2VzdGlvbi1hZHJcXFxccGx1Z2luc1xcXFx2aXN1YWwtZWRpdG9yXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxDeWtlc1xcXFxEZXNrdG9wXFxcXEVzcG9sXFxcXHNpc3RlbWEtZ2VzdGlvbi1hZHJcXFxccGx1Z2luc1xcXFx2aXN1YWwtZWRpdG9yXFxcXHZpdGUtcGx1Z2luLWVkaXQtbW9kZS5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvQ3lrZXMvRGVza3RvcC9Fc3BvbC9zaXN0ZW1hLWdlc3Rpb24tYWRyL3BsdWdpbnMvdmlzdWFsLWVkaXRvci92aXRlLXBsdWdpbi1lZGl0LW1vZGUuanNcIjtpbXBvcnQgeyByZWFkRmlsZVN5bmMgfSBmcm9tICdmcyc7XHJcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdwYXRoJztcclxuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ3VybCc7XHJcbmltcG9ydCB7IEVESVRfTU9ERV9TVFlMRVMgfSBmcm9tICcuL3Zpc3VhbC1lZGl0b3ItY29uZmlnJztcclxuXHJcbmNvbnN0IF9fZmlsZW5hbWUgPSBmaWxlVVJMVG9QYXRoKGltcG9ydC5tZXRhLnVybCk7XHJcbmNvbnN0IF9fZGlybmFtZSA9IHJlc29sdmUoX19maWxlbmFtZSwgJy4uJyk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBpbmxpbmVFZGl0RGV2UGx1Z2luKCkge1xyXG5cdHJldHVybiB7XHJcblx0XHRuYW1lOiAndml0ZTppbmxpbmUtZWRpdC1kZXYnLFxyXG5cdFx0YXBwbHk6ICdzZXJ2ZScsXHJcblx0XHR0cmFuc2Zvcm1JbmRleEh0bWwoKSB7XHJcblx0XHRcdGNvbnN0IHNjcmlwdFBhdGggPSByZXNvbHZlKF9fZGlybmFtZSwgJ2VkaXQtbW9kZS1zY3JpcHQuanMnKTtcclxuXHRcdFx0Y29uc3Qgc2NyaXB0Q29udGVudCA9IHJlYWRGaWxlU3luYyhzY3JpcHRQYXRoLCAndXRmLTgnKTtcclxuXHJcblx0XHRcdHJldHVybiBbXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0dGFnOiAnc2NyaXB0JyxcclxuXHRcdFx0XHRcdGF0dHJzOiB7IHR5cGU6ICdtb2R1bGUnIH0sXHJcblx0XHRcdFx0XHRjaGlsZHJlbjogc2NyaXB0Q29udGVudCxcclxuXHRcdFx0XHRcdGluamVjdFRvOiAnYm9keSdcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdHRhZzogJ3N0eWxlJyxcclxuXHRcdFx0XHRcdGNoaWxkcmVuOiBFRElUX01PREVfU1RZTEVTLFxyXG5cdFx0XHRcdFx0aW5qZWN0VG86ICdoZWFkJ1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XTtcclxuXHRcdH1cclxuXHR9O1xyXG59XHJcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQ3lrZXNcXFxcRGVza3RvcFxcXFxFc3BvbFxcXFxzaXN0ZW1hLWdlc3Rpb24tYWRyXFxcXHBsdWdpbnNcXFxcdmlzdWFsLWVkaXRvclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQ3lrZXNcXFxcRGVza3RvcFxcXFxFc3BvbFxcXFxzaXN0ZW1hLWdlc3Rpb24tYWRyXFxcXHBsdWdpbnNcXFxcdmlzdWFsLWVkaXRvclxcXFx2aXN1YWwtZWRpdG9yLWNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvQ3lrZXMvRGVza3RvcC9Fc3BvbC9zaXN0ZW1hLWdlc3Rpb24tYWRyL3BsdWdpbnMvdmlzdWFsLWVkaXRvci92aXN1YWwtZWRpdG9yLWNvbmZpZy5qc1wiO2V4cG9ydCBjb25zdCBQT1BVUF9TVFlMRVMgPSBgXHJcbiNpbmxpbmUtZWRpdG9yLXBvcHVwIHtcclxuXHR3aWR0aDogMzYwcHg7XHJcblx0cG9zaXRpb246IGZpeGVkO1xyXG5cdHotaW5kZXg6IDEwMDAwO1xyXG5cdGJhY2tncm91bmQ6ICMxNjE3MTg7XHJcblx0Y29sb3I6IHdoaXRlO1xyXG5cdGJvcmRlcjogMXB4IHNvbGlkICM0YTU1Njg7XHJcblx0Ym9yZGVyLXJhZGl1czogMTZweDtcclxuXHRwYWRkaW5nOiA4cHg7XHJcblx0Ym94LXNoYWRvdzogMCA0cHggMTJweCByZ2JhKDAsMCwwLDAuMik7XHJcblx0ZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuXHRnYXA6IDEwcHg7XHJcblx0ZGlzcGxheTogbm9uZTtcclxufVxyXG5cclxuQG1lZGlhIChtYXgtd2lkdGg6IDc2OHB4KSB7XHJcblx0I2lubGluZS1lZGl0b3ItcG9wdXAge1xyXG5cdFx0d2lkdGg6IGNhbGMoMTAwJSAtIDIwcHgpO1xyXG5cdH1cclxufVxyXG5cclxuI2lubGluZS1lZGl0b3ItcG9wdXAuaXMtYWN0aXZlIHtcclxuXHRkaXNwbGF5OiBmbGV4O1xyXG5cdHRvcDogNTAlO1xyXG5cdGxlZnQ6IDUwJTtcclxuXHR0cmFuc2Zvcm06IHRyYW5zbGF0ZSgtNTAlLCAtNTAlKTtcclxufVxyXG5cclxuI2lubGluZS1lZGl0b3ItcG9wdXAuaXMtZGlzYWJsZWQtdmlldyB7XHJcblx0cGFkZGluZzogMTBweCAxNXB4O1xyXG59XHJcblxyXG4jaW5saW5lLWVkaXRvci1wb3B1cCB0ZXh0YXJlYSB7XHJcblx0aGVpZ2h0OiAxMDBweDtcclxuXHRwYWRkaW5nOiA0cHggOHB4O1xyXG5cdGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xyXG5cdGNvbG9yOiB3aGl0ZTtcclxuXHRmb250LWZhbWlseTogaW5oZXJpdDtcclxuXHRmb250LXNpemU6IDAuODc1cmVtO1xyXG5cdGxpbmUtaGVpZ2h0OiAxLjQyO1xyXG5cdHJlc2l6ZTogbm9uZTtcclxuXHRvdXRsaW5lOiBub25lO1xyXG59XHJcblxyXG4jaW5saW5lLWVkaXRvci1wb3B1cCAuYnV0dG9uLWNvbnRhaW5lciB7XHJcblx0ZGlzcGxheTogZmxleDtcclxuXHRqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtZW5kO1xyXG5cdGdhcDogMTBweDtcclxufVxyXG5cclxuI2lubGluZS1lZGl0b3ItcG9wdXAgLnBvcHVwLWJ1dHRvbiB7XHJcblx0Ym9yZGVyOiBub25lO1xyXG5cdHBhZGRpbmc6IDZweCAxNnB4O1xyXG5cdGJvcmRlci1yYWRpdXM6IDhweDtcclxuXHRjdXJzb3I6IHBvaW50ZXI7XHJcblx0Zm9udC1zaXplOiAwLjc1cmVtO1xyXG5cdGZvbnQtd2VpZ2h0OiA3MDA7XHJcblx0aGVpZ2h0OiAzNHB4O1xyXG5cdG91dGxpbmU6IG5vbmU7XHJcbn1cclxuXHJcbiNpbmxpbmUtZWRpdG9yLXBvcHVwIC5zYXZlLWJ1dHRvbiB7XHJcblx0YmFja2dyb3VuZDogIzY3M2RlNjtcclxuXHRjb2xvcjogd2hpdGU7XHJcbn1cclxuXHJcbiNpbmxpbmUtZWRpdG9yLXBvcHVwIC5jYW5jZWwtYnV0dG9uIHtcclxuXHRiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuXHRib3JkZXI6IDFweCBzb2xpZCAjM2IzZDRhO1xyXG5cdGNvbG9yOiB3aGl0ZTtcclxuXHJcblx0Jjpob3ZlciB7XHJcblx0YmFja2dyb3VuZDojNDc0OTU4O1xyXG5cdH1cclxufVxyXG5gO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldFBvcHVwSFRNTFRlbXBsYXRlKHNhdmVMYWJlbCwgY2FuY2VsTGFiZWwpIHtcclxuXHRyZXR1cm4gYFxyXG5cdDx0ZXh0YXJlYT48L3RleHRhcmVhPlxyXG5cdDxkaXYgY2xhc3M9XCJidXR0b24tY29udGFpbmVyXCI+XHJcblx0XHQ8YnV0dG9uIGNsYXNzPVwicG9wdXAtYnV0dG9uIGNhbmNlbC1idXR0b25cIj4ke2NhbmNlbExhYmVsfTwvYnV0dG9uPlxyXG5cdFx0PGJ1dHRvbiBjbGFzcz1cInBvcHVwLWJ1dHRvbiBzYXZlLWJ1dHRvblwiPiR7c2F2ZUxhYmVsfTwvYnV0dG9uPlxyXG5cdDwvZGl2PlxyXG5cdGA7XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBFRElUX01PREVfU1RZTEVTID0gYFxyXG5cdCNyb290W2RhdGEtZWRpdC1tb2RlLWVuYWJsZWQ9XCJ0cnVlXCJdIFtkYXRhLWVkaXQtaWRdIHtcclxuXHRcdGN1cnNvcjogcG9pbnRlcjsgXHJcblx0XHRvdXRsaW5lOiAycHggZGFzaGVkICMzNTdERjk7IFxyXG5cdFx0b3V0bGluZS1vZmZzZXQ6IDJweDtcclxuXHRcdG1pbi1oZWlnaHQ6IDFlbTtcclxuXHR9XHJcblx0I3Jvb3RbZGF0YS1lZGl0LW1vZGUtZW5hYmxlZD1cInRydWVcIl0gaW1nW2RhdGEtZWRpdC1pZF0ge1xyXG5cdFx0b3V0bGluZS1vZmZzZXQ6IC0ycHg7XHJcblx0fVxyXG5cdCNyb290W2RhdGEtZWRpdC1tb2RlLWVuYWJsZWQ9XCJ0cnVlXCJdIHtcclxuXHRcdGN1cnNvcjogcG9pbnRlcjtcclxuXHR9XHJcblx0I3Jvb3RbZGF0YS1lZGl0LW1vZGUtZW5hYmxlZD1cInRydWVcIl0gW2RhdGEtZWRpdC1pZF06aG92ZXIge1xyXG5cdFx0YmFja2dyb3VuZC1jb2xvcjogIzM1N0RGOTMzO1xyXG5cdFx0b3V0bGluZS1jb2xvcjogIzM1N0RGOTsgXHJcblx0fVxyXG5cclxuXHRAa2V5ZnJhbWVzIGZhZGVJblRvb2x0aXAge1xyXG5cdFx0ZnJvbSB7XHJcblx0XHRcdG9wYWNpdHk6IDA7XHJcblx0XHRcdHRyYW5zZm9ybTogdHJhbnNsYXRlWSg1cHgpO1xyXG5cdFx0fVxyXG5cdFx0dG8ge1xyXG5cdFx0XHRvcGFjaXR5OiAxO1xyXG5cdFx0XHR0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQjaW5saW5lLWVkaXRvci1kaXNhYmxlZC10b29sdGlwIHtcclxuXHRcdGRpc3BsYXk6IG5vbmU7IFxyXG5cdFx0b3BhY2l0eTogMDsgXHJcblx0XHRwb3NpdGlvbjogYWJzb2x1dGU7XHJcblx0XHRiYWNrZ3JvdW5kLWNvbG9yOiAjMUQxRTIwO1xyXG5cdFx0Y29sb3I6IHdoaXRlO1xyXG5cdFx0cGFkZGluZzogNHB4IDhweDtcclxuXHRcdGJvcmRlci1yYWRpdXM6IDhweDtcclxuXHRcdHotaW5kZXg6IDEwMDAxO1xyXG5cdFx0Zm9udC1zaXplOiAxNHB4O1xyXG5cdFx0Ym9yZGVyOiAxcHggc29saWQgIzNCM0Q0QTtcclxuXHRcdG1heC13aWR0aDogMTg0cHg7XHJcblx0XHR0ZXh0LWFsaWduOiBjZW50ZXI7XHJcblx0fVxyXG5cclxuXHQjaW5saW5lLWVkaXRvci1kaXNhYmxlZC10b29sdGlwLnRvb2x0aXAtYWN0aXZlIHtcclxuXHRcdGRpc3BsYXk6IGJsb2NrO1xyXG5cdFx0YW5pbWF0aW9uOiBmYWRlSW5Ub29sdGlwIDAuMnMgZWFzZS1vdXQgZm9yd2FyZHM7XHJcblx0fVxyXG5gO1xyXG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXEN5a2VzXFxcXERlc2t0b3BcXFxcRXNwb2xcXFxcc2lzdGVtYS1nZXN0aW9uLWFkclxcXFxwbHVnaW5zXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxDeWtlc1xcXFxEZXNrdG9wXFxcXEVzcG9sXFxcXHNpc3RlbWEtZ2VzdGlvbi1hZHJcXFxccGx1Z2luc1xcXFx2aXRlLXBsdWdpbi1pZnJhbWUtcm91dGUtcmVzdG9yYXRpb24uanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL0N5a2VzL0Rlc2t0b3AvRXNwb2wvc2lzdGVtYS1nZXN0aW9uLWFkci9wbHVnaW5zL3ZpdGUtcGx1Z2luLWlmcmFtZS1yb3V0ZS1yZXN0b3JhdGlvbi5qc1wiO2V4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGlmcmFtZVJvdXRlUmVzdG9yYXRpb25QbHVnaW4oKSB7XHJcbiAgcmV0dXJuIHtcclxuICAgIG5hbWU6ICd2aXRlOmlmcmFtZS1yb3V0ZS1yZXN0b3JhdGlvbicsXHJcbiAgICBhcHBseTogJ3NlcnZlJyxcclxuICAgIHRyYW5zZm9ybUluZGV4SHRtbCgpIHtcclxuICAgICAgY29uc3Qgc2NyaXB0ID0gYFxyXG4gICAgICBjb25zdCBBTExPV0VEX1BBUkVOVF9PUklHSU5TID0gW1xyXG4gICAgICAgICAgXCJodHRwczovL2hvcml6b25zLmhvc3Rpbmdlci5jb21cIixcclxuICAgICAgICAgIFwiaHR0cHM6Ly9ob3Jpem9ucy5ob3N0aW5nZXIuZGV2XCIsXHJcbiAgICAgICAgICBcImh0dHBzOi8vaG9yaXpvbnMtZnJvbnRlbmQtbG9jYWwuaG9zdGluZ2VyLmRldlwiLFxyXG4gICAgICBdO1xyXG5cclxuICAgICAgICAvLyBDaGVjayB0byBzZWUgaWYgdGhlIHBhZ2UgaXMgaW4gYW4gaWZyYW1lXHJcbiAgICAgICAgaWYgKHdpbmRvdy5zZWxmICE9PSB3aW5kb3cudG9wKSB7XHJcbiAgICAgICAgICBjb25zdCBTVE9SQUdFX0tFWSA9ICdob3Jpem9ucy1pZnJhbWUtc2F2ZWQtcm91dGUnO1xyXG5cclxuICAgICAgICAgIGNvbnN0IGdldEN1cnJlbnRSb3V0ZSA9ICgpID0+IGxvY2F0aW9uLnBhdGhuYW1lICsgbG9jYXRpb24uc2VhcmNoICsgbG9jYXRpb24uaGFzaDtcclxuXHJcbiAgICAgICAgICBjb25zdCBzYXZlID0gKCkgPT4ge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRSb3V0ZSA9IGdldEN1cnJlbnRSb3V0ZSgpO1xyXG4gICAgICAgICAgICAgIHNlc3Npb25TdG9yYWdlLnNldEl0ZW0oU1RPUkFHRV9LRVksIGN1cnJlbnRSb3V0ZSk7XHJcbiAgICAgICAgICAgICAgd2luZG93LnBhcmVudC5wb3N0TWVzc2FnZSh7bWVzc2FnZTogJ3JvdXRlLWNoYW5nZWQnLCByb3V0ZTogY3VycmVudFJvdXRlfSwgJyonKTtcclxuICAgICAgICAgICAgfSBjYXRjaCB7fVxyXG4gICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICBjb25zdCByZXBsYWNlSGlzdG9yeVN0YXRlID0gKHVybCkgPT4ge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgIGhpc3RvcnkucmVwbGFjZVN0YXRlKG51bGwsICcnLCB1cmwpO1xyXG4gICAgICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBQb3BTdGF0ZUV2ZW50KCdwb3BzdGF0ZScsIHsgc3RhdGU6IGhpc3Rvcnkuc3RhdGUgfSkpO1xyXG4gICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9IGNhdGNoIHt9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgY29uc3QgcmVzdG9yZSA9ICgpID0+IHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICBjb25zdCBzYXZlZCA9IHNlc3Npb25TdG9yYWdlLmdldEl0ZW0oU1RPUkFHRV9LRVkpO1xyXG4gICAgICAgICAgICAgIGlmICghc2F2ZWQpIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgICAgaWYgKCFzYXZlZC5zdGFydHNXaXRoKCcvJykpIHtcclxuICAgICAgICAgICAgICAgIHNlc3Npb25TdG9yYWdlLnJlbW92ZUl0ZW0oU1RPUkFHRV9LRVkpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgY29uc3QgY3VycmVudCA9IGdldEN1cnJlbnRSb3V0ZSgpO1xyXG4gICAgICAgICAgICAgIGlmIChjdXJyZW50ICE9PSBzYXZlZCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFyZXBsYWNlSGlzdG9yeVN0YXRlKHNhdmVkKSkge1xyXG4gICAgICAgICAgICAgICAgICByZXBsYWNlSGlzdG9yeVN0YXRlKCcvJyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRleHQgPSAoZG9jdW1lbnQuYm9keT8uaW5uZXJUZXh0IHx8ICcnKS50cmltKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZSByZXN0b3JlZCByb3V0ZSByZXN1bHRzIGluIHRvbyBsaXR0bGUgY29udGVudCwgYXNzdW1lIGl0IGlzIGludmFsaWQgYW5kIG5hdmlnYXRlIGhvbWVcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGV4dC5sZW5ndGggPCA1MCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgcmVwbGFjZUhpc3RvcnlTdGF0ZSgnLycpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7fVxyXG4gICAgICAgICAgICAgICAgfSwgMTAwMCkpO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBjYXRjaCB7fVxyXG4gICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICBjb25zdCBvcmlnaW5hbFB1c2hTdGF0ZSA9IGhpc3RvcnkucHVzaFN0YXRlO1xyXG4gICAgICAgICAgaGlzdG9yeS5wdXNoU3RhdGUgPSBmdW5jdGlvbiguLi5hcmdzKSB7XHJcbiAgICAgICAgICAgIG9yaWdpbmFsUHVzaFN0YXRlLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG4gICAgICAgICAgICBzYXZlKCk7XHJcbiAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgIGNvbnN0IG9yaWdpbmFsUmVwbGFjZVN0YXRlID0gaGlzdG9yeS5yZXBsYWNlU3RhdGU7XHJcbiAgICAgICAgICBoaXN0b3J5LnJlcGxhY2VTdGF0ZSA9IGZ1bmN0aW9uKC4uLmFyZ3MpIHtcclxuICAgICAgICAgICAgb3JpZ2luYWxSZXBsYWNlU3RhdGUuYXBwbHkodGhpcywgYXJncyk7XHJcbiAgICAgICAgICAgIHNhdmUoKTtcclxuICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgY29uc3QgZ2V0UGFyZW50T3JpZ2luID0gKCkgPT4ge1xyXG4gICAgICAgICAgICAgIGlmIChcclxuICAgICAgICAgICAgICAgICAgd2luZG93LmxvY2F0aW9uLmFuY2VzdG9yT3JpZ2lucyAmJlxyXG4gICAgICAgICAgICAgICAgICB3aW5kb3cubG9jYXRpb24uYW5jZXN0b3JPcmlnaW5zLmxlbmd0aCA+IDBcclxuICAgICAgICAgICAgICApIHtcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHdpbmRvdy5sb2NhdGlvbi5hbmNlc3Rvck9yaWdpbnNbMF07XHJcbiAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICBpZiAoZG9jdW1lbnQucmVmZXJyZXIpIHtcclxuICAgICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgVVJMKGRvY3VtZW50LnJlZmVycmVyKS5vcmlnaW47XHJcbiAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIkludmFsaWQgcmVmZXJyZXIgVVJMOlwiLCBkb2N1bWVudC5yZWZlcnJlcik7XHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9wc3RhdGUnLCBzYXZlKTtcclxuICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdoYXNoY2hhbmdlJywgc2F2ZSk7XHJcbiAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgZnVuY3Rpb24gKGV2ZW50KSB7XHJcbiAgICAgICAgICAgICAgY29uc3QgcGFyZW50T3JpZ2luID0gZ2V0UGFyZW50T3JpZ2luKCk7XHJcblxyXG4gICAgICAgICAgICAgIGlmIChldmVudC5kYXRhPy50eXBlID09PSBcInJlZGlyZWN0LWhvbWVcIiAmJiBwYXJlbnRPcmlnaW4gJiYgQUxMT1dFRF9QQVJFTlRfT1JJR0lOUy5pbmNsdWRlcyhwYXJlbnRPcmlnaW4pKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzYXZlZCA9IHNlc3Npb25TdG9yYWdlLmdldEl0ZW0oU1RPUkFHRV9LRVkpO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmKHNhdmVkICYmIHNhdmVkICE9PSAnLycpIHtcclxuICAgICAgICAgICAgICAgICAgcmVwbGFjZUhpc3RvcnlTdGF0ZSgnLycpXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgcmVzdG9yZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgYDtcclxuXHJcbiAgICAgIHJldHVybiBbXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgdGFnOiAnc2NyaXB0JyxcclxuICAgICAgICAgIGF0dHJzOiB7IHR5cGU6ICdtb2R1bGUnIH0sXHJcbiAgICAgICAgICBjaGlsZHJlbjogc2NyaXB0LFxyXG4gICAgICAgICAgaW5qZWN0VG86ICdoZWFkJ1xyXG4gICAgICAgIH1cclxuICAgICAgXTtcclxuICAgIH1cclxuICB9O1xyXG59XHJcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQ3lrZXNcXFxcRGVza3RvcFxcXFxFc3BvbFxcXFxzaXN0ZW1hLWdlc3Rpb24tYWRyXFxcXHBsdWdpbnNcXFxcc2VsZWN0aW9uLW1vZGVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXEN5a2VzXFxcXERlc2t0b3BcXFxcRXNwb2xcXFxcc2lzdGVtYS1nZXN0aW9uLWFkclxcXFxwbHVnaW5zXFxcXHNlbGVjdGlvbi1tb2RlXFxcXHZpdGUtcGx1Z2luLXNlbGVjdGlvbi1tb2RlLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9DeWtlcy9EZXNrdG9wL0VzcG9sL3Npc3RlbWEtZ2VzdGlvbi1hZHIvcGx1Z2lucy9zZWxlY3Rpb24tbW9kZS92aXRlLXBsdWdpbi1zZWxlY3Rpb24tbW9kZS5qc1wiO2ltcG9ydCB7IHJlYWRGaWxlU3luYyB9IGZyb20gJ25vZGU6ZnMnO1xyXG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSAnbm9kZTpwYXRoJztcclxuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ25vZGU6dXJsJztcclxuXHJcbmNvbnN0IF9fZmlsZW5hbWUgPSBmaWxlVVJMVG9QYXRoKGltcG9ydC5tZXRhLnVybCk7XHJcbmNvbnN0IF9fZGlybmFtZSA9IHJlc29sdmUoX19maWxlbmFtZSwgJy4uJyk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzZWxlY3Rpb25Nb2RlUGx1Z2luKCkge1xyXG5cdHJldHVybiB7XHJcblx0XHRuYW1lOiAndml0ZTpzZWxlY3Rpb24tbW9kZScsXHJcblx0XHRhcHBseTogJ3NlcnZlJyxcclxuXHJcblx0XHR0cmFuc2Zvcm1JbmRleEh0bWwoKSB7XHJcblx0XHRcdGNvbnN0IHNjcmlwdFBhdGggPSByZXNvbHZlKF9fZGlybmFtZSwgJ3NlbGVjdGlvbi1tb2RlLXNjcmlwdC5qcycpO1xyXG5cdFx0XHRjb25zdCBzY3JpcHRDb250ZW50ID0gcmVhZEZpbGVTeW5jKHNjcmlwdFBhdGgsICd1dGYtOCcpO1xyXG5cclxuXHRcdFx0cmV0dXJuIFtcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHR0YWc6ICdzY3JpcHQnLFxyXG5cdFx0XHRcdFx0YXR0cnM6IHsgdHlwZTogJ21vZHVsZScgfSxcclxuXHRcdFx0XHRcdGNoaWxkcmVuOiBzY3JpcHRDb250ZW50LFxyXG5cdFx0XHRcdFx0aW5qZWN0VG86ICdib2R5JyxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRdO1xyXG5cdFx0fSxcclxuXHR9O1xyXG59XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBOFUsT0FBT0EsV0FBVTtBQUMvVixPQUFPLFdBQVc7QUFDbEIsU0FBUyxjQUFjLG9CQUFvQjs7O0FDRmlaLE9BQU9DLFdBQVU7QUFDN2MsU0FBUyxTQUFBQyxjQUFhO0FBQ3RCLE9BQU9DLG9CQUFtQjtBQUMxQixZQUFZLE9BQU87QUFDbkIsT0FBT0MsU0FBUTs7O0FDSnlXLE9BQU8sUUFBUTtBQUN2WSxPQUFPLFVBQVU7QUFDakIsU0FBUyxxQkFBcUI7QUFDOUIsT0FBTyxjQUFjO0FBQ3JCLFNBQVMsYUFBYTtBQUN0QixPQUFPLG1CQUFtQjtBQUMxQjtBQUFBLEVBQ0M7QUFBQSxFQUNBO0FBQUEsT0FDTTtBQVQwTyxJQUFNLDJDQUEyQztBQVdsUyxJQUFNLGFBQWEsY0FBYyx3Q0FBZTtBQUNoRCxJQUFNQyxhQUFZLEtBQUssUUFBUSxV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QUNEO0FBRUEsUUFBUSxPQUFPLE1BQU07QUFBQztBQUV0QixJQUFNLFNBQVMsYUFBYTtBQUM1QixJQUFNLGNBQWMsT0FBTztBQUUzQixPQUFPLFFBQVEsQ0FBQyxLQUFLLFlBQVk7QUFuT2pDO0FBb09DLE9BQUksd0NBQVMsVUFBVCxtQkFBZ0IsV0FBVyxTQUFTLDhCQUE4QjtBQUNyRTtBQUFBLEVBQ0Q7QUFFQSxjQUFZLEtBQUssT0FBTztBQUN6QjtBQUVBLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzNCLGNBQWM7QUFBQSxFQUNkLFNBQVM7QUFBQSxJQUNSLEdBQUksUUFBUSxDQUFDLGlCQUFpQixHQUFHLG9CQUFrQixHQUFHLDZCQUE2QixHQUFHLG9CQUFvQixDQUFDLElBQUksQ0FBQztBQUFBLElBQ2hILE1BQU07QUFBQSxJQUNOO0FBQUEsRUFDRDtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sU0FBUztBQUFBLE1BQ1IsZ0NBQWdDO0FBQUEsSUFDakM7QUFBQSxJQUNBLGNBQWM7QUFBQSxFQUNmO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUixZQUFZLENBQUMsUUFBUSxPQUFPLFFBQVEsT0FBTyxPQUFTO0FBQUEsSUFDcEQsT0FBTztBQUFBLE1BQ04sS0FBS0MsTUFBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUNyQztBQUFBLEVBQ0Q7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNOLGVBQWU7QUFBQSxNQUNkLFVBQVU7QUFBQSxRQUNUO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0QsQ0FBQzsiLAogICJuYW1lcyI6IFsicGF0aCIsICJwYXRoIiwgInBhcnNlIiwgInRyYXZlcnNlQmFiZWwiLCAiZnMiLCAiX19kaXJuYW1lIiwgInBhdGgiLCAicGF0aCIsICJwYXJzZSIsICJ0cmF2ZXJzZUJhYmVsIiwgImZzIiwgImZpbGVVUkxUb1BhdGgiLCAiX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCIsICJfX2ZpbGVuYW1lIiwgImZpbGVVUkxUb1BhdGgiLCAiX19kaXJuYW1lIiwgInJlYWRGaWxlU3luYyIsICJyZXNvbHZlIiwgImZpbGVVUkxUb1BhdGgiLCAiX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCIsICJfX2ZpbGVuYW1lIiwgImZpbGVVUkxUb1BhdGgiLCAiX19kaXJuYW1lIiwgInJlc29sdmUiLCAicmVhZEZpbGVTeW5jIiwgInBhdGgiXQp9Cg==
