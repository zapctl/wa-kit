const version = window.Debug.VERSION;
const buildHash = require("WAMd5")(version);

const specs = {
    constants: {
        VERSION: version,
        BUILD_HASH: buildHash,
    }
}

console.log("VersionSpecs", specs);

return specs;