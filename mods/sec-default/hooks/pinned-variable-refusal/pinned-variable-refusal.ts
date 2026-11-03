/**
 * Why a plugin a person installed may not set or unset an environment
 * variable their organization pins: the setting, then the rule.
 *
 * Said too when the policy cannot be read and every variable counts as
 * pinned, so it does not say who set this one.
 *
 * @param name the variable, as the plugin named it
 * @returns the refusal
 */
export const pinnedVariableRefusal = (name: string) =>
  `env (managed): ${name} is not for plugins outside policy to change`
