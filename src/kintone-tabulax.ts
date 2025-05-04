/*
 * alias
 */
type TableName = string
type ColumnName = string

export type TableDefinitions = Record<TableName, ColumnName[]>
export type MultiChoiceColumns = Record<TableName, ColumnName[]>

/** one record ( just key-value ) */
export type AppRecord = Record<ColumnName, string | number>
/** AppRecord's alias ( possible empty during process ) */
type PartialRecord = AppRecord

/** in the middle of the folding process */
type WorkRecord = Record<string, Array<string | number>>
/** JSON string of the last record processed */
type LastRecord = Record<TableName, string | undefined>
/** converted table groups */
export type Tables = Record<TableName, AppRecord[]>

export interface KintoneTabulaxConfiguration {
  tableDefinitions?: TableDefinitions
  multiChoiceColumns?: MultiChoiceColumns
  primaryKey?: string
}

/* -- begin of KintoneTabulax -- */
/** @typedef {string} TableName */
/** @typedef {string} ColumnName */

/** @typedef {Record<TableName, ColumnName[]>} TableDefinitions */
/** @typedef {Record<TableName, ColumnName[]>} MultiChoiceColumns */
/** @typedef {Record<ColumnName, string|number>} AppRecord */

/**
 * @typedef {Object} KintoneTabulaxConfiguration
 * @property {TableDefinitions?} tableDefinitions
 * @property {MultiChoiceColumns?} multiChoiceColumns
 * @property {string?} primaryKey
 */
/** reserved main table name */
export const mainTableName = 'main'

/**
 * kintone's csv records manipulator
 */
export class KintoneTabulax {
  readonly tableDefinitions: TableDefinitions
  readonly multiChoiceColumns: MultiChoiceColumns
  readonly primaryKey: string

  /**
   * @param {object} [params]
   * @param {TableDefinitions?} [params.tableDefinitions]
   * @param {MultiChoiceColumns?} [params.multiChoiceColumns]
   * @param {string?} [params.primaryKey='Record number']
   */
  constructor ({ tableDefinitions = {}, multiChoiceColumns = {}, primaryKey = 'Record number' }: KintoneTabulaxConfiguration = {}) {
    this.tableDefinitions = tableDefinitions
    this.multiChoiceColumns = multiChoiceColumns
    this.primaryKey = primaryKey
  }

  /**
   * table name array defined in tableDefinitions
   *
   * named `subtables`, but the main table is also included depending on the timing XD
   *
   * @returns {TableName[]}
   */
  subTables (): TableName[] {
    return Object.entries(this.tableDefinitions).map(([table, _cols]) => table)
  }

  /**
   * Derive main table definition from subtable and multi choice columns definitions and actual data
   *
   * As a side effect, tableDefinitions are changed
   *
   * @modifies {this.tableDefinitions}
   * @param {ColumnName[]} allColumns
   * @returns {ColumnName[]}
   */
  prepareMainTableDefinition (allColumns: ColumnName[]): ColumnName[] {
    const result: ColumnName[] = []

    for (const column of allColumns) {
      // simple column
      if (this.whichTableIncludes(column) !== undefined) {
        continue
      }

      // multi choice
      const anotherMultiChoice = Object.entries(this.multiChoiceColumns).map(([table, columns]) => {
        if (table === mainTableName) return false

        return this.isMultichoiceColumn(column, columns) !== false ? table : false
      }).filter((e) => e)[0] as TableName | undefined

      if (anotherMultiChoice !== undefined) {
        continue
      }

      const definedName = this.isMultichoiceColumn(column, this.multiChoiceColumns[mainTableName])
      if (definedName !== false) {
        if (!result.includes(definedName)) {
          result.push(definedName)
        } else {
          continue
        }
      } else {
        result.push(column)
      }
    }

    this.tableDefinitions[mainTableName] = result

    return result
  }

  /**
   * @param {ColumnName} column
   * @returns {TableName|undefined}
   */
  whichTableIncludes (column: ColumnName): TableName | undefined {
    return Object.entries(this.tableDefinitions).map(([table, columns]) => {
      return columns.includes(column) ? table : false
    }).filter((e) => e)[0] as TableName | undefined
  }

  /**
   * Determine if a column is a multiple choice column from the column name
   *
   *  Compare with predefined column names instead of simple string matching because column names can contain []
   *
   * @param {ColumnName} name
   * @param {ColumnName[]} definitions multi-choice columns per table
   * @returns {string | false}
   */
  isMultichoiceColumn (name: ColumnName, definitions: ColumnName[] = []): string | false {
    const result = definitions.filter((col) => name.startsWith(col + '['))

    return result.length > 0 ? result[0] : false
  }

