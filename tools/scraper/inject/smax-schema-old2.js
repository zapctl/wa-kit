const modulesMap = require("__debug").modulesMap;
const WAWap = require("WAWap");
const WASmaxAttrs = require("WASmaxAttrs");
const WASmaxChildren = require("WASmaxChildren");
const WASmaxMixins = require("WASmaxMixins");

const METADATA_SYMBOL = Symbol("metadata");
const skipForcedMixinFailure = new Set();

const Placeholder = {
    STANZA_ID: "123.12456-789",
    STRING: "placeholder",
    BOOLEAN: true,
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
    STANZA_ID: "id",
    STRING: "string",
    NUMBER: "number",
    BOOLEAN: "boolean",
    BINARY: "binary",
    JID: "jid",
    UNION: "union",
};

function getValueFromMetadata(metadata) {
    if (metadata.binary) {
        return new TextEncoder().encode(getValueFromMetadata({
            ...metadata,
            binary: undefined
        }));
    }
    else if (metadata.literal) return metadata.literal;
    else if (metadata.enum) return metadata.enum[0];

    switch (metadata.type) {
        case Types.STRING:
            return Placeholder.STRING;
        case Types.NUMBER: {
            const min = metadata.min ?? 1;
            const max = metadata.max ?? Number.MAX_SAFE_INTEGER;

            return Math.random() * (max - min) + min;
        }
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

function mergeMetadata(oldMetadata, newMetadata) {
    const mergedMetadata = { ...oldMetadata, ...newMetadata };

    if (oldMetadata.type && newMetadata.type === "string") {
        mergedMetadata.type = oldMetadata.type;
    }

    return mergedMetadata;
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
    const mergedAttrMetadata = mergeMetadata(existingAttrMetadata, metadata);

    attrsMetadata[attrName] = mergedAttrMetadata;
    node.attrs[attrName] = String(getValueFromMetadata(mergedAttrMetadata));

    return assignMetadata(node, { attrs: attrsMetadata });
}

function assignContent(node, metadata) {
    console.log("assignContent", metadata);

    const existingMetadata = node[METADATA_SYMBOL]?.content || {};
    const mergedMetadata = mergeMetadata(existingMetadata, metadata);

    node.content = getValueFromMetadata(mergedMetadata);

    return assignMetadata(node, { content: mergedMetadata });
}

function assignUnion(node, union) {
    console.log("assignUnion", union);

    const nodeMetadata = node[METADATA_SYMBOL] || {};
    const unions = nodeMetadata.unions || [];

    unions.push(union);

    return assignMetadata(node, { unions });
}

function pushChild(node, tagName, metadata = {}) {
    console.log("pushChild", tagName, metadata);

    for (let i = 0; i < (metadata.min || 1); i++) {
        const child = { tag: tagName, attrs: {}, content: null };

        if (!node.content) node.content = [child];
        else node.content.push(child);

        assignContent(child, metadata);
    }

    return node;
}

function mergeStanzas(...nodes) {
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
            if (
                Array.isArray(existentNode.content) &&
                Array.isArray(node.content)
            ) {
                return mergeStanzas(
                    ...existentNode.content,
                    ...node.content,
                );
            }

            return node.content || existentNode.content;
        })();

        const mergedMetadata = {
            namespace: existingMetadata.namespace || nodeMetadata.namespace,
            name: existingMetadata.name || nodeMetadata.name,
            attrs: {
                ...existingMetadata.attrs || {},
                ...nodeMetadata.attrs || {},
            },
            content: {
                ...existingMetadata.content || {},
                ...nodeMetadata.content || {},
            },
            unions: mergeStanzas(
                ...existingMetadata.unions || [],
                ...nodeMetadata.unions || [],
            ),
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

function withMockedModules(callback) {
    try {
        modulesMap["WAWap"].exports = createModuleMetadataProxy(WAWap);
        modulesMap["WASmaxAttrs"].exports = createModuleMetadataProxy(WASmaxAttrs);
        modulesMap["WASmaxChildren"].exports = createModuleMetadataProxy(WASmaxChildren);
        modulesMap["WASmaxMixins"].exports = createModuleMetadataProxy(WASmaxMixins);

        return callback();
    } finally {
        modulesMap["WAWap"].exports = WAWap;
        modulesMap["WASmaxAttrs"].exports = WASmaxAttrs;
        modulesMap["WASmaxChildren"].exports = WASmaxChildren;
        modulesMap["WASmaxMixins"].exports = WASmaxMixins;
    }
}

function withParamsPlaceholder(callback) {
    const proxy = {};
    const result = callback(proxy);

    return result;
}

function convertToSchema(stanza) {
    const metadata = stanza[METADATA_SYMBOL] || {};

    if (metadata.unions?.length > 0) {
        if (metadata.unions.length === 1) {
            const union = metadata.unions[0];
            delete metadata.unions;

            mergeStanzas(stanza, union);

            return convertToSchema(stanza);
        }

        return {
            type: "union",
            namespace: metadata.namespace,
            name: metadata.name,
            unions: metadata.unions.map(child => convertToSchema(child)),
        };
    }

    const schema = {
        type: "node",
        namespace: metadata.namespace,
        name: metadata.name,
        tag: stanza.tag,
        attributes: metadata.attrs,
    };

    const contentMetadata = Object.keys(metadata.content || {}).length > 0 ?
        metadata.content :
        null;

    if (Array.isArray(stanza.content)) {
        const children = stanza.content.map(child => convertToSchema(child));

        schema.content = contentMetadata ?
            { ...contentMetadata, children } :
            children;
    } else {
        schema.content = contentMetadata;
    }

    Object.entries(schema).forEach(([key, val]) => {
        if (val === undefined) delete schema[key];
    });

    return schema;
}

const smaxParseInput = Object.keys(modulesMap)
    .filter(key => key.startsWith("WASmaxIn"))
    .map(moduleName => {
        const module = require(moduleName);
        const moduleKeys = Object.keys(module);

        const name = moduleName.replace(/^WASmaxIn|Mixin$/g, "");
        const parseName = moduleKeys.find(key => moduleName.endsWith(key.replace(/^parse/, "")));

        return { name, parseName, parse: module[parseName] };
    })
    .filter(mod => mod.parse)
    .sort((a, b) => a.name.localeCompare(b.name));

const schemas = withMockedModules(() => {
    console.clear();

    const schemaSpecs = {};

    for (const { name, parseName, parse } of smaxParseInput) {
        // if (
        //     name !== "ChatstateServerNotificationRequest" &&
        //     name !== "ChatstateStateTypes"
        // ) continue;

        const stanza = withParamsPlaceholder(parse);
        const stanzaName = createModuleName(name, parseName);

        assignMetadata(stanza, {
            namespace: stanzaName.namespace,
            name: stanzaName.variant,
        });

        console.log(name, stanza)
        schemaSpecs[name] = convertToSchema(stanza);
    }

    return schemaSpecs;
});

console.clear();
console.log("SMaxInputSchemas", schemas);