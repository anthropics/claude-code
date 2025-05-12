const fs = require("fs-extra");
const path = require("path");

const sourceDir = path.join(
  __dirname,
  "../backups/schema-ui-integration_20250512_012426/core/i18n/locales"
);
const targetDir = path.join(__dirname, "../core/i18n/locales");

async function syncLocales() {
  try {
    // Ensure target directory exists
    await fs.ensureDir(targetDir);

    // Verify backup directory exists first
    if (!(await fs.pathExists(sourceDir))) {
      throw new Error(`Backup directory not found: ${sourceDir}`);
    }

    // Get list of files and copy with ignore-existing behavior
    const files = await fs.readdir(sourceDir);
    let copiedCount = 0;
    let skippedCount = 0;

    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);

      if (!(await fs.pathExists(targetPath))) {
        await fs.copy(sourcePath, targetPath);
        console.log(`Copied ${file} to locales directory`);
        copiedCount++;
      } else {
        console.log(`Skipped ${file} (already exists)`);
        skippedCount++;
      }
    }

    console.log(
      `\nSync completed: ${copiedCount} files copied, ${skippedCount} files skipped`
    );

    console.log("Locale synchronization completed");
  } catch (err) {
    console.error("Error synchronizing locales:", err);
    process.exit(1);
  }
}

syncLocales();
