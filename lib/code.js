'use strict';

const Acorn = require('acorn');
const AcornGlobals = require('acorn-globals');
const AcornWalk = require('acorn/dist/walk');
const Astring = require('astring');

const REQUIRE_WALKER = AcornWalk.make({
    CallExpression: (node, state, recurse) => {
        AcornWalk.base[node.type](node, state, recurse);

        if (
            node.callee.type === 'Identifier' &&
            node.callee.name === 'require'
        ) {
            if (
                node.arguments.length !== 1 ||
                node.arguments[0].type !== 'Literal'
            ) {
                state.requires.push(createDynamicDependency(node));
            } else {
                state.requires.push(createStaticDependency(node));
            }
        }
    },
});

const TYPE_GLOBAL = 'global';
const TYPE_REQUIRE = 'require';
const TYPE_REQUIRE_DYNAMIC = 'require_dynamic';

/**
 * @typedef RequireNode
 * @property {string} spec
 * @property {string} type
 * @property {number} start
 * @property {number} end
 **/

/** @returns {RequireNode} */
function createDynamicDependency(node) {
    return {
        type: TYPE_REQUIRE_DYNAMIC,
        start: node.start,
        end: node.end,
        spec: node.arguments.map(exp => Astring.generate(exp)).join(''),
    };
}

/** @returns {RequireNode} */
function createGlobal(name, node) {
    return {
        type: TYPE_GLOBAL,
        start: node.start,
        end: node.end,
        spec: name,
    };
}

/** @returns {RequireNode} */
function createStaticDependency(node) {
    return {
        type: TYPE_REQUIRE,
        start: node.start,
        end: node.end,
        spec: node.arguments[0].value,
    };
}

/**
 * Find all undefined names in code
 *
 * @param {acorn.Node | string} astOrCode
 * @returns {RequireNode[]} An array of global names
 */
function findGlobalNames(astOrCode) {
    const ast = parse(astOrCode);
    const results = AcornGlobals(ast);

    return results.reduce(
        (globals, result) =>
            globals.concat(
                result.nodes.map(node => createGlobal(result.name, node))
            ),
        []
    );
}

/**
 * Find all specs of require calls in a body of code
 *
 * @param {acorn.Node | string} astOrCode
 * @returns {RequireNode[]} An array of the require specs
 */
function findRequires(astOrCode) {
    const ast = parse(astOrCode);
    const state = {
        requires: [],
    };

    AcornWalk.recursive(ast, state, REQUIRE_WALKER);

    return state.requires;
}

function parse(astOrCode) {
    return typeof astOrCode === 'string'
        ? Acorn.parse(astOrCode, {
              allowReturnOutsideFunction: true,
          })
        : astOrCode;
}

exports.findGlobalNames = findGlobalNames;
exports.findRequires = findRequires;
exports.parse = parse;
exports.types = {
    TYPE_GLOBAL,
    TYPE_REQUIRE,
    TYPE_REQUIRE_DYNAMIC,
};
