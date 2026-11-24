import type { Fields } from '../fields'
import type { Method } from '../method'
import { refusal } from '../refusal'

/**
 * The most characters of a plugin's name a row's name holds, so that the
 * longest event under it stays within 128.
 */
const NAME_LIMIT = 48

/**
 * The keys that say whose row it is.
 */
const OWNER_KEY = /^(?:plugin_|marketplace_|is_official)/

/**
 * The keys read off every row as the CLI's own.
 */
const ROW_KEYS: readonly string[] = [
  'rh',
  'sample_rate',
  'feature_name',
  'error_code',
  'hook_event',
  'provider',
  'prompt_source',
]

/**
 * The keys whose text is read as a model id when the batch leaves.
 */
const MODEL_KEY = /^(?:model|model_id|chain_entry|.*_models?)$/

/**
 * The text read as a model id under any key.
 */
const MODEL_ID = /claude-.*\d/

/**
 * An installed plugin's entry as its own: named `plugin_<name>__<given>`,
 * and stamped with the plugin's id under `pluginId`.
 *
 * `<name>` is the lowercase letters and digits of the id's name half, one `_`
 * between its words, so the first `__` ends it. No name of the CLI's or a
 * built-in's holds `__` there, so none can be spelled.
 *
 * @param pluginId the id of the load that made the call, as the host told it
 * @param fields the event or feature as given, and the checked properties
 * @param method the method called, named in a refusal
 * @returns the name under the plugin's own, and the stamped properties
 */
export function ownedBy(
  pluginId: string,
  { name, props }: Fields,
  method: Method,
): Fields {
  for (const [key, value] of Object.entries(props)) {
    if (OWNER_KEY.test(key) || ROW_KEYS.includes(key)) {
      throw refusal(`props.${key}: this key is reserved`, method)
    }

    const isModel =
      typeof value === 'string' && (MODEL_KEY.test(key) || MODEL_ID.test(value))

    if (isModel) {
      throw refusal(`props.${key}: a Choice names no model`, method)
    }

    // Text under such a key is read as an error's own words.
    if (typeof value === 'string' && key.endsWith('_error')) {
      throw refusal(`props.${key}: takes a number or a boolean`, method)
    }
  }

  const words = pluginId
    .slice(0, pluginId.lastIndexOf('@'))
    .toLowerCase()
    .match(/[a-z0-9]+/g)
  const owner = (words ?? ['unnamed'])
    .join('_')
    .slice(0, NAME_LIMIT)
    .replace(/_$/, '')

  return { name: `plugin_${owner}__${name}`, props: { ...props, pluginId } }
}
