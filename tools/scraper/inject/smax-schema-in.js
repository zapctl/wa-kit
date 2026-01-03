const modulesMap = require("__debug").modulesMap;
const WASmaxParseUtils = require("WASmaxParseUtils");
const WASmaxParseJid = require("WASmaxParseJid");
const WASmaxParseReference = require("WASmaxParseReference");

const METADATA_SYMBOL = Symbol("metadata");
const FORCED_FAILURE_ERROR = "Forced failure to capture all union variants";

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
    UNION: "union",
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

function assignMetadata(node, metadata) {
    const existingMetadata = node[METADATA_SYMBOL] || {};
    const mergedMetadata = { ...existingMetadata, ...metadata };

    return Object.defineProperty(node, METADATA_SYMBOL, {
        value: mergedMetadata,
        configurable: false,
        enumerable: false,
        writable: true,
    });
}

function assignAttr(node, attrName, metadata) {
    console.log("assignAttr", attrName, metadata);

    if (!node.attrs) node.attrs = {};

    const attrsMetadata = node[METADATA_SYMBOL]?.attrs || {};
    const existingAttrMetadata = attrsMetadata[attrName] || {};
    const mergedAttrMetadata = { ...metadata, ...existingAttrMetadata };

    attrsMetadata[attrName] = mergedAttrMetadata;
    node.attrs[attrName] = String(getValueFromMetadata(mergedAttrMetadata));

    return assignMetadata(node, { attrs: attrsMetadata });
}

function assignContent(node, contentMetadata) {
    console.log("assignContent", contentMetadata);

    const existingMetadata = node[METADATA_SYMBOL]?.content || {};
    const mergedMetadata = { ...existingMetadata, ...contentMetadata };

    node.content = getValueFromMetadata(mergedMetadata);

    return assignMetadata(node, { content: mergedMetadata });
}

function assignUnion(node, union, returnValue) {
    console.log("assignUnion", union);

    const nodeMetadata = node[METADATA_SYMBOL] || {};
    const unions = nodeMetadata.unions || [];

    unions.push(union);
    if (!node.tag) node.tag = union.tag;

    return assignMetadata(node, {
        unions,
        unionReturnValue: nodeMetadata.unionReturnValue || returnValue,
    });
}

function pushChild(node, tagName, childMetadata = {}) {
    console.log("pushChild", tagName);

    const child = { tag: tagName, attrs: {}, content: null };

    if (!node.content) node.content = [child];
    else node.content.push(child);

    return assignContent(child, childMetadata);
}

function mergeStanzas(nodes) {
    return nodes.reduce((acc, node) => {
        const existentNode = acc.find(child => child.tag === node.tag);

        if (!existentNode) {
            acc.push(node);
            return acc;
        }

        const existingMetadata = existentNode[METADATA_SYMBOL] || {};
        const nodeMetadata = node[METADATA_SYMBOL] || {};

        const mergedAttrs = {
            ...existentNode.attrs || {},
            ...node.attrs || {},
        };

        const mergedContent = (() => {
            if (Array.isArray(existentNode.content) && Array.isArray(node.content))
                return mergeStanzas([...existentNode.content, ...node.content]);

            return node.content || existentNode.content;
        })();

        const mergedMetadata = {
            name: existingMetadata.name || nodeMetadata.name,
            attrs: {
                ...existingMetadata.attrs || {},
                ...nodeMetadata.attrs || {},
            },
            content: {
                ...existingMetadata.content || {},
                ...nodeMetadata.content || {},
            },
        }

        Object.assign(existentNode, {
            attrs: mergedAttrs,
            content: mergedContent,
        });

        Object.defineProperty(existentNode, METADATA_SYMBOL, {
            value: mergedMetadata,
            configurable: false,
            enumerable: false,
            writable: true,
        });

        return acc;
    }, []);
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
                            literal: literal !== Placeholder.STRING ? literal : undefined,
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
                            literal: literal !== Placeholder.STRING ? literal : undefined,
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

                case "attrFromReference":
                case "attrStringFromReference":
                case "optionalAttrFromReference":
                    return (...props) => {
                        const node = props.find(node => node.tag);
                        const attrNamePath = props.find(Array.isArray);

                        if (node && attrNamePath.length === 1) {
                            assignAttr(node, attrNamePath[0], {
                                reference: true,
                            });
                        }

                        return originalValue(...props);
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

                case "errorMixinDisjunction":
                    return (node, variantNames, results) => {
                        const nodeMetadata = node[METADATA_SYMBOL] || {};
                        const returnValue = nodeMetadata.unionReturnValue;

                        if (returnValue) return { success: true, value: returnValue };
                        else return originalValue(node, variantNames, results);
                    }

                default:
                    return originalValue;
            }
        },
    });
}

