import fs from 'fs';

const tools = JSON.parse(fs.readFileSync('mcp_tools.json', 'utf8'));

function convertSchemaToGemini(schema) {
  if (!schema) return undefined;
  let type = "Type.OBJECT";
  if (schema.type === 'string') type = "Type.STRING";
  else if (schema.type === 'number' || schema.type === 'integer') type = "Type.NUMBER";
  else if (schema.type === 'boolean') type = "Type.BOOLEAN";
  else if (schema.type === 'array') type = "Type.ARRAY";

  let out = `{ type: ${type}`;
  if (schema.description) out += `, description: ${JSON.stringify(schema.description)}`;
  if (schema.enum) out += `, enum: ${JSON.stringify(schema.enum)}`;

  if (schema.properties) {
    out += `, properties: { `;
    for (const [k, v] of Object.entries(schema.properties)) {
      out += `"${k}": ${convertSchemaToGemini(v)}, `;
    }
    out += `}`;
  }

  if (schema.items) {
    out += `, items: ${convertSchemaToGemini(schema.items)}`;
  }
  
  if (schema.required) {
    out += `, required: ${JSON.stringify(schema.required)}`;
  }

  out += ` }`;
  return out;
}

let out = `const empreendedorismoTools = [{ functionDeclarations: [\n`;
for (const t of tools) {
  out += `  {\n`;
  out += `    name: ${JSON.stringify(t.name)},\n`;
  out += `    description: ${JSON.stringify(t.description)},\n`;
  if (t.inputSchema) {
    out += `    parameters: ${convertSchemaToGemini(t.inputSchema)}\n`;
  }
  out += `  },\n`;
}
out += `] }];\n`;

fs.writeFileSync('generated_tools.ts', out);
console.log('done');
