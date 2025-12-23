const modulesMap = require("__debug").modulesMap;
const WASmaxParseUtils = require("WASmaxParseUtils");
const WASmaxParseJid = require("WASmaxParseJid");
const WASmaxParseReference = require("WASmaxParseReference");

const METADATA_SYMBOL = Symbol("metadata");

const Placeholder = {
    STANZA_ID: "123.12456-789",
    STRING: "placeholder",
    NUMBER: 123456789,
    ARRAY: [],
    BOOLEAN: true,
    BINARY: new Uint8Array(),
    JID: {
        DomainJid: "s.whatsapp.net",
        UserJid: "123456789@s.whatsapp.net",
        LidUserJid: "123456789@lid",
        BroadcastJid: "123456789@broadcast",
        DeviceJid: "123456789:1@s.whatsapp.net",
        InteropDeviceJid: "12-3456789@interop",
        CallJid: "123456789123456789@call",
        GroupJid: "123456789@g.us",
        StatusJid: "status@broadcast",
        ChatJid: "123456789@s.whatsapp.net",
        NewsletterJid: "123456789@newsletter",
    },
};

const Types = {
    JID: "jid",
    STANZA_ID: "id",
    STRING: "string",
    NUMBER: "number",
    BOOLEAN: "boolean",
    BINARY: "binary",
};

function getValueFromMetadata(metadata) {
    if (metadata.literal) return metadata.literal;

    switch (metadata.type) {
        case Types.STRING:
            if (metadata.enum) return metadata.enum[0];
            return Placeholder.STRING;
        case Types.NUMBER:
            return Placeholder.NUMBER;
        case Types.BOOLEAN:
            return Placeholder.BOOLEAN;
        case Types.BINARY:
            return new Uint8Array(metadata.min || 0);
        case Types.STANZA_ID:
            return Placeholder.STANZA_ID;
        case Types.JID:
            return Placeholder.JID[metadata.jidTypes[0]] ||
                Placeholder.JID.DomainJid;
        default:
            return undefined;
    }
}

function assignAttr(node, attrName, attrMetadata) {
    console.log("assignAttr", attrName, attrMetadata);

    if (!node.attrs) node.attrs = {};

    const nodeMetadata = node[METADATA_SYMBOL] || {};
    const attrsMetadata = nodeMetadata.attrs || {};
    const existingMetadata = attrsMetadata[attrName] || {};
    const mergedMetadata = { ...attrMetadata, ...existingMetadata };

    attrsMetadata[attrName] = mergedMetadata;
    node.attrs[attrName] = String(getValueFromMetadata(mergedMetadata));

    return Object.defineProperty(node, METADATA_SYMBOL, {
        value: { ...nodeMetadata, attrs: attrsMetadata },
        configurable: false,
        enumerable: false,
        writable: true,
    });
}

function assignContent(node, contentMetadata) {
    console.log("assignContent", contentMetadata);

    const nodeMetadata = node[METADATA_SYMBOL] || {};
    const existingMetadata = nodeMetadata.content || {};
    const mergedMetadata = { ...existingMetadata, ...contentMetadata };

    node.content = getValueFromMetadata(mergedMetadata);

    return Object.defineProperty(node, METADATA_SYMBOL, {
        value: { ...nodeMetadata, content: mergedMetadata },
        configurable: false,
        enumerable: false,
        writable: true,
    });
}

function pushChild(node, tagName, childMetadata = {}) {
    console.log("pushChild", tagName);

    const child = { tag: tagName, attrs: {}, content: null };

    if (!node.content) node.content = [child];
    else node.content.push(child);

    return assignContent(child, childMetadata);
}

