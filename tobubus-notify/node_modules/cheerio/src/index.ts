/**
 * @file Batteries-included version of Cheerio. This module includes several
 *   convenience methods for loading documents from various sources.
 */

export * from './load-parse.js';
export { contains, merge } from './static.js';
export type * from './types.js';
export type {
  Cheerio,
  CheerioAPI,
  CheerioOptions,
  HTMLParser2Options,
} from './slim.js';

import { adapter as htmlparser2Adapter } from 'parse5-htmlparser2-tree-adapter';
import * as htmlparser2 from 'htmlparser2';
import { ParserStream as Parse5Stream } from 'parse5-parser-stream';
import {
  decodeBuffer,
  DecodeStream,
  type SnifferOptions,
} from 'encoding-sniffer';
import * as undici from 'undici';
import MIMEType from 'whatwg-mimetype';
import { Writable, finished } from 'node:stream';
import type { CheerioAPI } from './load.js';
import {
  flattenOptions,
  type InternalOptions,
  type CheerioOptions,
} from './options.js';
import { load } from './load-parse.js';

/**
 * Sniffs the encoding of a buffer, then creates a querying function bound to a
 * document created from the buffer.
 *
 * @category Loading
 * @example
 *
 * ```js
 * import * as cheerio from 'cheerio';
 *
 * const buffer = fs.readFileSync('index.html');
 * const $ = cheerio.loadBuffer(buffer);
 * ```
 *
 * @param buffer - The buffer to sniff the encoding of.
 * @param options - The options to pass to Cheerio.
 * @returns The loaded document.
 */
export function loadBuffer(
  buffer: Buffer,
  options: DecodeStreamOptions = {},
): CheerioAPI {
  const opts = flattenOptions(options);
  const str = decodeBuffer(buffer, {
    defaultEncoding: opts?.xmlMode ? 'utf8' : 'windows-1252',
    ...options.encoding,
  });

  return load(str, opts);
}

function _stringStream(
  options: InternalOptions | undefined,
  cb: (err: Error | null | undefined, $: CheerioAPI) => void,
): Writable {
  if (options?._useHtmlParser2) {
    const parser = htmlparser2.createDocumentStream(
      (err, document) => cb(err, load(document, options)),
      options,
    );

    return new Writable({
      decodeStrings: false,
      write(chunk, _encoding, callback) {
        if (typeof chunk !== 'string') {
          throw new TypeError('Expected a string');
        }

        parser.write(chunk);
        callback();
      },
      final(callback) {
        parser.end();
        callback();
      },
    });
  }

  options ??= {};
  options.treeAdapter ??= htmlparser2Adapter;

  if (options.scriptingEnabled !== false) {
    options.scriptingEnabled = true;
  }

  const stream = new Parse5Stream(options);

  finished(stream, (err) => cb(err, load(stream.document, options)));

  return stream;
}

/**
 * Creates a stream that parses a sequence of strings into a document.
 *
 * The stream is a `Writable` stream that accepts strings. When the stream is
 * finished, the callback is called with the loaded document.
 *
 * @category Loading
 * @example
 *
 * ```js
 * import * as cheerio from 'cheerio';
 * import * as fs from 'fs';
 *
 * const writeStream = cheerio.stringStream({}, (err, $) => {
 *   if (err) {
 *     // Handle error
 *   }
 *
 *   console.log($('h1').text());
 *   // Output: Hello, world!
 * });
 *
 * fs.createReadStream('my-document.html', { encoding: 'utf8' }).pipe(
 *   writeStream,
 * );
 * ```
 *
 * @param options - The options to pass to Cheerio.
 * @param cb - The callback to call when the stream is finished.
 * @returns The writable stream.
 */
export function stringStream(
  options: CheerioOptions,
  cb: (err: Error | null | undefined, $: CheerioAPI) => void,
): Writable {
  return _stringStream(flattenOptions(options), cb);
}

export interface DecodeStreamOptions extends CheerioOptions {
  encoding?: SnifferOptions;
}

