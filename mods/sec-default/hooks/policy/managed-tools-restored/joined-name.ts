import { foldedName } from './is-org-tool/tool-prefix-of/folded-name'

/**
 * A tool's name as a model reads it: `OrgAudit`, `org-audit` and `org_audit` are
 * one name, so one may not pass for another. A server's name keeps its separators
 * (`foldedName`), which say where the server's name ends.
 *
 * @param name the name as written
 * @returns the name in lower case, its words run together
 */
export function joinedName(name: string): string {
  return foldedName(name).replaceAll('_', '')
}
