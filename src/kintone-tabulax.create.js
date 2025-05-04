import { KintoneTabulax } from './kintone-tabulax.js'

/**
 * @param {import('./kintone-tabulax.js').KintoneTabulaxConfiguration} params
 * @param {TableDefinitions?} params.tableDefinitions
 * @param {MultiChoiceColumns?} params.multiChoiceColumns
 * @param {string?} params.primaryKey
 * @returns {KintoneTabulax}
 */
export function createKintoneTabulax ({ tableDefinitions = {}, multiChoiceColumns = {}, primaryKey = 'Record number' } = {}) { // eslint-disable-line no-unused-vars
  return new KintoneTabulax({ tableDefinitions, multiChoiceColumns, primaryKey })
}
/* -- end of createKintoneTabulax -- */

/* stub of global `function` for Google Apps Script */
