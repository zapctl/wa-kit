const graphqlSchemas = parseGraphQLSchemas();

function parseGraphQLSchemas() {
    const schemaSpecs = {};
    const relayDefinitions = extractRelayModuleDefinitions();

    for (const definition of relayDefinitions) {
        const specName = definition.params.name.replace(/^WAWeb/, "");
        const schemaName = specName.replace(/Query$|Mutation$/, "");

        schemaSpecs[specName] = {
            id: definition.params.id,
            name: schemaName,
            type: definition.params.operationKind,
            input: parseInputSchema([definition.fragment]),
            output: parseOutputSchema([definition.fragment]),
        };
    }

    return schemaSpecs;
}

function extractRelayModuleDefinitions() {
    const relayModulesMap = {};
    const graphqlModuleIds = Object.keys(require('__debug')?.modulesMap || {})
        .filter(moduleId => moduleId.endsWith(".graphql"));

    for (const moduleId of graphqlModuleIds) {
        const module = require(moduleId);

        if (!module?.params?.id) continue;
        if (moduleId in relayModulesMap) continue;

        relayModulesMap[moduleId] = module;
    }

    return Object.values(relayModulesMap);
}

function parseInputSchema(nodes) {
    const schema = {};

    for (const node of nodes || []) {
        switch (node.kind) {
            case "Fragment":
                if (!node.selections[0]?.args?.length) return null;

                Object.assign(schema, {
                    type: "object",
                    properties: parseInputSchema([
                        ...node.argumentDefinitions,
                        ...node.selections[0].args,
                    ]),
                });
                break;

            case "LocalArgument":
            case "Variable":
            case "Literal":
                const fieldName = node.variableName || node.name;

                schema[fieldName] = {
                    type: "scalar",
                    value: node.value,
                };
                break;

            case "ObjectValue":
                schema[node.name] = {
                    type: "object",
                    properties: parseInputSchema(node.fields),
                };
                break;

            case "ListValue":
                schema[node.name] = {
                    type: "array",
                    items: parseInputSchema(node.items),
                };
                break;

            default:
                throw new Error(`Unhandled input node kind: ${node.kind}`);
        }
    }

    return schema;
}

function parseOutputSchema(nodes) {
    const schema = {};

    for (const node of nodes || []) {
        switch (node.kind) {
            case "Fragment":
                if (!node.selections?.length) return null;

                Object.assign(schema, {
                    type: "object",
                    properties: parseOutputSchema(node.selections),
                });
                break;

            case "LinkedField":
                schema[node.name] = {
                    type: node.plural ? "array" : "object",
                    [node.plural ? "items" : "properties"]: parseOutputSchema(node.selections),
                };
                break;

            case "ScalarField":
                if (node.name === "__typename") continue;

                schema[node.name] = {
                    type: "scalar",
                };
                break;

            case "RequiredField":
                const requiredFieldSchema = parseOutputSchema([node.field]);

                Object.keys(requiredFieldSchema).forEach(key => {
                    requiredFieldSchema[key].required = true;
                });

                Object.assign(schema, requiredFieldSchema);
                break;

            case "Condition": {
                const conditionalSchema = parseOutputSchema(node.selections);

                Object.values(conditionalSchema).forEach(field => {
                    field.condition = {
                        [conditionalSchema.condition]: conditionalSchema.passingValue
                    };
                });

                Object.assign(schema, conditionalSchema);
                break;
            }

            case "InlineFragment":
            case "InlineDataFragmentSpread":
                Object.assign(schema, parseOutputSchema(node.selections));
                break;

            default:
                throw new Error(`Unhandled output node kind: ${node.kind}`);
        }
    }

    return schema;
}

console.log("GraphQlSchemas", graphqlSchemas);

return graphqlSchemas;