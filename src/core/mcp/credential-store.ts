// src/core/mcp/credential-store.ts
import * as fs from "fs";
import * as path from "path";
import { execSync, spawn } from "child_process";

export interface MCPCredential {
  serverId: string;
  tokenType: "bearer" | "basic" | "oauth";
  token: string;
  refreshToken?: string;
  expiresAt?: number;
  metadata?: Record<string, any>;
}

interface EncryptedCredential {
  serverId: string;
  encrypted: string;
  platform: "dpapi" | "keychain" | "base64";
  service?: string;
  account?: string;
}

export class MCPCredentialStore {
  private storePath: string;
  private credentials: Map<string, MCPCredential> = new Map();

  constructor(storeDir: string) {
    this.storePath = path.join(storeDir, ".mcp-credentials");
    this.loadFromDisk();
  }

  /**
   * Save credential to secure storage
   */
  async saveCredential(credential: MCPCredential): Promise<void> {
    this.credentials.set(credential.serverId, credential);
    await this.persistToDisk(credential);
  }

  /**
   * Retrieve credential from storage
   */
  async getCredential(serverId: string): Promise<MCPCredential | null> {
    return this.credentials.get(serverId) ?? null;
  }

  /**
   * Check if credential exists and is not expired
   */
  isCredentialValid(serverId: string): boolean {
    const cred = this.credentials.get(serverId);
    if (!cred) return false;

    if (cred.expiresAt && cred.expiresAt < Date.now()) {
      this.credentials.delete(serverId);
      return false;
    }

    return true;
  }

  /**
   * Persist credential to disk with platform-specific encryption
   */
  private async persistToDisk(credential: MCPCredential): Promise<void> {
    const encrypted = await this.encryptCredential(credential);
    const fileName = `${this.sanitizeFileName(credential.serverId)}.json`;
    const filePath = path.join(this.storePath, fileName);

    if (!fs.existsSync(this.storePath)) {
      fs.mkdirSync(this.storePath, { recursive: true, mode: 0o700 });
    }

    fs.writeFileSync(filePath, JSON.stringify(encrypted, null, 2), {
      mode: 0o600,
    });
  }

