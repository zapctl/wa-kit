const waJids = require("WAJids");
const wapJid = require("WAWapJid");

const specs = {
    constants: {
        AUTHOR_ME_JID: waJids.AUTHOR_ME,
        AUTHOR_SYSTEM_JID: waJids.AUTHOR_SYSTEM,
        PSA_JID: waJids.PSA_JID,
        SURVEY_USER_JID: waJids.SURVEY_USER_JID,
        STATUS_JID: waJids.STATUS_JID,
        CALL_JID_SUFFIX: waJids.CALL_LINK_JID,
        BOT_JID_SUFFIX: waJids.BOT_DOMAIN.replace(/^@/, ""),
        HOSTED_LID_SUFFIX: waJids.HOSTED_LID_SUFFIX,
        HOSTED_SUFFIX: waJids.HOSTED_SUFFIX,
        INTEROP_USER_JID_SUFFIX: waJids.INTEROP_USER_JID_SUFFIX,
        MSGR_USER_JID_SUFFIX: waJids.MSGR_USER_JID_SUFFIX,
        LID_SUFFIX: waJids.LID_SUFFIX,
        USER_JID_SUFFIX: waJids.WA_USER_JID_SUFFIX,
        GROUP_JID_SUFFIX: waJids.getGroupDomain().replace(/^@/, ""),
        CONTACT_JID_SUFFIX: "c.us",
        NEWSLETTER_JID_SUFFIX: waJids.WA_NEWSLETTER_JID_DOMAIN.replace(/^@/, ""),
        BROADCAST_JID_SUFFIX: waJids.toBroadcastJid("").replace(/^@/, ""),
    },
    enums: {
        JID_DOMAIN: makeEnumerable(wapJid.DomainType),
    },
}

console.log("JidSpecs", specs);

return specs;