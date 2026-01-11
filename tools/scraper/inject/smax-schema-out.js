const modulesMap = require("__debug").modulesMap;
const WAWap = require("WAWap");
const WASmaxAttrs = require("WASmaxAttrs");
const WASmaxChildren = require("WASmaxChildren");
const WASmaxMixins = require("WASmaxMixins");

const METADATA_SYMBOL = Symbol("metadata");
const PLACEHOLDER_RETRY_ERROR = new Error("retry");

const WAWapTypes = {
    G_US: "JID",
    S_WHATSAPP_NET: "JID",
    STATUS_BROADCAST: "JID",
    NEWSLETTER: "JID",
    HOSTED: "JID",
    HOSTED_LID: "JID",
    CALL: "JID",
    extractToJid: "JID",
    extractParticipantJid: "JID",
    PARTICIPANT_JID: "JID",
    TO_JID: "JID",
    JID: "JID",
    DOMAIN_JID: "JID",
    USER_JID: "JID",
    DEVICE_JID: "JID",
    GROUP_JID: "JID",
    BROADCAST_JID: "JID",
    CALL_JID: "JID",
    NEWSLETTER_JID: "JID",
    TO_WAP_JID: "JID",
    generateId: "id",
    STANZA_ID: "STANZA_ID",
    CUSTOM_STRING: "STRING",
    CALL_ID: "STRING",
    MAYBE_CUSTOM_STRING: "STRING",
    INT: "NUMBER",
    LONG_INT: "NUMBER",
};

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
    JID: "JID",
    STANZA_ID: "id",
    STRING: "string",
    NUMBER: "number",
    BOOLEAN: "boolean",
    BINARY: "binary",
};

function mergeStanzas(nodes) {
    return nodes.reduce((acc, node) => {
        const existentNode = acc.find(child => child.tag === node.tag);

        if (!existentNode) {
            acc.push(node);
            return acc;
        }

        const mergedContent = (() => {
            if (Array.isArray(existentNode.content) && Array.isArray(node.content))
                return mergeStanzas([...existentNode.content, ...node.content]);

            return node.content || existentNode.content;
        })();

        const mergedMetadata = {
            ...existentNode[METADATA_SYMBOL] || {},
            ...node[METADATA_SYMBOL] || {},
        }

        Object.assign(existentNode, {
            attrs: {
                ...existentNode.attrs || {},
                ...node.attrs || {},
            },
            content: mergedContent,
        });

        Object.defineProperty(existentNode, METADATA_SYMBOL, {
            value: mergedMetadata,
            configurable: false,
            enumerable: false,
            writable: false,
        });

        return acc;
    }, []);
}

function attachTypeMetadata(property, types) {
    if (typeof property === "function") {
        return (...args) => {
            args.forEach(arg => arg?.recordHint?.(types.type));

            return attachTypeMetadata(property(...args), types);
        }
    }

    if (!property) return;

    const existingTypes = property?.[METADATA_SYMBOL];
    const mergedTypes = Object.assign(existingTypes || {}, types);
    const decoratedValue = !existingTypes ?
        Object(typeof property === "object" ? { ...property } : property) :
        property;

    console.log("attachTypeMetadata", { property, types, decoratedValue });

    return Object.defineProperty(decoratedValue, METADATA_SYMBOL, {
        value: mergedTypes,
        configurable: false,
        enumerable: false,
        writable: false,
    });
}

function createParamsPlaceholderProxy(hint, path = "") {
    return new Proxy({}, {
        get(_, propName) {
            if (propName === "recordHint") {
                return (propHint) => {
                    console.log("recordHint", path, propHint);
                    hint.set(path, propHint);

                    throw PLACEHOLDER_RETRY_ERROR;
                };
            }

            const propPath = `${path}.${String(propName)}`.replace(/^\./, "");
            const propHint = hint.get(propPath);

            console.log("get", propPath, propHint);

            if (propHint) {
                if (propHint === "ARRAY") return [createParamsPlaceholderProxy(hint, propPath)];
                return Placeholder[propHint];
            }

            return createParamsPlaceholderProxy(hint, propPath);
        },
    });
}

function createModuleMetadataProxy(targetModule) {
    return new Proxy(targetModule, {
        get(target, propertyName) {
            const originalValue = target[propertyName];

            if (propertyName in WAWapTypes) return attachTypeMetadata(
                originalValue,
                { type: WAWapTypes[propertyName] }
            );

            switch (propertyName) {
                case "OPTIONAL":
                    return (factory, enabled) => {
                        return attachTypeMetadata(
                            originalValue(factory, enabled),
                            { optional: true },
                        );
                    }

                case "OPTIONAL_LITERAL":
                    return (literal, enabled) => {
                        enabled?.recordHint?.("BOOLEAN");

                        return attachTypeMetadata(
                            originalValue(literal, true),
                            { optional: true, literal },
                        );
                    }

                case "OPTIONAL_CHILD":
                    return (child, args) => {
                        return attachTypeMetadata(
                            originalValue(child, args),
                            { optional: true },
                        );
                    }

                case "REPEATED_CHILD":
                    return (factory, arr, min, max) => {
                        arr?.recordHint?.("ARRAY");

                        return mergeStanzas(originalValue(factory, arr, min, max))
                            .map(child => attachTypeMetadata(
                                child,
                                { min, max },
                            ));
                    }

                case "mergeStanzas":
                    return (a, b) => mergeStanzas([a, b])[0];

                default:
                    return originalValue;
            }
        },
    });
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

function withParamsPlaceholder(callback, hint = new Map()) {
    const proxy = createParamsPlaceholderProxy(hint);

    try {
        return callback(proxy);
    } catch (error) {
        if (error === PLACEHOLDER_RETRY_ERROR)
            return withParamsPlaceholder(callback, hint);

        throw error;
    }
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

const smaxMakeOutput = Object.keys(modulesMap)
    .filter(key => /^WASmaxOut.*Request$/i.test(key))
    .map(moduleName => {
        const module = require(moduleName);
        const moduleKeys = Object.keys(module);

        const cleanName = moduleName.replace(/^WASmaxOut|Request$/g, "");
        const makeKey = moduleKeys.find(key => moduleName.endsWith(key.replace("make", "")));

        return {
            name: cleanName,
            make: module[makeKey],
        };
    })
    .filter(mod => mod.make);

const schemas = withMockedModules(() => {
    console.clear();

    const schemaSpecs = {};

    for (const { name, make } of smaxMakeOutput) {
        const stanza = withParamsPlaceholder(make);
        const schema = convertToSchema(stanza);

        schemaSpecs[name] = schema;
    }

    return schemaSpecs;
});

console.log("SMaxOutputSchemas", schemas);

// return schemas;