  /**
   * Convert multiple-choice columns to records for a specific table based on record contents and definitions
   *
   * input
   * { 'name': 'text', 'mc[opt1]': '1', 'mc[opt2]': '', 'mc[opt3]': '1' }
   * filter and stacked ( partial record )
   * { 'name': 'text', 'mc': ['opt1', 'opts3'] }
   * output
   * [
   *   { 'name': 'text', 'mc': 'opt1' },
   *   { 'name': 'text', 'mc': 'opt3' }
   * ]
   *
   * @param {TableName} table
   * @param {AppRecord} record
   * @returns {Partialrecord[]}
   */
  extractRecordForTable (table: TableName, record: AppRecord): PartialRecord[] {
    const multiChoiceColumns = this.multiChoiceColumns[table]

    const workRecord: WorkRecord = {}

    for (const key in record) {
      // simple value
      const actuallyTable = this.whichTableIncludes(key)
      if (actuallyTable === table) {
        if (!(this.primaryKey in workRecord)) {
          workRecord[this.primaryKey] = [record[this.primaryKey]]
        }
        workRecord[key] = [record[key]]
        continue
      }

      // multi-choice value
      const definedMultichoiceColname = this.isMultichoiceColumn(key, multiChoiceColumns)
      if (definedMultichoiceColname !== false) {
        if (!(this.primaryKey in workRecord)) {
          workRecord[this.primaryKey] = [record[this.primaryKey]]
        }
        const option = this.convertMultichoiceCheckedToValue(definedMultichoiceColname, key, record[key])
        if (!(definedMultichoiceColname in workRecord)) {
          workRecord[definedMultichoiceColname] = []
        }
        if (option !== false) {
          workRecord[definedMultichoiceColname].push(option)
        }
      }
    }

    if (this.isEmptyRecord(workRecord)) {
      // partial record can be empty
      return []
    } else {
      // fill empty column
      for (const col in workRecord) {
        if (workRecord[col].length === 0) {
          workRecord[col].push('')
        }
      }
    }

    return this.calculateProductOfMultichoiceValues(workRecord)
  }

  /**
   * generate product of multi-choice values
   *
   * @param {WorkRecord} workRecord
   * @returns {Partialrecord[]}
   */
  calculateProductOfMultichoiceValues (workRecord: WorkRecord): PartialRecord[] {
    return Object.keys(workRecord).reduce<PartialRecord[]>((acc, key) => {
      const values = workRecord[key]
      if (acc.length === 0) {
        return values.map((value: string | number) => ({ [key]: value }))
      } else {
        return acc.flatMap((item) => values.map((value) => ({ ...item, [key]: value })))
      }
    }, [])
  }

  /**
   * convert 'col[value], 1' to 'value'
   *
   * @param {ColumnName} definedName
   * @param {ColumnName} key
   * @param {string|number} value
   * @returns {string|false}
   */
  convertMultichoiceCheckedToValue (definedName: ColumnName, key: ColumnName, value: string | number): string | false {
    return (parseInt(value.toString()) === 1)
      ? key.substring(definedName.length + 1, key.length - 1)
      : false
  }

  /**
   * whether there is no content other than the record number
   *
   * @param {WorkRecord} workRecord
   * @returns {boolean}
   */
  isEmptyRecord (workRecord: WorkRecord): boolean {
    return Object.entries(workRecord).filter(([k, v]) => {
      return (k === this.primaryKey)
        ? false
        : (v.length === 0 || (v.length === 1 && v[0] === '')) ? false : [k, v]
    }).length === 0
  }

  /**
   * Convert table that it split tables, and multi-choice columns into records for SQL-friendly. Based on predefined table and multi-choice columns definitions.
   *
   * @param {AppRecord[]} records
   * @returns {Tables}
   */
  normanpivot (records: AppRecord[]): Tables {
    if (typeof this.tableDefinitions[mainTableName] === 'undefined') {
      this.prepareMainTableDefinition(Object.keys(records[0]))
    }
    const tables: Tables = { main: [] }
    const lastRecord: LastRecord = { main: undefined }
    this.subTables().forEach((table) => {
      if (!(table in tables)) { tables[table] = [] }
      lastRecord[table] = undefined
    })

    const tableNames = Object.keys(tables)
    for (const record of records) {
      for (const table of tableNames) {
        const extracted = this.extractRecordForTable(table, record)
        if (extracted.length > 0) {
          if (lastRecord[table] === JSON.stringify(extracted)) {
            continue
          } else {
            lastRecord[table] = JSON.stringify(extracted)
            tables[table] = tables[table].concat(extracted)
          }
        }
      }
    }

    return tables
  }
}
