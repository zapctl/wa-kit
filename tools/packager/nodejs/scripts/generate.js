const fs = require("fs");

const [, , inputJsonFile, outputFile] = process.argv;

if (!inputJsonFile || !outputFile) {
    console.error("Error: Missing arguments");
    process.exit(1);
}

const specs = JSON.parse(fs.readFileSync(inputJsonFile, "utf8"));

function toSnakeCase(value) {
    return value.replace(/([a-z])(?=[A-Z])/g, '$1_').toUpperCase();
}

function toPascalCase(value) {
    return toSnakeCase(value)
        .toLowerCase()
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join("")
        .replace(/Whatsapp/g, "WhatsApp");
}

function serializeValue(value) {
    if (Array.isArray(value)) return `[${value.map(val => `"${val}"`).join(", ")}]`;
    else if (typeof value === "string") return `"${value}"`;
    return String(value);
}

function generateConstants() {
    let output = "";

    for (const [name, value] of Object.entries(specs.constants || {})) {
        const propName = toSnakeCase(name);
        const propValue = serializeValue(value);

        output += `export const ${propName} = ${propValue};\n`;
    }

    return output;
}

function generateEnums() {
    let output = "";

    for (const [name, spec] of Object.entries(specs.enums || {})) {
        const enumName = toPascalCase(name);
        output += `export enum ${enumName} {\n`;

        for (const [prop, value] of Object.entries(spec)) {
            const propName = toPascalCase(prop);
            const propValue = serializeValue(value);

            output += `\t${propName} = ${propValue},\n`;
        }

        output += "}\n\n";
    }

    return output;
}

let output = "";

if (fs.existsSync(outputFile)) {
    output += fs.readFileSync(outputFile, "utf8") + "\n\n";
}

output += generateConstants() + "\n";
output += generateEnums();
output = output.trim();

fs.writeFileSync(outputFile, output, "utf8");