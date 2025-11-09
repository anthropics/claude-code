"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PathError = exports.TokenData = void 0;
exports.parse = parse;
exports.compile = compile;
exports.match = match;
exports.pathToRegexp = pathToRegexp;
exports.stringify = stringify;
const DEFAULT_DELIMITER = "/";
const NOOP_VALUE = (value) => value;
const ID_START = /^[$_\p{ID_Start}]$/u;
const ID_CONTINUE = /^[$\u200c\u200d\p{ID_Continue}]$/u;
const SIMPLE_TOKENS = {
    // Groups.
    "{": "{",
    "}": "}",
    // Reserved.
    "(": "(",
    ")": ")",
    "[": "[",
    "]": "]",
    "+": "+",
    "?": "?",
    "!": "!",
};
/**
 * Escape text for stringify to path.
 */
function escapeText(str) {
    return str.replace(/[{}()\[\]+?!:*\\]/g, "\\$&");
}
/**
 * Escape a regular expression string.
 */
function escape(str) {
    return str.replace(/[.+*?^${}()[\]|/\\]/g, "\\$&");
}
/**
 * Tokenized path instance.
 */
class TokenData {
    constructor(tokens, originalPath) {
        this.tokens = tokens;
        this.originalPath = originalPath;
    }
}
exports.TokenData = TokenData;
/**
 * ParseError is thrown when there is an error processing the path.
 */
class PathError extends TypeError {
    constructor(message, originalPath) {
        let text = message;
        if (originalPath)
            text += `: ${originalPath}`;
        text += `; visit https://git.new/pathToRegexpError for info`;
        super(text);
        this.originalPath = originalPath;
    }
}
exports.PathError = PathError;
/**
 * Parse a string for the raw tokens.
 */
function parse(str, options = {}) {
    const { encodePath = NOOP_VALUE } = options;
    const chars = [...str];
    const tokens = [];
    let index = 0;
    let pos = 0;
    function name() {
        let value = "";
        if (ID_START.test(chars[index])) {
            do {
                value += chars[index++];
            } while (ID_CONTINUE.test(chars[index]));
        }
        else if (chars[index] === '"') {
            let quoteStart = index;
            while (index++ < chars.length) {
                if (chars[index] === '"') {
                    index++;
                    quoteStart = 0;
                    break;
                }
                // Increment over escape characters.
                if (chars[index] === "\\")
                    index++;
                value += chars[index];
            }
            if (quoteStart) {
                throw new PathError(`Unterminated quote at index ${quoteStart}`, str);
            }
        }
        if (!value) {
            throw new PathError(`Missing parameter name at index ${index}`, str);
        }
        return value;
    }
    while (index < chars.length) {
        const value = chars[index];
        const type = SIMPLE_TOKENS[value];
        if (type) {
            tokens.push({ type, index: index++, value });
        }
        else if (value === "\\") {
            tokens.push({ type: "escape", index: index++, value: chars[index++] });
        }
        else if (value === ":") {
            tokens.push({ type: "param", index: index++, value: name() });
        }
        else if (value === "*") {
            tokens.push({ type: "wildcard", index: index++, value: name() });
        }
        else {
            tokens.push({ type: "char", index: index++, value });
        }
    }
    tokens.push({ type: "end", index, value: "" });
    function consumeUntil(endType) {
        const output = [];
        while (true) {
            const token = tokens[pos++];
            if (token.type === endType)
                break;
            if (token.type === "char" || token.type === "escape") {
                let path = token.value;
                let cur = tokens[pos];
                while (cur.type === "char" || cur.type === "escape") {
                    path += cur.value;
                    cur = tokens[++pos];
                }
                output.push({
                    type: "text",
                    value: encodePath(path),
                });
                continue;
            }
            if (token.type === "param" || token.type === "wildcard") {
                output.push({
                    type: token.type,
                    name: token.value,
                });
                continue;
            }
            if (token.type === "{") {
                output.push({
                    type: "group",
                    tokens: consumeUntil("}"),
                });
                continue;
            }
            throw new PathError(`Unexpected ${token.type} at index ${token.index}, expected ${endType}`, str);
        }
        return output;
    }
    return new TokenData(consumeUntil("end"), str);
}
/**
 * Compile a string to a template function for the path.
 */
