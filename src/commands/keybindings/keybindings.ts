import { mkdir, writeFile } from 'fs/promises'
import { dirname } from 'path'
import {
  getKeybindingsPath,
  isKeybindingCustomizationEnabled,
} from '../../keybindings/loadUserBindings.js'
import { generateKeybindingsTemplate } from '../../keybindings/template.js'
import { getErrnoCode } from '../../utils/errors.js'
import { editFileInEditor } from '../../utils/promptEditor.js'

export async function call(): Promise<{ type: 'text'; value: string }> {
  if (!isKeybindingCustomizationEnabled()) {
    return {
      type: 'text',
      value:
        'Keybinding customization is not enabled. This feature is currently in preview.',
    }
  }

  const keybindingsPath = getKeybindingsPath()

  // Write template with 'wx' flag (exclusive create) — fails with EEXIST if
  // the file already exists. Avoids a stat pre-check (TOCTOU race + extra syscall).
  let fileExists = false
  await mkdir(dirname(keybindingsPath), { recursive: true })
  try {
    await writeFile(keybindingsPath, generateKeybindingsTemplate(), {
      encoding: 'utf-8',
      flag: 'wx',
    })
  } catch (e: unknown) {
    if (getErrnoCode(e) === 'EEXIST') {
      fileExists = true
    } else {
      throw e
    }
  }

  // Open in editor
  const result = await editFileInEditor(keybindingsPath)
  if (result.error) {
    return {
      type: 'text',
      value: `${fileExists ? 'Opened' : 'Created'} ${keybindingsPath}. Could not open in editor: ${result.error}`,
    }
  }
  return {
    type: 'text',
    value: fileExists
      ? `Opened ${keybindingsPath} in your editor.`
      : `Created ${keybindingsPath} with template. Opened in your editor.`,
  }
}
