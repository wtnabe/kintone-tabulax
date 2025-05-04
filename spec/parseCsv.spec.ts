import { describe, it } from 'vitest'
import assert from 'power-assert'
import { parseCsv } from './support/parseCsv.ts'
import { readSampleCsv } from './support/utils.js'

describe('parseCsv', () => {
  it('should parse CSV string', async () => {
    const csvString = 'header1,header2\nvalue1,value2'
    const expected = [{ header1: 'value1', header2: 'value2' }]
    const result = await parseCsv(csvString)

    assert.deepStrictEqual(result, expected)
  })

  it('should parse sample.csv', async () => {
    const csvString = readSampleCsv()
    const result = await parseCsv(csvString)

    assert.ok(result.length > 0)
  })
})
