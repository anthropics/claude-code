/**
 * An Edit tool's result record holding one hunk of one file.
 *
 * @param lines the hunk's lines, `-`/`+`/space prefixed
 * @returns the record as the transcript stores it
 */
export const editPatchOf = (lines: string[]) => ({
  filePath: '/r/a.ts',
  structuredPatch: [
    { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines },
  ],
})
