import path from 'node:path';
import MagicString, { type SourceMap } from 'magic-string';
import type { ComponentDoc } from 'react-docgen-typescript';

export interface GeneratorOptions {
  filename: string;
  source: string;
  componentDocs: ComponentDoc[];
  setDisplayName: boolean;
  typePropName: string;
}

export function generateDocgenCodeBlock(options: GeneratorOptions): {
  code: string;
  map: SourceMap;
} {
  const s = new MagicString(options.source, { filename: options.filename });

  for (const d of options.componentDocs) {
    const props: Record<string, any> = {};
    for (const [propName, prop] of Object.entries(d.props)) {
      props[propName] = {
        defaultValue: prop.defaultValue?.value !== undefined ? { value: prop.defaultValue.value } : null,
        description: prop.description,
        name: prop.name,
        required: prop.required,
        [options.typePropName]: {
          name: prop.type.name,
          ...(Array.isArray(prop.type.value) ? { value: prop.type.value } : {}),
        },
      };
    }

    const docgenInfo = JSON.stringify({
      description: d.description,
      displayName: d.displayName,
      props,
    });

    const lines: string[] = [];
    if (options.setDisplayName) {
      lines.push(`${d.displayName}.displayName = ${JSON.stringify(d.displayName)};`);
    }
    lines.push(`${d.displayName}.__docgenInfo = ${docgenInfo};`);

    s.append(`\ntry { ${lines.join(' ')} } catch(e) {}`);
  }

  return {
    code: s.toString(),
    map: s.generateMap({ source: options.filename, includeContent: true, hires: true }),
  };
}
