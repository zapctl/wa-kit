const logoutReason = require("WAWebLogoutReasonConstants");

const specs = {
    enums: {
        LogoutReason: makeEnumerable(logoutReason.LogoutReason),
    },
}

console.log("MainSpecs", specs);

return specs;