{
  "name": "inquirer",
  "version": "8.2.6",
  "description": "A collection of common interactive command line user interfaces.",
  "author": "Simon Boudrias <admin@simonboudrias.com>",
  "files": [
    "lib",
    "README.md"
  ],
  "main": "lib/inquirer.js",
  "keywords": [
    "command",
    "prompt",
    "stdin",
    "cli",
    "tty",
    "menu"
  ],
  "engines": {
    "node": ">=12.0.0"
  },
  "devDependencies": {
    "chai": "^4.3.6",
    "chai-string": "^1.5.0",
    "chalk-pipe": "^5.1.1",
    "cmdify": "^0.0.4",
    "mocha": "^9.2.2",
    "mockery": "^2.1.0",
    "nyc": "^15.0.0",
    "sinon": "^13.0.2",
    "terminal-link": "^2.1.1"
  },
  "scripts": {
    "test": "nyc mocha test/**/* -r ./test/before",
    "posttest": "mkdir -p ../../coverage && nyc report --reporter=text-lcov > ../../coverage/nyc-report.lcov",
    "prepublishOnly": "cp ../../README.md .",
    "postpublish": "rm -f README.md"
  },
  "repository": "SBoudrias/Inquirer.js",
  "license": "MIT",
  "dependencies": {
    "ansi-escapes": "^4.2.1",
    "chalk": "^4.1.1",
    "cli-cursor": "^3.1.0",
    "cli-width": "^3.0.0",
    "external-editor": "^3.0.3",
    "figures": "^3.0.0",
    "lodash": "^4.17.21",
    "mute-stream": "0.0.8",
    "ora": "^5.4.1",
    "run-async": "^2.4.0",
    "rxjs": "^7.5.5",
    "string-width": "^4.1.0",
    "strip-ansi": "^6.0.0",
    "through": "^2.3.6",
    "wrap-ansi": "^6.0.1"
  },
  "gitHead": "30ec0483de28849e56bd6b9b61daaabf8edea16f"
}
