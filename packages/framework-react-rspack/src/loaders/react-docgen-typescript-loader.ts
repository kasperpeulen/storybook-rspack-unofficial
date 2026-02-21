import { dirname } from 'node:path';

import MagicString from 'magic-string';
import type { ComponentDoc } from 'react-docgen-typescript';
import { withCompilerOptions } from 'react-docgen-typescript';
import ts from 'typescript';
import type { LoaderContext } from '@rspack/core';

// Cache the tsconfig path and parsed config, but recreate the program each compilation
let tsConfigPath: string | undefined;
let parsedConfig: ts.ParsedCommandLine | undefined;

function findTsConfig(resourcePath: string): ts.ParsedCommandLine | undefined {
  if (parsedConfig) return parsedConfig;

  const configPath = ts.findConfigFile(
    dirname(resourcePath),
    ts.sys.fileExists,
    'tsconfig.json'
  );

  if (configPath) {
    tsConfigPath = configPath;
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      dirname(configPath)
    );
    return parsedConfig;
  }

  return undefined;
}

function createProgram(resourcePath: string): ts.Program {
  const config = findTsConfig(resourcePath);

  if (config) {
    return ts.createProgram(config.fileNames, config.options);
  }

  return ts.createProgram([resourcePath], {
    jsx: ts.JsxEmit.React,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.Latest,
  });
}

function generateDocgenCode(
  source: string,
  filename: string,
  componentDocs: ComponentDoc[],
  typePropName: string
): { code: string; map: any } {
  const s = new MagicString(source, { filename });

  for (const doc of componentDocs) {
    const props: Record<string, any> = {};
    for (const [propName, prop] of Object.entries(doc.props)) {
      props[propName] = {
        defaultValue: prop.defaultValue?.value !== undefined ? { value: prop.defaultValue.value } : null,
        description: prop.description,
        name: prop.name,
        required: prop.required,
        [typePropName]: {
          name: prop.type.name,
          ...(Array.isArray(prop.type.value) ? { value: prop.type.value } : {}),
        },
      };
    }

    const docgenInfo = JSON.stringify({
      description: doc.description,
      displayName: doc.displayName,
      props,
    });

    s.append(`\ntry { ${doc.displayName}.__docgenInfo = ${docgenInfo}; } catch(e) {}`);
  }

  return {
    code: s.toString(),
    map: s.generateMap({
      source: filename,
      includeContent: true,
      hires: true,
    }),
  };
}

export interface DocgenTypescriptLoaderOptions {
  savePropValueAsString?: boolean;
  typePropName?: string;
}

export default function reactDocgenTypescriptLoader(
  this: LoaderContext<DocgenTypescriptLoaderOptions>,
  source: string,
  map: any
) {
  const callback = this.async();
  const options = this.getOptions() || {};
  const typePropName = options.typePropName || 'type';

  try {
    // Create a fresh program each time so file changes are picked up
    const program = createProgram(this.resourcePath);

    const parser = withCompilerOptions(program.getCompilerOptions(), {
      savePropValueAsString: options.savePropValueAsString ?? true,
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
    });

    const componentDocs = parser.parseWithProgramProvider(
      this.resourcePath,
      () => program
    );

    if (componentDocs.length === 0) {
      callback(null, source, map);
      return;
    }

    const result = generateDocgenCode(source, this.resourcePath, componentDocs, typePropName);
    callback(null, result.code, map ?? result.map);
  } catch {
    callback(null, source, map);
  }
}