function createModuleMetadataProxy(targetModule) {
    return new Proxy(targetModule, {
        get(target, propertyName) {
            const originalValue = target[propertyName];

            switch (propertyName) {
                case "assertTag":
                    return (node, tagName) => {
                        node.tag = tagName;

                        return originalValue(node, tagName);
                    }

                case "literal":
                    return (typeFactory, node, attrName, literal) => {
                        assignAttr(node, attrName, {
                            type: typeof literal,
                            literal,
                        });

                        return originalValue(typeFactory, node, attrName, literal);
                    }

                case "optional":
                    return (typeFactory, node, attrName, ...rest) => {
                        assignAttr(node, attrName, { optional: true });

                        return originalValue(typeFactory, node, attrName, ...rest);
                    }

                case "optionalLiteral":
                    return (typeFactory, node, attrName, literal) => {
                        assignAttr(node, attrName, {
                            type: typeof literal,
                            literal,
                            optional: true,
                        });

                        return originalValue(typeFactory, node, attrName, literal);
                    }

                case "attrInt":
                    return (node, attrName) => {
                        assignAttr(node, attrName, { type: Types.NUMBER });

                        return originalValue(node, attrName);
                    }

                case "attrUserJid":
                case "attrLidUserJid":
                case "attrDeviceJid":
                case "attrGroupJid":
                case "attrCallJid":
                case "attrDomainJid":
                case "attrBroadcastJid":
                case "attrStatusJid":
                case "attrNewsletterJid":
                    return (node, attrName) => {
                        const jidType = propertyName.replace("attr", "");

                        assignAttr(node, attrName, {
                            type: Types.JID,
                            jidTypes: [jidType],
                        });

                        return originalValue(node, attrName);
                    }

                case "literalJid":
                    return (typeFactory, node, attrName, literal) => {
                        assignAttr(node, attrName, {
                            type: Types.JID,
                            literal: String(literal),
                        });

                        return originalValue(typeFactory, node, attrName, literal);
                    }

                case "attrJidEnum":
                    return (node, attrName, enumValidator) => {
                        const jidTypes = enumValidator.typeName.split("|");

                        assignAttr(node, attrName, {
                            type: Types.JID,
                            jidTypes: Array.from(new Set(jidTypes)),
                        });

                        return originalValue(node, attrName, enumValidator);
                    }

                case "attrStanzaId":
                    return (node, attrName) => {
                        assignAttr(node, attrName, { type: Types.STANZA_ID });

                        return originalValue(node, attrName);
                    }

                case "attrString":
                    return (node, attrName) => {
                        assignAttr(node, attrName, { type: Types.STRING });

                        return originalValue(node, attrName);
                    }

                case "attrStringEnum":
                    return (node, attrName, enumObj) => {
                        if (!enumObj) debugger
                        assignAttr(node, attrName, {
                            type: Types.STRING,
                            enum: Object.values(enumObj),
                        });

                        return originalValue(node, attrName, enumObj);
                    }

                case "attrIntRange":
                    return (node, attrName, min, max) => {
                        assignAttr(node, attrName, {
                            type: Types.NUMBER,
                            min,
                            max,
                        });

                        return originalValue(node, attrName, min, max);
                    }

                case "flattenedChildWithTag":
                    return (node, tagName) => {
                        pushChild(node, tagName);

                        return originalValue(node, tagName);
                    }

                case "mapChildrenWithTag":
                    return (node, tagName, min, max, callbackfn) => {
                        pushChild(node, tagName, { min, max });

                        return originalValue(node, tagName, min, max, callbackfn);
                    }

                case "optionalChild":
                    return (node, tagName) => {
                        pushChild(node, tagName, { min: 0 });

                        return originalValue(node, tagName);
                    }

                case "optionalChildWithTag":
                    return (node, tagName, callbackfn) => {
                        pushChild(node, tagName, { min: 0 });

                        return originalValue(node, tagName, callbackfn);
                    }

                case "contentBytes":
                    return (node) => {
                        assignContent(node, { type: Types.BINARY });

                        return originalValue(node);
                    }

                case "contentInt":
                    return (node) => {
                        assignContent(node, { type: Types.NUMBER });

                        return originalValue(node);
                    }

                case "contentLiteralBytes":
                    return (node, literal) => {
                        assignContent(node, {
                            type: Types.BINARY,
                            literal,
                        });

                        return originalValue(node, literal);
                    }

                case "contentStringEnum":
                    return (node, enumObj) => {
                        assignContent(node, {
                            type: Types.STRING,
                            enum: Object.values(enumObj),
                        });

                        return originalValue(node, enumObj);
                    }

                case "contentBytesRange":
                    return (node, min, max) => {
                        assignContent(node, {
                            type: Types.BINARY,
                            min,
                            max,
                        });

                        return originalValue(node, min, max);
                    }

                case "literalContent":
                    return (typeFactory, node, content) => {
                        assignContent(node, {
                            type: typeof content,
                            literal: content,
                        });

                        return originalValue(typeFactory, node, content);
                    }

                case "contentString":
                    return (node) => {
                        assignContent(node, { type: Types.STRING });

                        return originalValue(node);
                    }

                default:
                    return originalValue;
            }
        },
    });
}