function compile(path, options = {}) {
    const { encode = encodeURIComponent, delimiter = DEFAULT_DELIMITER } = options;
    const data = typeof path === "object" ? path : parse(path, options);
    const fn = tokensToFunction(data.tokens, delimiter, encode);
    return function path(params = {}) {
        const [path, ...missing] = fn(params);
        if (missing.length) {
            throw new TypeError(`Missing parameters: ${missing.join(", ")}`);
        }
        return path;
    };
}
function tokensToFunction(tokens, delimiter, encode) {
    const encoders = tokens.map((token) => tokenToFunction(token, delimiter, encode));
    return (data) => {
        const result = [""];
        for (const encoder of encoders) {
            const [value, ...extras] = encoder(data);
            result[0] += value;
            result.push(...extras);
        }
        return result;
    };
}
/**
 * Convert a single token into a path building function.
 */
function tokenToFunction(token, delimiter, encode) {
    if (token.type === "text")
        return () => [token.value];
    if (token.type === "group") {
        const fn = tokensToFunction(token.tokens, delimiter, encode);
        return (data) => {
            const [value, ...missing] = fn(data);
            if (!missing.length)
                return [value];
            return [""];
        };
    }
    const encodeValue = encode || NOOP_VALUE;
    if (token.type === "wildcard" && encode !== false) {
        return (data) => {
            const value = data[token.name];
            if (value == null)
                return ["", token.name];
            if (!Array.isArray(value) || value.length === 0) {
                throw new TypeError(`Expected "${token.name}" to be a non-empty array`);
            }
            return [
                value
                    .map((value, index) => {
                    if (typeof value !== "string") {
                        throw new TypeError(`Expected "${token.name}/${index}" to be a string`);
                    }
                    return encodeValue(value);
                })
                    .join(delimiter),
            ];
        };
    }
    return (data) => {
        const value = data[token.name];
        if (value == null)
            return ["", token.name];
        if (typeof value !== "string") {
            throw new TypeError(`Expected "${token.name}" to be a string`);
        }
        return [encodeValue(value)];
    };
}
/**
 * Transform a path into a match function.
 */
function match(path, options = {}) {
    const { decode = decodeURIComponent, delimiter = DEFAULT_DELIMITER } = options;
    const { regexp, keys } = pathToRegexp(path, options);
    const decoders = keys.map((key) => {
        if (decode === false)
            return NOOP_VALUE;
        if (key.type === "param")
            return decode;
        return (value) => value.split(delimiter).map(decode);
    });
    return function match(input) {
        const m = regexp.exec(input);
        if (!m)
            return false;
        const path = m[0];
        const params = Object.create(null);
        for (let i = 1; i < m.length; i++) {
            if (m[i] === undefined)
                continue;
            const key = keys[i - 1];
            const decoder = decoders[i - 1];
            params[key.name] = decoder(m[i]);
        }
        return { path, params };
    };
}
function pathToRegexp(path, options = {}) {
    const { delimiter = DEFAULT_DELIMITER, end = true, sensitive = false, trailing = true, } = options;
    const keys = [];
    const flags = sensitive ? "" : "i";
    const sources = [];
    for (const input of pathsToArray(path, [])) {
        const data = typeof input === "object" ? input : parse(input, options);
        for (const tokens of flatten(data.tokens, 0, [])) {
            sources.push(toRegExpSource(tokens, delimiter, keys, data.originalPath));
        }
    }
    let pattern = `^(?:${sources.join("|")})`;
    if (trailing)
        pattern += `(?:${escape(delimiter)}$)?`;
    pattern += end ? "$" : `(?=${escape(delimiter)}|$)`;
    const regexp = new RegExp(pattern, flags);
    return { regexp, keys };
}
/**
 * Convert a path or array of paths into a flat array.
 */
