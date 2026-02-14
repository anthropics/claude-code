<h1 align="center">cheerio</h1>

<h5 align="center">The fast, flexible, and elegant library for parsing and manipulating HTML and XML.</h5>

<div align="center">
  <a href="https://github.com/cheeriojs/cheerio/actions/workflows/ci.yml">
    <img src="https://github.com/cheeriojs/cheerio/actions/workflows/ci.yml/badge.svg" alt="Build Status">
  </a>
  <a href="https://coveralls.io/github/cheeriojs/cheerio">
    <img src="https://img.shields.io/coveralls/github/cheeriojs/cheerio/main" alt="Coverage">
  </a>
  <a href="#backers">
    <img src="https://img.shields.io/opencollective/backers/cheerio" alt="OpenCollective backers">
  </a>
  <a href="#sponsors">
    <img src="https://img.shields.io/opencollective/sponsors/cheerio" alt="OpenCollective sponsors">
  </a>
</div>

<br>

[中文文档 (Chinese Readme)](https://github.com/cheeriojs/cheerio/wiki/Chinese-README)

```js
import * as cheerio from 'cheerio';
const $ = cheerio.load('<h2 class="title">Hello world</h2>');

$('h2.title').text('Hello there!');
$('h2').addClass('welcome');

$.html();
//=> <html><head></head><body><h2 class="title welcome">Hello there!</h2></body></html>
```

## Installation

Install Cheerio using a package manager like npm, yarn, or bun.

```bash
npm install cheerio
# or
bun add cheerio
```

## Features

**&#10084; Proven syntax:** Cheerio implements a subset of core jQuery. Cheerio
removes all the DOM inconsistencies and browser cruft from the jQuery library,
revealing its truly gorgeous API.

**&#991; Blazingly fast:** Cheerio works with a very simple, consistent DOM
model. As a result parsing, manipulating, and rendering are incredibly
efficient.

**&#10049; Incredibly flexible:** Cheerio wraps around
[parse5](https://github.com/inikulin/parse5) for parsing HTML and can optionally
use the forgiving [htmlparser2](https://github.com/fb55/htmlparser2/). Cheerio
can parse nearly any HTML or XML document. Cheerio works in both browser and
server environments.

## API

### Loading

First you need to load in the HTML. This step in jQuery is implicit, since
jQuery operates on the one, baked-in DOM. With Cheerio, we need to pass in the
HTML document.

```js
// ESM or TypeScript:
import * as cheerio from 'cheerio';

// In other environments:
const cheerio = require('cheerio');

const $ = cheerio.load('<ul id="fruits">...</ul>');

$.html();
//=> <html><head></head><body><ul id="fruits">...</ul></body></html>
```

### Selectors

Once you've loaded the HTML, you can use jQuery-style selectors to find elements
within the document.

#### \$( selector, [context], [root] )

`selector` searches within the `context` scope which searches within the `root`
scope. `selector` and `context` can be a string expression, DOM Element, array
of DOM elements, or cheerio object. `root`, if provided, is typically the HTML
document string.

This selector method is the starting point for traversing and manipulating the
document. Like in jQuery, it's the primary method for selecting elements in the
document.

```js
$('.apple', '#fruits').text();
//=> Apple

$('ul .pear').attr('class');
//=> pear

$('li[class=orange]').html();
//=> Orange
```

### Rendering

When you're ready to render the document, you can call the `html` method on the
"root" selection:

```js
$.root().html();
//=>  <html>
//      <head></head>
//      <body>
//        <ul id="fruits">
//          <li class="apple">Apple</li>
//          <li class="orange">Orange</li>
//          <li class="pear">Pear</li>
//        </ul>
//      </body>
//    </html>
```

If you want to render the
[`outerHTML`](https://developer.mozilla.org/en-US/docs/Web/API/Element/outerHTML)
of a selection, you can use the `outerHTML` prop:

```js
$('.pear').prop('outerHTML');
//=> <li class="pear">Pear</li>
```

You may also render the text content of a Cheerio object using the `text`
method:

```js
const $ = cheerio.load('This is <em>content</em>.');
$('body').text();
//=> This is content.
```

### The "DOM Node" object

Cheerio collections are made up of objects that bear some resemblance to
[browser-based DOM nodes](https://developer.mozilla.org/en-US/docs/Web/API/Node).
You can expect them to define the following properties:

- `tagName`
- `parentNode`
- `previousSibling`
- `nextSibling`
- `nodeValue`
- `firstChild`
- `childNodes`
- `lastChild`

## Screencasts

[https://vimeo.com/31950192](https://vimeo.com/31950192)

> This video tutorial is a follow-up to Nettut's "How to Scrape Web Pages with
> Node.js and jQuery", using cheerio instead of JSDOM + jQuery. This video shows
> how easy it is to use cheerio and how much faster cheerio is than JSDOM +
> jQuery.

## Cheerio in the real world

Are you using cheerio in production? Add it to the
[wiki](https://github.com/cheeriojs/cheerio/wiki/Cheerio-in-Production)!

## Sponsors

Does your company use Cheerio in production? Please consider
[sponsoring this project](https://github.com/cheeriojs/cheerio?sponsor=1)! Your
help will allow maintainers to dedicate more time and resources to its
development and support.

**Headlining Sponsors**

<!-- BEGIN SPONSORS: headliner -->

<a href="https://tidelift.com/subscription/pkg/npm-cheerio" target="_blank" rel="noopener noreferrer">
            <img height="128px" width="128px" src="https://humble.imgix.net/https%3A%2F%2Fgithub.com%2Ftidelift.png?ixlib=js-3.8.0&w=128&h=128&fit=fillmax&fill=solid&s=0713e6ee5c7ab01e7559df695c1e8cd9" title="Tidelift" alt="Tidelift"></img>
          </a>
<a href="https://github.com/" target="_blank" rel="noopener noreferrer">
            <img height="128px" width="128px" src="https://humble.imgix.net/https%3A%2F%2Fgithub.com%2Fgithub.png?ixlib=js-3.8.0&w=128&h=128&fit=fillmax&fill=solid&s=a1e87ca289de84eb32ea85432cf8ad11" title="Github" alt="Github"></img>
          </a>
<a href="https://www.airbnb.com/" target="_blank" rel="noopener noreferrer">
            <img height="128px" width="128px" src="https://humble.imgix.net/https%3A%2F%2Fgithub.com%2Fairbnb.png?ixlib=js-3.8.0&w=128&h=128&fit=fillmax&fill=solid&s=384cad45e10faea516202ad10801f895" title="AirBnB" alt="AirBnB"></img>
          </a>
<a href="https://hasdata.com" target="_blank" rel="noopener noreferrer">
            <img height="128px" width="128px" src="https://humble.imgix.net/https%3A%2F%2Fhasdata.com%2Ffavicon.svg?ixlib=js-3.8.0&w=128&h=128&fit=fillmax&fill=solid&s=21933842d61dec74a961fc57754e58cb" title="HasData" alt="HasData"></img>
          </a>

<!-- END SPONSORS -->

**Other Sponsors**

<!-- BEGIN SPONSORS: sponsor -->

<a href="https://onlinecasinosspelen.com" target="_blank" rel="noopener noreferrer">
            <img height="64px" width="64px" src="https://humble.imgix.net/https%3A%2F%2Fimages.opencollective.com%2Fonlinecasinosspelen%2F99ac6a2%2Flogo.png?ixlib=js-3.8.0&w=64&h=64&fit=fillmax&fill=solid&s=8ec1ec058845b823858f22205485be02" title="OnlineCasinosSpelen" alt="OnlineCasinosSpelen"></img>
          </a>
<a href="https://Nieuwe-Casinos.net" target="_blank" rel="noopener noreferrer">
            <img height="64px" width="64px" src="https://humble.imgix.net/https%3A%2F%2Fimages.opencollective.com%2Fnieuwecasinos%2Fc67d423%2Flogo.png?ixlib=js-3.8.0&w=64&h=64&fit=fillmax&fill=solid&s=ed55d86b80b1aa8cf89b033020521945" title="Nieuwe-Casinos.net" alt="Nieuwe-Casinos.net"></img>
          </a>

<!-- END SPONSORS -->

## Backers

[Become a backer](https://github.com/cheeriojs/cheerio?sponsor=1) to show your
support for Cheerio and help us maintain and improve this open source project.

<!-- BEGIN SPONSORS: backer -->

<a href="https://kafidoff.com" target="_blank" rel="noopener noreferrer">
            <img height="64px" width="64px" src="https://humble.imgix.net/https%3A%2F%2Fimages.opencollective.com%2Fkafidoff-vasy%2Fd7ff85c%2Favatar.png?ixlib=js-3.8.0&w=64&h=64&fit=fillmax&fill=solid&s=a41c66c2f9b1d3a7a241e425e7aa2d09" title="Vasy Kafidoff" alt="Vasy Kafidoff"></img>
          </a>

<!-- END SPONSORS -->

## License

MIT
