/**
 * What follows the start of a field: `n">7</field>`, `n" />`, or
 * `n" null="true" />`, with any other attributes.
 */
export const XML_FIELD_REST =
  /^(?<name>[^"]*)"(?<attributes>[^>]*?)(?:\/>|>(?<text>.*?)<\/field>)/s
