import fs from 'node:fs'

/**
 * Reads the sample.csv file and returns its contents as a string
 *
 * @returns {string} Contents of sample.csv file
 */
export function readSampleCsv () {
  return fs.readFileSync(import.meta.dirname + '/sample.csv', 'utf8')
}
