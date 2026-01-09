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

__d("WASmaxInGroupsGetGroupProfilePicturesProfilePicturesResponseMixin", ["WAResultOrError", "WASmaxInGroupsGetGroupProfilePicturesSuccessOrGetGroupProfilePicturesPartialProfilePictureResponseMixinGroup", "WASmaxInGroupsParentOrSubGroupMixinGroup", "WASmaxParseUtils"], (function(t, n, r, o, a, i, l) {
    function e(e) {
        var t = o("WASmaxParseUtils").assertTag(e, "picture");
        if (!t.success)
            return t;
        var n = o("WASmaxInGroupsParentOrSubGroupMixinGroup").parseParentOrSubGroupMixinGroup(e);
        if (!n.success)
            return n;
        var r = o("WASmaxInGroupsGetGroupProfilePicturesSuccessOrGetGroupProfilePicturesPartialProfilePictureResponseMixinGroup").parseGetGroupProfilePicturesSuccessOrGetGroupProfilePicturesPartialProfilePictureResponseMixinGroup(e);
        return r.success ? o("WAResultOrError").makeResult({
            parentOrSubGroupMixinGroup: n.value,
            getGroupProfilePicturesSuccessOrGetGroupProfilePicturesPartialProfilePictureResponseMixinGroup: r.value
        }) : r
    }
    function s(t) {
        var n = o("WASmaxParseUtils").flattenedChildWithTag(t, "pictures");
        if (!n.success)
            return n;
        var r = o("WASmaxParseUtils").mapChildrenWithTag(n.value, "picture", 1, 1e3, e);
        return r.success ? o("WAResultOrError").makeResult({
            picturesPicture: r.value
        }) : r
    }
    l.parseGetGroupProfilePicturesProfilePicturesResponsePicturesPicture = e,
    l.parseGetGroupProfilePicturesProfilePicturesResponseMixin = s
}
), 98);


request = {
    "tag": "iq",
    "attrs": {
        "to": {
            "$1": {
                "type": 0,
                "user": "120363333979933782",
                "server": "g.us"
            }
        },
        "xmlns": "w:g2",
        "id": "51617.3263-310",
        "type": "get"
    },
    "content": [
        {
            "tag": "pictures",
            "attrs": {},
            "content": [
                {
                    "tag": "picture",
                    "attrs": {
                        "type": "image",
                        "query": "url",
                        "parent_group_jid": {
                            "$1": {
                                "type": 0,
                                "user": "120363333979933782",
                                "server": "g.us"
                            }
                        }
                    },
                    "content": null
                }
            ]
        }
    ]
}

response = {
    "tag": "iq",
    "attrs": {
        "from": {
            "$1": {
                "type": 0,
                "user": "120363333979933782",
                "server": "g.us"
            }
        },
        "type": "result",
        "id": "51617.3263-310"
    },
    "content": [
        {
            "tag": "pictures",
            "attrs": {},
            "content": [
                {
                    "tag": "picture",
                    "attrs": {
                        "id": "1726960901",
                        "type": "image",
                        "url": "https://pps.whatsapp.net/v/t61.24694-24/459092693_1227473915169226_8444688071431836810_n.jpg?ccb=11-4&oh=01_Q5Aa3gEDdduDdmYF0o6MNQmVjezr6hGbeyo4AhPqMuvXRGkgPA&oe=696976EE&_nc_sid=5e03e0&_nc_cat=108",
                        "direct_path": "/v/t61.24694-24/459092693_1227473915169226_8444688071431836810_n.jpg?ccb=11-4&oh=01_Q5Aa3gEDdduDdmYF0o6MNQmVjezr6hGbeyo4AhPqMuvXRGkgPA&oe=696976EE&_nc_sid=5e03e0&_nc_cat=108",
                        "parent_group_jid": {
                            "$1": {
                                "type": 0,
                                "user": "120363333979933782",
                                "server": "g.us"
                            }
                        }
                    },
                    "content": null
                }
            ]
        }
    ]
}