function pathsToArray(paths, init) {
    if (Array.isArray(paths)) {
        for (const p of paths)
            pathsToArray(p, init);
    }
    else {
        init.push(paths);
    }
    return init;
}
/**
 * Generate a flat list of sequence tokens from the given tokens.
 */
function* flatten(tokens, index, init) {
    if (index === tokens.length) {
        return yield init;
    }
    const token = tokens[index];
    if (token.type === "group") {
        for (const seq of flatten(token.tokens, 0, init.slice())) {
            yield* flatten(tokens, index + 1, seq);
        }
    }
    else {
        init.push(token);
    }
    yield* flatten(tokens, index + 1, init);
}
/**
 * Transform a flat sequence of tokens into a regular expression.
 */
function toRegExpSource(tokens, delimiter, keys, originalPath) {
    let result = "";
    let backtrack = "";
    let isSafeSegmentParam = true;
    for (const token of tokens) {
        if (token.type === "text") {
            result += escape(token.value);
            backtrack += token.value;
            isSafeSegmentParam || (isSafeSegmentParam = token.value.includes(delimiter));
            continue;
        }
        if (token.type === "param" || token.type === "wildcard") {
            if (!isSafeSegmentParam && !backtrack) {
                throw new PathError(`Missing text before "${token.name}" ${token.type}`, originalPath);
            }
            if (token.type === "param") {
                result += `(${negate(delimiter, isSafeSegmentParam ? "" : backtrack)}+)`;
            }
            else {
                result += `([\\s\\S]+)`;
            }
            keys.push(token);
            backtrack = "";
            isSafeSegmentParam = false;
            continue;
        }
    }
    return result;
}
/**
 * Block backtracking on previous text and ignore delimiter string.
 */
function negate(delimiter, backtrack) {
    if (backtrack.length < 2) {
        if (delimiter.length < 2)
            return `[^${escape(delimiter + backtrack)}]`;
        return `(?:(?!${escape(delimiter)})[^${escape(backtrack)}])`;
    }
    if (delimiter.length < 2) {
        return `(?:(?!${escape(backtrack)})[^${escape(delimiter)}])`;
    }
    return `(?:(?!${escape(backtrack)}|${escape(delimiter)})[\\s\\S])`;
}
/**
 * Stringify an array of tokens into a path string.
 */
function stringifyTokens(tokens) {
    let value = "";
    let i = 0;
    function name(value) {
        const isSafe = isNameSafe(value) && isNextNameSafe(tokens[i]);
        return isSafe ? value : JSON.stringify(value);
    }
    while (i < tokens.length) {
        const token = tokens[i++];
        if (token.type === "text") {
            value += escapeText(token.value);
            continue;
        }
        if (token.type === "group") {
            value += `{${stringifyTokens(token.tokens)}}`;
            continue;
        }
        if (token.type === "param") {
            value += `:${name(token.name)}`;
            continue;
        }
        if (token.type === "wildcard") {
            value += `*${name(token.name)}`;
            continue;
        }
        throw new TypeError(`Unknown token type: ${token.type}`);
    }
    return value;
}
/**
 * Stringify token data into a path string.
 */
function stringify(data) {
    return stringifyTokens(data.tokens);
}
/**
 * Validate the parameter name contains valid ID characters.
 */
function isNameSafe(name) {
    const [first, ...rest] = name;
    return ID_START.test(first) && rest.every((char) => ID_CONTINUE.test(char));
}
/**
 * Validate the next token does not interfere with the current param name.
 */
function isNextNameSafe(token) {
    if (token && token.type === "text")
        return !ID_CONTINUE.test(token.value[0]);
    return true;
}
//# sourceMappingURL=index.js.map