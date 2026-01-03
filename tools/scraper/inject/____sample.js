__d("WASmaxInBlocklistsBlocklistIds", ["WAResultOrError", "WASmaxInBlocklistsDisplayNameMixin", "WASmaxInBlocklistsPnJidMixin", "WASmaxInBlocklistsUnknownIdentifierMixin", "WASmaxInBlocklistsUsernameMixin", "WASmaxParseUtils"], (function(t, n, r, o, a, i, l) {
    function e(e) {
        var t = o("WASmaxInBlocklistsUsernameMixin").parseUsernameMixin(e);
        if (t.success)
            return o("WAResultOrError").makeResult({
                name: "Username",
                value: t.value
            });
        var n = o("WASmaxInBlocklistsPnJidMixin").parsePnJidMixin(e);
        if (n.success)
            return o("WAResultOrError").makeResult({
                name: "PnJid",
                value: n.value
            });
        var r = o("WASmaxInBlocklistsDisplayNameMixin").parseDisplayNameMixin(e);
        if (r.success)
            return o("WAResultOrError").makeResult({
                name: "DisplayName",
                value: r.value
            });
        var a = o("WASmaxInBlocklistsUnknownIdentifierMixin").parseUnknownIdentifierMixin(e);
        return a.success ? o("WAResultOrError").makeResult({
            name: "UnknownIdentifier",
            value: a.value
        }) : o("WASmaxParseUtils").errorMixinDisjunction(e, ["Username", "PnJid", "DisplayName", "UnknownIdentifier"], [t, n, r, a])
    }
    l.parseBlocklistIds = e
}
), 98);

__d("WASmaxInGroupsGetGroupProfilePicturesResponseSuccessGroupPictures", ["WAResultOrError", "WASmaxInGroupsGetGroupProfilePicturesProfilePicturesResponseMixin", "WASmaxInGroupsIQResultResponseMixin", "WASmaxParseUtils"], (function(t, n, r, o, a, i, l) {
    function e(e, t) {
        var n = o("WASmaxParseUtils").assertTag(e, "iq");
        if (!n.success)
            return n;
        var r = o("WASmaxInGroupsIQResultResponseMixin").parseIQResultResponseMixin(e, t);
        if (!r.success)
            return r;
        var a = o("WASmaxInGroupsGetGroupProfilePicturesProfilePicturesResponseMixin").parseGetGroupProfilePicturesProfilePicturesResponseMixin(e);
        return a.success ? o("WAResultOrError").makeResult(babelHelpers.extends({}, r.value, a.value)) : a
    }
    l.parseGetGroupProfilePicturesResponseSuccessGroupPictures = e
}
), 98);