import type { PaneModel } from '../pane-model'
import { NEW_SESSION_FIELDS } from './new-session-fields'

/**
 * The model after `/clear` or `/resume`: the fetch kept, every pick and
 * the transcript's turns dropped.
 *
 * @param model the model before the switch
 * @returns the reset model
 */
export const afterNewSession = (model: PaneModel): PaneModel => ({
  ...model,
  ...NEW_SESSION_FIELDS,
})
