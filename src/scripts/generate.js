const fs = require('fs')
const path = require('path')

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

const base = JSON.parse(fs.readFileSync('src/json/firebolt-specification-base.json'))
const core = JSON.parse(fs.readFileSync('node_modules/@firebolt-js/sdk/dist/firebolt-open-rpc.json'))

console.log('Hello!')

const getTag = (method, tag) => method.tags ? method.tags.find(t => t.name == tag) || {} : {}
const getCapabilities = (method, role) => getTag(method, 'capabilities') ? getTag(method, 'capabilities')['x-' + role] || [] : []
const hasAnyCapabilities = method => hasCapabilities(method, 'uses') || hasCapabilities(method, 'provides') || hasCapabilities(method, 'manages')
const hasCapabilities = (method, role) => getCapabilities(method, role).length > 0
const hasNoCapabilities = method => !hasAnyCapabilities(method)
const isValidCapability = capability => base.capabilities.find(c => c.id === capability)
const getInvalidCapabilities = method => getCapabilities(method, 'uses').filter(c => !isValidCapability(c)).concat(getCapabilities(method, 'provides').filter(c => !isValidCapability(c))).concat(getCapabilities(method, 'manages').filter(c => !isValidCapability(c)))
const hasInvalidCapabilities = method => (getInvalidCapabilities(method).length > 0)
const isPrivateCapability = (capability, role) => !(base.capabilities.find(c => c.id === capability) || {use: { public: true}, manage: { public: true }, provide: { public: true }})[role].public
const getPrivateCapabilities = (method) => getCapabilities(method, 'uses').filter(c => isPrivateCapability(c, 'use')).concat(getCapabilities(method, 'provides').filter(c => isPrivateCapability(c, 'provide'))).concat(getCapabilities(method, 'manages').filter(c => isPrivateCapability(c, 'manage')))
const hasPrivateCapabilities = (method) => (getPrivateCapabilities(method).length > 0)

let problems
let errorCount = 0
let warningCount = 0

problems = core.methods.filter(hasNoCapabilities)
warningCount += problems.length
if (problems.length)
  console.warn('\nThe following methods have no capabilities tag: \n\t- ' + problems.map(m => m.name).join('\n\t- '))

problems = core.methods.filter(hasInvalidCapabilities)
errorCount += problems.length
if (problems.length)
  console.error('\nThe following methods have invalid capabilities: \n\t- ' + problems.map(m => m.name + `: ${getInvalidCapabilities(m).join(', ')}`).join('\n\t- '))

problems = core.methods.filter(hasPrivateCapabilities)
errorCount += problems.length
if (problems.length)
  console.error('\nThe following methods have private capabilities: \n\t- ' + problems.map(m => m.name + `: ${getPrivateCapabilities(m).join(', ')}`).join('\n\t- '))

if (errorCount > 0) {
  console.warn(`\nFound ${errorCount} problems`)
}
else {
  const specification = JSON.parse(JSON.stringify(base))
  specification.apis = core.methods.filter(hasAnyCapabilities).map( method => {
    const methodInfo = {
      "method": method.name,
      "type": "firebolt"
    }

    if (hasCapabilities(method, 'uses')) {
      methodInfo.uses = getCapabilities(method, 'uses')
    }

    if (hasCapabilities(method, 'provides')) {
      methodInfo.provides = getCapabilities(method, 'provides')
    }

    if (hasCapabilities(method, 'manages')) {
      methodInfo.manages = getCapabilities(method, 'manages')
    }

    return methodInfo
  })

  specification.capabilities.sort( (a, b) => a.id.localeCompare(b.id) )
  specification.apis.sort( (a, b) => a.method.localeCompare(b.method) )

  fs.writeFileSync('build/firebolt-specification.json', JSON.stringify(specification, null, '\t'))
}

console.log('\n')