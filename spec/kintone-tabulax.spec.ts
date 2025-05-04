import { describe, it, beforeEach } from 'vitest'
import assert from 'power-assert'
import { KintoneTabulax } from '../src/kintone-tabulax.ts'
import type { AppRecord } from '../src/kintone-tabulax.ts'
import { parseCsv } from './support/parseCsv.ts'
import { readSampleCsv } from './support/utils.js'

describe('KintoneTabulax', () => {
  describe('#whichTableIncludes', () => {
    const tableDefinitions = {
      TableA: ['col1', 'col2'],
      TableB: ['col1', 'col3', 'col4_special']
    }
    const multiChoiceColumns = {
      TableA: ['mc']
    }

    let tabulax: KintoneTabulax
    beforeEach(() => {
      tabulax = new KintoneTabulax({ tableDefinitions, multiChoiceColumns })
    })

    describe('no definitions', () => {
      it('always false', () => {
        const noTableKintoneTabulax = new KintoneTabulax()
        assert.strictEqual(noTableKintoneTabulax.whichTableIncludes('col1'), undefined)
      })
    })

    describe('empty column name', () => {
      it('always undefined', () => {
        assert.strictEqual(tabulax.whichTableIncludes(''), undefined)
      })
    })

    describe('includes', () => {
      it('a table', () => {
        assert.strictEqual(tabulax.whichTableIncludes('col1'), 'TableA')
      })
      it('another table', () => {
        assert.strictEqual(tabulax.whichTableIncludes('col3'), 'TableB')
      })
      it('same name, and return table defined earlier', () => {
        assert.strictEqual(tabulax.whichTableIncludes('col1'), 'TableA')
      })
    })

    describe('doesn\'t include', () => {
      it('no match', () => {
        assert.strictEqual(tabulax.whichTableIncludes('col5'), undefined)
      })
      it('partial match', () => {
        assert.strictEqual(tabulax.whichTableIncludes('col4'), undefined)
      })
    })
  })

  describe('#prepareMainTableDefinition', () => {
    let tabulax: KintoneTabulax, records: AppRecord[]

    describe('no subtables and no multi choice columns', () => {
      beforeEach(() => {
        tabulax = new KintoneTabulax()
        records = [
          {
            'simple text': 'abc',
            a1: '123',
            b1: '456'
          }
        ]
      })
      it('through as array', () => {
        assert.deepEqual(
          tabulax.prepareMainTableDefinition(Object.keys(records[0])),
          ['simple text', 'a1', 'b1']
        )
      })
    })

    describe('subtables, no multi choice columns', () => {
      beforeEach(() => {
        tabulax = new KintoneTabulax({ tableDefinitions: { TableA: ['a1', 'b1'] } })
        records = [
          {
            'simple text': 'abc',
            a1: '123',
            b1: '456'
          }
        ]
      })
      it('shrink to only main table', () => {
        assert.deepEqual(
          tabulax.prepareMainTableDefinition(Object.keys(records[0])),
          ['simple text']
        )
      })
    })

    describe('no subtables, but multi choice columns', () => {
      beforeEach(() => {
        tabulax = new KintoneTabulax({ multiChoiceColumns: { main: ['mmc'] } })
        records = [
          {
            'simple text': 'abc',
            'mmc[opt1]': '',
            'mmc[opt2]': '1'
          }
        ]
      })
      it('shrink to only main table', () => {
        assert.deepEqual(
          tabulax.prepareMainTableDefinition(Object.keys(records[0])),
          ['simple text', 'mmc']
        )
      })
    })

    describe('multi tables, multi choice columns', () => {
      beforeEach(() => {
        tabulax = new KintoneTabulax({
          tableDefinitions: { TableA: ['a1', 'b1', 'amc'] },
          multiChoiceColumns: { main: ['mmc'], TableA: ['amc'] }
        })
        records = [
          {
            'simple text': 'abc',
            'mmc[opt1]': '',
            'mmc[opt2]': '1',
            a1: '123',
            b1: '456',
            'amc[opt1]': '1',
            'amc[opt2]': ''
          }
        ]
      })
      it('shrink to only main table', () => {
        assert.deepEqual(
          tabulax.prepareMainTableDefinition(Object.keys(records[0])),
          ['simple text', 'mmc']
        )
      })
    })
  })

  describe('#extractRecordForTable', () => {
    let tabulax: KintoneTabulax, record: AppRecord

    describe('single table and no multichoice columns', () => {
      beforeEach(() => {
        record = { 'Record number': 1, 'simple text': 'abc', 'simple number': 10 }
        tabulax = new KintoneTabulax()
        tabulax.prepareMainTableDefinition(Object.keys(record))
      })

      it('through as array', () => {
        assert.deepEqual(
          tabulax.extractRecordForTable('main', record),
          [record]
        )
      })
    })

    describe('single table and single multichoice column', () => {
      beforeEach(() => {
        tabulax = new KintoneTabulax({ multiChoiceColumns: { main: ['mc1'] } })
        record = {
          'Record number': 1,
          'simple text': 'abc',
          'mc1[opt1]': '',
          'mc1[opt2]': 1,
          'mc1[opt3]': 1
        }
        tabulax.prepareMainTableDefinition(Object.keys(record))
      })

      it('split into mutiple records', () => {
        assert.deepEqual(
          tabulax.extractRecordForTable('main', record),
          [
            {
              'Record number': 1,
              'simple text': 'abc',
              mc1: 'opt2'
            },
            {
              'Record number': 1,
              'simple text': 'abc',
              mc1: 'opt3'
            }
          ]
        )
      })
    })

    describe('multi tables, no multi-choice columns and customized primary key', () => {
      beforeEach(() => {
        tabulax = new KintoneTabulax({
          primaryKey: 'レコード番号',
          tableDefinitions: { Table1: ['unit', 'num'] }
        })
        record = {
          レコード番号: 1,
          'simple text': 'abc',
          unit: 1000,
          num: 10
        }
      })
      it('main', () => {
      })
      it('Table1', () => {
        assert.deepEqual(
          tabulax.extractRecordForTable('Table1', record),
          [
            { レコード番号: 1, unit: 1000, num: 10 }
          ]
        )
      })
    })

    describe('multi tables, single mutil-choice columns', () => {
      beforeEach(() => {
        tabulax = new KintoneTabulax({
          tableDefinitions: { Table1: ['unit', 'num'] },
          multiChoiceColumns: { main: ['mc1'] }
        })
        record = {
          'Record number': 1,
          'simple text': 'abc',
          unit: 1000,
          num: 10,
          'mc1[opt1]': '',
          'mc1[opt2]': 1,
          'mc1[opt3]': 1
        }
        tabulax.prepareMainTableDefinition(Object.keys(record))
      })
      it('main', () => {
        assert.deepEqual(
          tabulax.extractRecordForTable('main', record),
          [
            {
              'Record number': 1,
              'simple text': 'abc',
              mc1: 'opt2'
            },
            {
              'Record number': 1,
              'simple text': 'abc',
              mc1: 'opt3'
            }
          ]
        )
      })
      it('Table1', () => {
        assert.deepEqual(
          tabulax.extractRecordForTable('Table1', record),
          [
            { 'Record number': 1, unit: 1000, num: 10 }
          ]
        )
      })
    })
    describe('multi tables, multi multi-choice columns', () => {
      beforeEach(() => {
        tabulax = new KintoneTabulax({
          tableDefinitions: { Table1: ['unit', 'num'] },
          multiChoiceColumns: { main: ['mc1'], Table1: ['opt'] }
        })
        record = {
          'Record number': 1,
          'simple text': 'abc',
          unit: 1000,
          num: 10,
          'opt[name1]': '',
          'opt[name2]': '1',
          'mc1[opt1]': '',
          'mc1[opt2]': 1,
          'mc1[opt3]': 1
        }
        tabulax.prepareMainTableDefinition(Object.keys(record))
      })
      it('Table1', () => {
        assert.deepEqual(
          tabulax.extractRecordForTable('Table1', record),
          [
            { 'Record number': 1, unit: 1000, num: 10, opt: 'name2' }
          ]
        )
      })
    })
  })

  describe('#convertMultichoiceCheckedToValue', () => {
    let tabulax: KintoneTabulax
    beforeEach(() => {
      tabulax = new KintoneTabulax()
    })

    it('checked', () => {
      assert.deepEqual(
        tabulax.convertMultichoiceCheckedToValue('mc1', 'mc1[opt1]', '1'),
        'opt1'
      )
    })

    it('not checked', () => {
      assert.equal(
        tabulax.convertMultichoiceCheckedToValue('mc1', 'mc1[opt2]', ''),
        false
      )
    })

    it('complex name', () => {
      assert.equal(
        tabulax.convertMultichoiceCheckedToValue('mc[]a', 'mc[]a[opt1]', '1'),
        'opt1'
      )
    })
  })

  describe('#isEmptyRecord', () => {
    it('not empty', () => {
      const tabulax = new KintoneTabulax()
      assert(!tabulax.isEmptyRecord({ 'Record number': [1], key1: ['abc'], key2: [''] }))
    })

    it('all empty', () => {
      const tabulax = new KintoneTabulax()

      assert(tabulax.isEmptyRecord({ 'Record number': [1], key1: [], key2: [''] }))
    })
  })

  describe('#normanpivot', () => {
    it('real csv', async () => {
      const records = await parseCsv(readSampleCsv())

      const tableDefinitions = {
        Table1: ['テキスト項目'],
        Table2: ['Text', 'Drop-down']
      }
      const multiChoiceColumns = {
        main: ['単純複数選択'],
        Table1: ['複[]数選択', 'Table1_Check box'],
        Table2: ['Multi-choice']
      }

      const tabulax = new KintoneTabulax({ tableDefinitions, multiChoiceColumns })
      const result = tabulax.normanpivot(records)

      const expected = {
        main: [
          {
            'Record number': '1',
            サンプルテキスト: '',
            単純複数選択: 'indopt2'
          },
          {
            'Record number': '1',
            サンプルテキスト: '',
            単純複数選択: 'indopt4'
          }
        ],
        Table1: [
          {
            'Record number': '1',
            テキスト項目: 'あああ',
            '複[]数選択': 't1opt2',
            'Table1_Check box': ''
          },
          {
            'Record number': '1',
            テキスト項目: 'あああ',
            '複[]数選択': 't1opt3',
            'Table1_Check box': ''
          },
          {
            'Record number': '1',
            テキスト項目: 'いいい',
            '複[]数選択': 't1opt1',
            'Table1_Check box': 't1chk2'
          }
        ],
        Table2: [
          {
            'Record number': '1',
            Text: 'テキスト',
            'Drop-down': 'dopt2',
            'Multi-choice': 't2opt2'
          },
          {
            'Record number': '1',
            Text: 'テキスト',
            'Drop-down': 'dopt2',
            'Multi-choice': 't2opt4'
          }
        ]
      }
      assert.deepEqual(result, expected)
    })
  })
})
