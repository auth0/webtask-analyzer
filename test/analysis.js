//@ts-check

'use strict';

const Fs = require('fs');
const Os = require('os');
const Path = require('path');
const Util = require('util');

const Code = require('code');
const Lab = require('lab');

const { Analyzer } = require('../');

const readFile = Util.promisify(Fs.readFile);
const expect = Code.expect;
const lab = (exports.lab = Lab.script());

lab.describe('analysis.js', () => {
    const webtaskProfileName = process.env.WEBTASK_PROFILE || 'default';

    /** @type {Analyzer} */
    let analyzer;

    lab.before({ timeout: 20000 }, async () => {
        const json = await readFile(
            Path.join(Os.homedir(), '.webtask'),
            'utf8'
        );
        const profiles = JSON.parse(json);

        if (!profiles[webtaskProfileName]) {
            throw new Error(
                `Missing a webtask profile '${webtaskProfileName}' in ~/.webtask`
            );
        }

        analyzer = new Analyzer({
            clusterUrl: profiles[webtaskProfileName].url,
            containerName: profiles[webtaskProfileName].container,
            token: profiles[webtaskProfileName].token,
        });

        await analyzer.loadModuleList();
    });

    lab.test('will pull modules available on the platform', async () => {
        const result = await analyzer.loadModuleList();

        expect(result).to.be.an.object();
        expect(result.nativeModuleNames).to.be.an.array();
    });

    lab.test(
        'will resolve the globals and requires for a simple webtask',
        async () => {
            const dependsOnRequestCode = await readFile(
                Path.join(__dirname, './fixtures/depends_on_request.js'),
                'utf8'
            );
            const result = await analyzer.findDependenciesInCode(
                dependsOnRequestCode
            );

            expect(result).to.be.an.array();
            expect(result).to.contain([
                {
                    type: 'require',
                    spec: 'request',
                    start: 38,
                    end: 56,
                    resolved: { name: 'request', version: '2.56.0' },
                },
                {
                    type: 'global',
                    spec: 'module',
                    start: 59,
                    end: 65,
                    resolved: { builtIn: true },
                },
                {
                    type: 'global',
                    spec: 'require',
                    start: 38,
                    end: 45,
                    resolved: { builtIn: true },
                },
            ]);
        }
    );

    lab.test('will detect a dynamic require', async () => {
        const dependsOnRequestCode = await readFile(
            Path.join(__dirname, './fixtures/depends_on_variable_request.js'),
            'utf8'
        );
        const result = await analyzer.findDependenciesInCode(
            dependsOnRequestCode
        );

        expect(result).to.be.an.array();
        expect(result).to.contain([
            {
                type: 'require_dynamic',
                spec: 'requestName',
                start: 69,
                end: 89,
                resolved: undefined,
            },
        ]);
    });
});
