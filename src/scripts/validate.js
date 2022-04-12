/*
 * Copyright 2021 Comcast Cable Communications Management, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const fs = require('fs')
const path = require('path')
const Ajv = require('ajv')
const addFormats = require('ajv-formats').default

/**
 * Find all files inside a dir, recursively.
 * @function getAllFiles
 * @param  {string} dir Dir path string.
 * @return {string[]} Array with all file names that are inside the directory.
 */
const getAllFiles = dir => {
  return fs.readdirSync(dir).reduce((files, file) => {
    const name = path.join(dir, file)
    const isDirectory = fs.statSync(name).isDirectory()
    return isDirectory ? [...files, ...getAllFiles(name)] : [...files, name]
  }, [])
}

const validateExample = (schemaId, example) => {
  const validate = ajv.getSchema(schemaId)
  const valid = validate(example)
  if (!valid) {
    return {
      schemaId: schemaId,
      errors: validate.errors
    }
  }
  return null
}

const validateSchema = (schema) => {
  const errors = []
  const definitions = schema.definitions || {}
  const defKeys = Object.keys(definitions)
  for (let d = 0; d < defKeys.length; d++) {
    const def = definitions[defKeys[d]]
    const examples = def.examples || []
    const schemaId = schema.$id + '#/definitions/' + defKeys[d]
    for (let e = 0; e < examples.length; e++) {
      const err = validateExample(schemaId, examples[e])
      if (err) errors.push(err)
    }
  }
  return errors
}

const schemaFiles = getAllFiles('src/schemas')
const schemas = schemaFiles.map(s => JSON.parse(fs.readFileSync(s, 'utf8')))
/** Compile the schema to check if valid */
const ajv = new Ajv({ schemas })
addFormats(ajv)
let errors = []
for (let i = 0; i < schemas.length; i++) {
  const errs = validateSchema(schemas[i])
  errors = errors.concat(errs)
}
if (errors.length > 0) {
  throw new Error(JSON.stringify(errors, null, 2))
}
