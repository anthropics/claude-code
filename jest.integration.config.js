export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  transform: {
    "^.+\\.(js|ts)$": ["babel-jest", { configFile: "./.babelrc" }],
  },
  transformIgnorePatterns: ["/node_modules/(?!(chai|fs-extra|path)/)"],
  moduleFileExtensions: ["ts", "js", "json"],
  extensionsToTreatAsEsm: [".ts"],
  testMatch: [
    "**/tests/integration/**/*.test.{js,ts}",
    "**/*.integration.test.{js,ts}",
  ],
  verbose: true,
  setupFilesAfterEnv: ["<rootDir>/tests/jest.integration.setup.js"],
  testTimeout: 15000,
  globals: {
    NODE_ENV: "test",
    __DEV__: true,
  },
};
