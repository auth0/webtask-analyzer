const Path = require('path');

const nativeModuleNames = Object.keys(process.binding('natives'));
const verquireModules = require(Path.join(process.env.VERQUIRE_DIR, 'packages.json'));

module.exports = cb => {
    cb(null, {
        nativeModuleNames,
        verquireModules,
    });
};