function withMockedModules(callback) {
    try {
        modulesMap["WASmaxParseUtils"].exports = createModuleMetadataProxy(WASmaxParseUtils);
        modulesMap["WASmaxParseJid"].exports = createModuleMetadataProxy(WASmaxParseJid);
        modulesMap["WASmaxParseReference"].exports = createModuleMetadataProxy(WASmaxParseReference);

        return callback();
    } finally {
        modulesMap["WASmaxParseUtils"].exports = WASmaxParseUtils;
        modulesMap["WASmaxParseJid"].exports = WASmaxParseJid;
        modulesMap["WASmaxParseReference"].exports = WASmaxParseReference;
    }
}

function withParamsPlaceholder(callback) {
    const proxy = {};
    proxy.result = callback(proxy, proxy);

    return proxy;
}

function convertToSchema(stanza) {
    const metadata = stanza[METADATA_SYMBOL] || {};

    const schema = {
        tag: stanza.tag,
        attributes: metadata.attrs || {},
        content: Array.isArray(stanza.content) ?
            stanza.content.map(child => convertToSchema(child)) :
            metadata.content,
    };

    if (metadata.children && Object.keys(metadata.children).length > 0) {
        schema.children = metadata.children;
    }

    return schema;
}

const smaxParseInput = Object.keys(modulesMap)
    .filter(key => key.startsWith("WASmaxIn"))
    .filter(key => !/Mixin|Error|(Errors|Enums|Types|Ids)$/.test(key))
    .map(moduleName => {
        const module = require(moduleName);
        const moduleKeys = Object.keys(module);

        const cleanName = moduleName.replace(/^WASmaxIn$/g, "");
        const parseKey = moduleKeys.find(key => moduleName.endsWith(key.replace("parse", "")));

        return { name: cleanName, parse: module[parseKey] };
    })
    .filter(mod => mod.parse);

const schemas = withMockedModules(() => {
    console.clear();

    const schemaSpecs = {};

    // WASmaxInChatstateStateSource pode chamar parseFromUserMixin ou parseFromGroupMixin, porem sempre irá capturar apenas um

    console.log(withParamsPlaceholder(
        require("WASmaxInAbPropsGetExperimentConfigResponseSuccess")
            .parseGetExperimentConfigResponseSuccess));

    // for (const { name, parse } of smaxParseInput) {
    //     const stanza = withParamsPlaceholder(parse);

    //     // Debug: mostra metadados vs valores
    //     if (name === "AbPropsGetExperimentConfigResponseSuccess") {
    //         console.log("stanza.attrs:", stanza.attrs);
    //         console.log("metadata.attrs:", stanza[METADATA_SYMBOL]?.attrs);
    //     }

    //     const schema = convertToSchema(stanza);

    //     schemaSpecs[name] = schema;
    // }

    return schemaSpecs;
});

console.log("SMaxInputSchemas", schemas);