function createModuleName(moduleName, propertyName) {
    const cleanName = moduleName.replace(/^WASmaxIn|Mixin$/g, "");
    const variant = propertyName.replace(/^parse|Mixin$/g, "");
    const namespace = cleanName.replace(variant, "");

    return { namespace, variant };
}

let skipNextForcedMixinFailure = false;

function createMixinProxy(mixinModule, moduleName) {
    return new Proxy(mixinModule, {
        get(target, propertyName) {
            const originalValue = target[propertyName];
            const isParseMixin = typeof originalValue === "function" &&
                propertyName.startsWith("parse") &&
                propertyName.endsWith("Mixin");

            if (!isParseMixin) return originalValue;

            const name = createModuleName(moduleName, propertyName);
            console.log("handleMixin", name);

            return function (node, ...rest) {
                const proxy = {};

                const result = originalValue(proxy, ...rest);
                if (!result?.success) return result;

                assignMetadata(proxy, { name });
                assignUnion(node, proxy, result.value);

                if (skipNextForcedMixinFailure) {
                    skipNextForcedMixinFailure = false;
                    debugger;
                    return result;
                }

                return { success: false, error: FORCED_FAILURE_ERROR };
            };
        }
    });
}

function withMockedModules(callback) {
    const originalExports = {};

    try {
        modulesMap["WASmaxParseUtils"].exports = createModuleMetadataProxy(WASmaxParseUtils);
        modulesMap["WASmaxParseJid"].exports = createModuleMetadataProxy(WASmaxParseJid);
        modulesMap["WASmaxParseReference"].exports = createModuleMetadataProxy(WASmaxParseReference);

        Object.keys(modulesMap)
            .filter(key => key.includes("Mixin"))
            .forEach(moduleName => {
                const module = require(moduleName);
                if (typeof module !== "object") return;

                originalExports[moduleName] = module;
                modulesMap[moduleName].exports = createMixinProxy(module, moduleName);
            });

        return callback();
    } finally {
        modulesMap["WASmaxParseUtils"].exports = WASmaxParseUtils;
        modulesMap["WASmaxParseJid"].exports = WASmaxParseJid;
        modulesMap["WASmaxParseReference"].exports = WASmaxParseReference;

        Object.keys(originalExports).forEach(moduleName => {
            modulesMap[moduleName].exports = originalExports[moduleName];
        });
    }
}

function withParamsPlaceholder(callback) {
    const proxy = {}
    const result = callback(proxy, proxy);

    if (result.success === false && result.error === FORCED_FAILURE_ERROR) {
        skipNextForcedMixinFailure = true; // isso aqui é falho pois só corrige o primeiro mixin
        return withParamsPlaceholder(callback);
    }

    return proxy;
}

function convertToSchema(stanza) {
    const metadata = stanza[METADATA_SYMBOL] || {};

    if (metadata.unions) {
        if (metadata.unions.length === 1) {
            mergeStanzas([stanza, metadata.unions[0]]);

            return convertToSchema(stanza);
        }

        return {
            type: "union",
            unions: metadata.unions.map(child => convertToSchema(child)),
        }
    }

    const schema = {
        type: "node",
        name: metadata.name,
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
    // .filter(key => !/Mixin|Error|(Errors|Enums|Types|Ids)$/.test(key))
    // .filter(key => !/(Errors|Enums|Types|Ids)$/.test(key))
    .map(moduleName => {
        const module = require(moduleName);
        const moduleKeys = Object.keys(module);

        const cleanName = moduleName.replace(/^WASmaxIn|Mixin$/g, "");
        const parseName = moduleKeys.find(key => moduleName.endsWith(key.replace(/^parse/, "")));

        return { name: cleanName, parse: module[parseName], parseName };
    })
    .filter(mod => mod.parse);

const schemas = withMockedModules(() => {
    console.clear();

    const schemaSpecs = {};

    for (const { name, parse, parseName } of smaxParseInput) {
        if (
            // name !== "BlocklistsBlocklistIds" &&
            name !== "GroupsGetGroupProfilePicturesResponseSuccessGroupPictures"
        ) continue;

        const stanza = withParamsPlaceholder(parse);
        const stanzaName = createModuleName(name, parseName);

        assignMetadata(stanza, { name: stanzaName });

        console.log(stanza)
        schemaSpecs[name] = convertToSchema(stanza);
    }

    return schemaSpecs;
});

// console.clear();
console.log("SMaxInputSchemas", schemas);