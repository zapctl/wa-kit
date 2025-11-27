const backendJobs = require("WAWebBackendJobs.flow");
const enumEditType = require("WAWebWamEnumEditType");
const msgCommon = require("WAWebHandleMsgCommon");

const specs = {
    enums: {
        STANZA_MSG_TYPES: makeEnumerable(msgCommon.STANZA_MSG_TYPES),
        EDIT_MSG_TYPE: enumEditType.EDIT_TYPE,
        ENC_MEDIA_TYPE: makeEnumerable(backendJobs.EncMediaType),
    },
}

console.log("MessageSpecs", specs);

return specs;