/**
 * Parses a stream of buffers into a document.
 *
 * The stream is a `Writable` stream that accepts buffers. When the stream is
 * finished, the callback is called with the loaded document.
 *
 * @category Loading
 * @param options - The options to pass to Cheerio.
 * @param cb - The callback to call when the stream is finished.
 * @returns The writable stream.
 */
export function decodeStream(
  options: DecodeStreamOptions,
  cb: (err: Error | null | undefined, $: CheerioAPI) => void,
): Writable {
  const { encoding = {}, ...cheerioOptions } = options;
  const opts = flattenOptions(cheerioOptions);

  // Set the default encoding to UTF-8 for XML mode
  encoding.defaultEncoding ??= opts?.xmlMode ? 'utf8' : 'windows-1252';

  const decodeStream = new DecodeStream(encoding);
  const loadStream = _stringStream(opts, cb);

  decodeStream.pipe(loadStream);

  return decodeStream;
}

type UndiciStreamOptions = Omit<
  undici.Dispatcher.RequestOptions<unknown>,
  'path'
>;

export interface CheerioRequestOptions extends DecodeStreamOptions {
  /** The options passed to `undici`'s `stream` method. */
  requestOptions?: UndiciStreamOptions;
}

const defaultRequestOptions: UndiciStreamOptions = {
  method: 'GET',
  // Set an Accept header
  headers: {
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
};

/**
 * `fromURL` loads a document from a URL.
 *
 * By default, redirects are allowed and non-2xx responses are rejected.
 *
 * @category Loading
 * @example
 *
 * ```js
 * import * as cheerio from 'cheerio';
 *
 * const $ = await cheerio.fromURL('https://example.com');
 * ```
 *
 * @param url - The URL to load the document from.
 * @param options - The options to pass to Cheerio.
 * @returns The loaded document.
 */
export async function fromURL(
  url: string | URL,
  options: CheerioRequestOptions = {},
): Promise<CheerioAPI> {
  const {
    requestOptions = defaultRequestOptions,
    encoding = {},
    ...cheerioOptions
  } = options;
  let undiciStream: Promise<undici.Dispatcher.StreamData<unknown>> | undefined;

  // Add headers if none were supplied.
  const urlObject = typeof url === 'string' ? new URL(url) : url;
  const streamOptions = {
    headers: defaultRequestOptions.headers,
    path: urlObject.pathname + urlObject.search,
    ...requestOptions,
  };

  const promise = new Promise<CheerioAPI>((resolve, reject) => {
    undiciStream = new undici.Client(urlObject.origin)
      .compose(undici.interceptors.redirect({ maxRedirections: 5 }))
      .stream(streamOptions, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          throw new undici.errors.ResponseError(
            'Response Error',
            res.statusCode,
            {
              headers: res.headers,
            },
          );
        }

        const contentTypeHeader = res.headers['content-type'] ?? 'text/html';
        const mimeType = new MIMEType(
          Array.isArray(contentTypeHeader)
            ? contentTypeHeader[0]
            : contentTypeHeader,
        );

        if (!mimeType.isHTML() && !mimeType.isXML()) {
          throw new RangeError(
            `The content-type "${mimeType.essence}" is neither HTML nor XML.`,
          );
        }

        // Forward the charset from the header to the decodeStream.
        encoding.transportLayerEncodingLabel =
          mimeType.parameters.get('charset');

        /*
         * If we allow redirects, we will have entries in the history.
         * The last entry will be the final URL.
         */
        const history = (
          res.context as
            | {
                history?: URL[];
              }
            | undefined
        )?.history;
        // Set the `baseURI` to the final URL.
        const baseURI = history ? history[history.length - 1] : urlObject;

        const opts: DecodeStreamOptions = {
          encoding,
          // Set XML mode based on the MIME type.
          xmlMode: mimeType.isXML(),
          baseURI,
          ...cheerioOptions,
        };

        return decodeStream(opts, (err, $) => (err ? reject(err) : resolve($)));
      });
  });

  // Let's make sure the request is completed before returning the promise.
  await undiciStream;

  return promise;
}
