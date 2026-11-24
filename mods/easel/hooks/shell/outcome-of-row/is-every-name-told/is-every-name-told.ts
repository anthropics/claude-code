/**
 * A chart that is drawn again may be worded by a newer version, so only the
 * title, the names of the rows and the labels of the marks are compared.
 *
 * @param modelText the words of the chart as it is drawn now
 * @param told the stored answer of its call
 * @returns whether the answer holds each of them
 */
export function isEveryNameTold(modelText: string, told: string): boolean {
  const [firstLine = '', ...lines] = modelText.split('\n')
  const names = lines.flatMap(line =>
    line.startsWith('- ')
      ? [line.slice(0, line.lastIndexOf(': ') + 1)]
      : line.startsWith('mark at ') && line.includes(': ')
        ? [`${line.slice(line.indexOf(': '))}\n`]
        : [],
  )

  return [/"[^"]*"/.exec(firstLine)?.[0] ?? '', ...names].every(name =>
    `${told}\n`.includes(name),
  )
}
