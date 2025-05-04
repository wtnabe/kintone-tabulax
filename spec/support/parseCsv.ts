import { parse } from 'csv-parse'
import type { AppRecord } from '../../src/autopivot.ts'

/**
 * @param {string} csvString
 * @returns {Promise<AppRecord[]>}
 */
export async function parseCsv (csvString: string): Promise<AppRecord[]> {
  const records = await new Promise((resolve, reject) => {
    parse(csvString, {
      columns: true,
      skip_empty_lines: true
    }, (err, records) => {
      if (err !== undefined) {
        reject(err)
      } else {
        resolve(records)
      }
    })
  })

  return records as AppRecord[]
}
