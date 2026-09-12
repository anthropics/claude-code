import { readdir, readFile, stat } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import {
  type McpServerConfig,
  McpStdioServerConfigSchema,
} from '../services/mcp/types.js'
import { getErrnoCode } from './errors.js'
import { safeParseJSON } from './json.js'
import { logError } from './log.js'
import { getPlatform, SUPPORTED_PLATFORMS } from './platform.js'

export async function getClaudeDesktopConfigPath(): Promise<string> {
  const platform = getPlatform()

  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    throw new Error(
      `Unsupported platform: ${platform} - Claude Desktop integration only works on macOS and WSL.`,
    )
  }

  if (platform === 'macos') {
    return join(
      homedir(),
      'Library',
      'Application Support',
      'Claude',
      'claude_desktop_config.json',
    )
  }

  // First, try using USERPROFILE environment variable if available
  const windowsHome = process.env.USERPROFILE
    ? process.env.USERPROFILE.replace(/\\/g, '/') // Convert Windows backslashes to forward slashes
    : null

  if (windowsHome) {
    // Remove drive letter and convert to WSL path format
    const wslPath = windowsHome.replace(/^[A-Z]:/, '')
    const configPath = `/mnt/c${wslPath}/AppData/Roaming/Claude/claude_desktop_config.json`

    // Check if the file exists
    try {
      await stat(configPath)
      return configPath
    } catch {
      // File doesn't exist, continue
    }
  }

  // Alternative approach - try to construct path based on typical Windows user location
  try {
    // List the /mnt/c/Users directory to find potential user directories
    const usersDir = '/mnt/c/Users'

    try {
      const userDirs = await readdir(usersDir, { withFileTypes: true })

      // Look for Claude Desktop config in each user directory
      for (const user of userDirs) {
        if (
          user.name === 'Public' ||
          user.name === 'Default' ||
          user.name === 'Default User' ||
          user.name === 'All Users'
        ) {
          continue // Skip system directories
        }

        const potentialConfigPath = join(
          usersDir,
          user.name,
          'AppData',
          'Roaming',
          'Claude',
          'claude_desktop_config.json',
        )

        try {
          await stat(potentialConfigPath)
          return potentialConfigPath
        } catch {
          // File doesn't exist, continue
        }
      }
    } catch {
      // usersDir doesn't exist or can't be read
    }
  } catch (dirError) {
    logError(dirError)
  }

  throw new Error(
    'Could not find Claude Desktop config file in Windows. Make sure Claude Desktop is installed on Windows.',
  )
}

export async function readClaudeDesktopMcpServers(): Promise<
  Record<string, McpServerConfig>
> {
  if (!SUPPORTED_PLATFORMS.includes(getPlatform())) {
    throw new Error(
      'Unsupported platform - Claude Desktop integration only works on macOS and WSL.',
    )
  }
  try {
    const configPath = await getClaudeDesktopConfigPath()

    let configContent: string
    try {
      configContent = await readFile(configPath, { encoding: 'utf8' })
    } catch (e: unknown) {
      const code = getErrnoCode(e)
      if (code === 'ENOENT') {
        return {}
      }
      throw e
    }

    const config = safeParseJSON(configContent)

    if (!config || typeof config !== 'object') {
      return {}
    }

    const mcpServers = (config as Record<string, unknown>).mcpServers
    if (!mcpServers || typeof mcpServers !== 'object') {
      return {}
    }

    const servers: Record<string, McpServerConfig> = {}

    for (const [name, serverConfig] of Object.entries(
      mcpServers as Record<string, unknown>,
    )) {
      if (!serverConfig || typeof serverConfig !== 'object') {
        continue
      }

      const result = McpStdioServerConfigSchema().safeParse(serverConfig)

      if (result.success) {
        servers[name] = result.data
      }
    }

    return servers
  } catch (error) {
    logError(error)
    return {}
  }
}
