//@ts-check

'use strict';

const Assert = require('assert');
const Fs = require('fs');
const Path = require('path');

const Wreck = require('wreck');

const Code = require('./code');

// See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects
const PLATFORM_GLOBAL_NAMES = new Set([
    // Value properties
    'Infinity',
    'NaN',
    'undefined',
    'null',
    // Function properties
    'eval',
    'isFinite',
    'isNaN',
    'parseFloat',
    'parseInt',
    'decodeURI',
    'decodeURIComponent',
    'encodeURI',
    'encodeURIComponent',
    'escape',
    'unescape',
    // Fundamental objects
    'Object',
    'Function',
    'Boolean',
    'Symbol',
    'Error',
    'EvalError',
    'InternalError',
    'RangeError',
    'ReferenceError',
    'SyntaxError',
    'TypeError',
    'URIError',
    // Numbers and dates
    'Number',
    'Math',
    'Date',
    // Indexed collections
    'Array',
    'Int8Array',
    'Uint8Array',
    'Uint8ClampedArray',
    'Int16Array',
    'Uint16Array',
    'Int32Array',
    'Uint32Array',
    'Float32Array',
    'Float64Array',
    // Keyed collections
    'Map',
    'Set',
    'WeakMap',
    'WeakSet',
    // Structured data
    'ArrayBuffer',
    'SharedArrayBuffer ',
    'Atomics ',
    'DataView',
    'JSON',
    // Control abstraction objects
    'Promise',
    'Generator',
    'GeneratorFunction',
    'AsyncFunction',
    // Other
    'arguments',
    // Node.js globals: https://nodejs.org/api/globals.html
    'Buffer',
    '__dirname',
    '__filename',
    'clearImmediate',
    'clearInterval',
    'clearTimeout',
    'console',
    'exports',
    'global',
    'module',
    'process',
    'require',
    'setImmediate',
    'setInterval',
    'setTimeout',
    // Standard JavaScript errors: https://nodejs.org/api/errors.html#errors_errors
    'EvalError',
    'SyntaxError',
    'RangeError',
    'ReferenceError',
    'TypeError',
    'URIError',
]);

/**
 * @typedef CodeDependency
 * @property {string} spec
 * @property {string} type
 * @property {number} start
 * @property {number} end
 * @property {*} [resolved]
 */

/**
 *
 * @param {string} spec
 * @returns {{ name: string, version?: string }}
 */
function parseVerquireSpec(spec) {
    const atIndex = spec.indexOf('@', 1);

    if (atIndex === -1) {
        return { name: spec, version: undefined };
    }

    return {
        name: spec.slice(0, atIndex - 1),
        version: spec.slice(atIndex + 1, 0),
    };
}

class Analyzer {
    /**
     * Create a new webtask analyzer
     *
     * @param {object} options
     * @param {string} options.clusterUrl
     * @param {string} options.containerName
     * @param {string} options.token
     */
    constructor(options) {
        Assert.ok(
            options && typeof options === 'object',
            'options is required'
        );
        Assert.ok(
            typeof options.clusterUrl === 'string',
            'clusterUrl must be a string'
        );
        Assert.ok(
            typeof options.containerName === 'string',
            'containerName must be a string'
        );
        Assert.ok(typeof options.token === 'string', 'token must be a string');

        this.clusterUrl = options.clusterUrl;
        this.containerName = options.containerName;
        this.token = options.token;

        this.client = Wreck.defaults({
            baseUrl: this.clusterUrl,
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        });

        this.modulesLoad = null;
    }

    /**
     *
     * @param {string | acorn.Node} codeOrAst
     * @returns {Promise<CodeDependency[]>}
     */
    findDependenciesInCode(codeOrAst) {
        return this.loadModuleList().then(result => {
            const nativeModules = result.nativeModuleNames;
            const verquireModules = result.verquireModules;
            const ast = Code.parse(codeOrAst);
            const dependencies = [];
            const globals = Code.findGlobalNames(ast);
            const requires = Code.findRequires(ast);

            requires.forEach(require => {
                if (require.type === Code.types.TYPE_REQUIRE_DYNAMIC) {
                    dependencies.push({
                        type: require.type,
                        spec: require.spec,
                        start: require.start,
                        end: require.end,
                        resolved: undefined,
                    });
                } else if (require.type === Code.types.TYPE_REQUIRE) {
                    const required = parseVerquireSpec(require.spec);
                    const name = required.name;
                    let version = required.version;

                    if (version === undefined) {
                        if (nativeModules.indexOf(name) !== -1) {
                            version = '<core>';
                        } else if (
                            Array.isArray(verquireModules[name]) &&
                            verquireModules[name].length
                        ) {
                            version = verquireModules[name][0];
                        }
                    }

                    dependencies.push({
                        type: require.type,
                        spec: require.spec,
                        start: require.start,
                        end: require.end,
                        resolved: { name, version },
                    });
                }
            });

            globals.forEach(global =>
                dependencies.push({
                    type: Code.types.TYPE_GLOBAL,
                    spec: global.spec,
                    start: global.start,
                    end: global.end,
                    resolved: {
                        builtIn: PLATFORM_GLOBAL_NAMES.has(global.spec),
                    },
                })
            );

            return dependencies;
        });
    }

    /**
     * Load all supported modules
     *
     * @returns {Promise<{ nativeModuleNames: string[], verquireModules: { [name: string]: string[] }} >}
     */
    loadModuleList() {
        if (!this.modulesLoad) {
            this.modulesLoad = new Promise((resolve, reject) =>
                Fs.readFile(
                    Path.resolve(__dirname, './webtasks/list_modules.js'),
                    'utf8',
                    (error, code) => {
                        if (error) return reject(error);

                        return this.client.post(
                            `/api/run/${encodeURIComponent(
                                this.containerName
                            )}`,
                            {
                                json: true,
                                payload: code,
                            },
                            (error, res, result) => {
                                if (!error && res.statusCode !== 200)
                                    error = new Error(
                                        `Unexpected status code: ${
                                            res.statusCode
                                        }`
                                    );
                                if (error) return reject(error);

                                return resolve(result);
                            }
                        );
                    }
                )
            );
        }

        return this.modulesLoad;
    }
}

exports.Analyzer = Analyzer;
exports.types = Code.types;
