import { CONFIG_TYPES } from "../../../core/config/config_manager.js";
import fs from "fs-extra";
import path from "path";
import { expect } from "chai";

describe("Configuration and I18n Integration", () => {
  const tempConfigDir = path.join(__dirname, "temp_configs");
  const i18nConfigPath = path.join(tempConfigDir, "i18n_config.json");
  const loggingConfigPath = path.join(tempConfigDir, "logging_config.json");

  const testConfigs = {
    i18n: {
      defaultLocale: "en",
      availableLocales: ["en", "de", "fr"],
      fallbackStrategy: "localeThenKey",
    },
    logging: {
      level: "debug",
      colorize: true,
      timestampFormat: "YYYY-MM-DD HH:mm:ss.SSS",
    },
  };

  beforeAll(async () => {
    await fs.ensureDir(tempConfigDir);

    // Create test config files
    await Promise.all([
      fs.writeJson(i18nConfigPath, testConfigs.i18n),
      fs.writeJson(loggingConfigPath, testConfigs.logging),
    ]);

    // Mock config manager to use our temp dir
    jest.mock("../../../core/config/config_manager", () => {
      const path = require("path"); // Import path inside the mock factory
      const original = jest.requireActual(
        "../../../core/config/config_manager"
      );

      // Define paths directly inside the mock factory
      const tempConfigDir = path.join(__dirname, "temp_configs");
      const i18nConfigPath = path.join(tempConfigDir, "i18n_config.json");
      const loggingConfigPath = path.join(tempConfigDir, "logging_config.json");

      return {
        ...original,
        LOCAL_CONFIG_PATHS: {
          ...original.LOCAL_CONFIG_PATHS,
          [original.CONFIG_TYPES.I18N]: i18nConfigPath,
          [original.CONFIG_TYPES.LOGGING]: loggingConfigPath,
        },
      };
    });
  });

  afterAll(async () => {
    await fs.remove(tempConfigDir);
    jest.unmock("../../../core/config/config_manager");
  });

  it("should load i18n configuration correctly", async () => {
    const configManager = require("../../../core/config/config_manager");
    const i18nConfig = configManager.getConfig(CONFIG_TYPES.I18N);

    expect(i18nConfig).to.deep.include(testConfigs.i18n);
    expect(i18nConfig.supportedLocales).to.include.members(["en", "de", "fr"]);
  });

  it("should load logging configuration correctly", async () => {
    const configManager = require("../../../core/config/config_manager");
    const loggingConfig = configManager.getConfig(CONFIG_TYPES.LOGGING);

    expect(loggingConfig).to.deep.include(testConfigs.logging);
    expect(loggingConfig.level).to.equal("debug");
  });

  it("should maintain config type consistency", () => {
    const configManager = require("../../../core/config/config_manager");

    expect(CONFIG_TYPES.I18N).to.equal("i18n");
    expect(CONFIG_TYPES.LOGGING).to.equal("logging");
    expect(Object.isFrozen(CONFIG_TYPES)).to.be.true;
  });

  it("should handle missing config files with defaults", async () => {
    const configManager = require("../../../core/config/config_manager");
    const ragConfig = configManager.getConfig(CONFIG_TYPES.RAG);

    expect(ragConfig).to.have.property("version");
    expect(ragConfig.database).to.have.property("type");
  });
});
