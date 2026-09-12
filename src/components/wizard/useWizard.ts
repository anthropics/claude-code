import { useContext } from 'react'
import type { WizardContextValue } from './types.js'
import { WizardContext } from './WizardProvider.js'

export function useWizard<
  T extends Record<string, unknown> = Record<string, unknown>,
>(): WizardContextValue<T> {
  const context = useContext(WizardContext) as WizardContextValue<T> | null
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider')
  }
  return context
}
