/**
 * The tool's own word that it left rows out. The run of attributes is bounded,
 * so that a tag left open costs one pass.
 */
export const XML_CUT = /<results\b[^>]{0,200}\btruncated="true"/