  /**
   * Load all credentials from disk
   */
  private loadFromDisk(): void {
    if (!fs.existsSync(this.storePath)) {
      return;
    }

    const files = fs.readdirSync(this.storePath);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      try {
        const filePath = path.join(this.storePath, file);
        const encrypted = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const credential = this.decryptCredential(encrypted);
        this.credentials.set(credential.serverId, credential);
      } catch (error) {
        console.error(`[MCP] Failed to load credential ${file}:`, error);
      }
    }
  }

  /**
   * Platform-specific encryption
   */
  private async encryptCredential(
    credential: MCPCredential
  ): Promise<EncryptedCredential> {
    const platform = process.platform;

    if (platform === "win32") {
      return this.encryptWithDPAPI(credential);
    } else if (platform === "darwin") {
      return this.encryptWithKeychain(credential);
    } else {
      return this.encryptWithBase64(credential);
    }
  }

  /**
   * Windows DPAPI Encryption
   */
  private encryptWithDPAPI(credential: MCPCredential): EncryptedCredential {
    try {
      const plaintext = JSON.stringify(credential);
      const tempFile = path.join(this.storePath, ".temp-encrypt");

      // Write plaintext to temp file
      fs.writeFileSync(tempFile, plaintext);

      // Use PowerShell to encrypt via DPAPI
      const script = `
        [System.Text.Encoding]::UTF8.GetBytes('${plaintext.replace(/'/g, "''")}') |
        ForEach-Object {
          [System.Security.Cryptography.ProtectedData]::Protect(
            $_,
            $null,
            [System.Security.Cryptography.DataProtectionScope]::CurrentUser
          )
        } | ForEach-Object { $_.ToString('X2') }
      `;

      const encrypted = execSync(`powershell -Command "${script}"`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();

      // Clean up temp file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }

      return {
        serverId: credential.serverId,
        encrypted: encrypted,
        platform: "dpapi",
      };
    } catch (error) {
      console.error(
        "[MCP] DPAPI encryption failed, falling back to base64:",
        error
      );
      return this.encryptWithBase64(credential);
    }
  }

  /**
   * macOS Keychain Storage
   */
  private encryptWithKeychain(credential: MCPCredential): EncryptedCredential {
    try {
      const service = "Claude Code MCP";
      const account = `mcp-${credential.serverId}`;
      const password = JSON.stringify(credential);

      // Try to update existing entry first
      try {
        execSync(
          `security update-generic-password -s "${service}" -a "${account}" -w "${password.replace(/"/g, '\\"')}" 2>/dev/null`,
          { stdio: "ignore" }
        );
      } catch {
        // If update fails, create new entry
        execSync(
          `security add-generic-password -s "${service}" -a "${account}" -w "${password.replace(/"/g, '\\"')}"`,
          { stdio: "ignore" }
        );
      }

      return {
        serverId: credential.serverId,
        platform: "keychain",
        service: service,
        account: account,
      };
    } catch (error) {
      console.error(
        "[MCP] Keychain storage failed, falling back to base64:",
        error
      );
      return this.encryptWithBase64(credential);
    }
  }

  /**
   * Fallback Base64 Encoding
   */
  private encryptWithBase64(credential: MCPCredential): EncryptedCredential {
    const plaintext = JSON.stringify(credential);
    return {
      serverId: credential.serverId,
      encrypted: Buffer.from(plaintext).toString("base64"),
      platform: "base64",
    };
  }

  /**
   * Decrypt credential from storage
   */
  private decryptCredential(encrypted: EncryptedCredential): MCPCredential {
    try {
      switch (encrypted.platform) {
        case "dpapi":
          return this.decryptDPAPI(encrypted);
        case "keychain":
          return this.decryptKeychain(encrypted);
        case "base64":
          return JSON.parse(
            Buffer.from(encrypted.encrypted, "base64").toString("utf-8")
          );
        default:
          throw new Error(`Unknown encryption platform: ${encrypted.platform}`);
      }
    } catch (error) {
      console.error("[MCP] Decryption failed:", error);
      throw error;
    }
  }

  /**
   * Decrypt DPAPI
   */
  private decryptDPAPI(encrypted: EncryptedCredential): MCPCredential {
    try {
      const hexString = encrypted.encrypted;
      const script = `
        $hexString = '${hexString}'
        $bytes = [byte[]]($hexString -split '(?<=\\G.{2})' | ForEach-Object { [convert]::toint32($_, 16) })
        $decrypted = [System.Security.Cryptography.ProtectedData]::Unprotect(
          $bytes,
          $null,
          [System.Security.Cryptography.DataProtectionScope]::CurrentUser
        )
        [System.Text.Encoding]::UTF8.GetString($decrypted)
      `;

      const plaintext = execSync(`powershell -Command "${script}"`, {
        encoding: "utf-8",
      }).trim();

      return JSON.parse(plaintext);
    } catch (error) {
      throw new Error(`DPAPI decryption failed: ${error}`);
    }
  }

  /**
   * Decrypt Keychain
   */
  private decryptKeychain(encrypted: EncryptedCredential): MCPCredential {
    try {
      const password = execSync(
        `security find-generic-password -s "${encrypted.service}" -a "${encrypted.account}" -w`,
        { encoding: "utf-8" }
      ).trim();

      return JSON.parse(password);
    } catch (error) {
      throw new Error(`Keychain retrieval failed: ${error}`);
    }
  }

  /**
   * Delete credential
   */
  async deleteCredential(serverId: string): Promise<void> {
    this.credentials.delete(serverId);
    const filePath = path.join(
      this.storePath,
      `${this.sanitizeFileName(serverId)}.json`
    );
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Also try to remove from macOS Keychain
    if (process.platform === "darwin") {
      try {
        execSync(
          `security delete-generic-password -s "Claude Code MCP" -a "mcp-${serverId}" 2>/dev/null`,
          { stdio: "ignore" }
        );
      } catch {
        // Ignore errors
      }
    }
  }

  /**
   * Clear all credentials
   */
  async clearAll(): Promise<void> {
    this.credentials.clear();
    if (fs.existsSync(this.storePath)) {
      fs.rmSync(this.storePath, { recursive: true, force: true });
    }
  }

  /**
   * List all stored credential server IDs
   */
  listCredentials(): string[] {
    return Array.from(this.credentials.keys());
  }

  /**
   * Sanitize filename from server ID
   */
  private sanitizeFileName(serverId: string): string {
    return serverId.replace(/[^a-z0-9-_]/gi, "_").toLowerCase();
  }
}