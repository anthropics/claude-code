/**
 * What a person reads when managed policy keeps a mod of theirs out: the
 * rule, the option that set it, and the mod that was not loaded.
 *
 * @param name the refused plugin's name, as its own manifest gives it
 * @returns the refusal line
 */
export const managedModsOnlyRefusal = (name: string) =>
  "mods are limited to your organization's by policy " +
  `(allowManagedModsOnly); ${name} was not loaded`
