import { expect, describe, it } from "vitest";
import {
  genImport,
  genExport,
  genDynamicImport,
  genDynamicTypeImport,
  genSafeVariableName,
} from "../src";
import { genTestTitle } from "./_utils";

const genImportTests = [
  {
    names: undefined,
    code: 'import "pkg";',
  },
  { names: "foo", code: 'import foo from "pkg";' },
  { names: ["foo"], code: 'import { foo } from "pkg";' },
  {
    names: "foo",
    code: `import foo from 'pkg';`,
    options: { singleQuotes: true },
  },
  {
    names: [{ name: "foo", as: "foo" }],
    code: 'import { foo } from "pkg";',
  },
  {
    names: [{ name: "foo", as: "bar" }],
    code: 'import { foo as bar } from "pkg";',
  },
  { names: { name: "*", as: "bar" }, code: 'import * as bar from "pkg";' },
  {
    names: [{ name: "default", as: "Test" }],
    code: 'import { default as Test } from "pkg";',
  },
  {
    names: ["foo"],
    code: 'import { foo } from "pkg" assert { type: "json" };',
    options: { assert: { type: "json" } },
  },
  {
    names: ["foo"],
    code: 'import { foo } from "pkg" with { type: "json" };',
    options: { attributes: { type: "json" } },
  },
];

describe("genImport", () => {
  for (const t of genImportTests) {
    it(genTestTitle(t.code), () => {
      const code = genImport("pkg", t.names, t.options);
      expect(code).to.equal(t.code);
    });
  }
});

const genExportTests = [
  { names: undefined, code: 'export "pkg";' },
  { names: "foo", code: 'export foo from "pkg";' },
  { names: ["foo"], code: 'export { foo } from "pkg";' },
  {
    names: [{ name: "foo", as: "bar" }],
    code: 'export { foo as bar } from "pkg";',
  },
  { names: { name: "*", as: "bar" }, code: 'export * as bar from "pkg";' },
  { names: ["default"], code: 'export { default } from "pkg";' },
  {
    names: ["foo"],
    code: 'export { foo } from "pkg" assert { type: "json" };',
    options: { assert: { type: "json" } },
  },
];

describe("genExport", () => {
  for (const t of genExportTests) {
    it(genTestTitle(t.code), () => {
      const code = genExport("pkg", t.names, t.options);
      expect(code).to.equal(t.code);
    });
  }
});

const genDynamicImportTests = [
  { code: '() => import("pkg")' },
  { opts: { wrapper: false }, code: 'import("pkg")' },
  {
    opts: { interopDefault: true },
    code: '() => import("pkg").then(m => m.default || m)',
  },
  {
    opts: { comment: 'webpackChunkName: "chunks/dynamic"' },
    code: '() => import("pkg" /* webpackChunkName: "chunks/dynamic" */)',
  },
  {
    opts: { assert: { type: "json" } },
    code: '() => import("pkg", { assert: { type: "json" } })',
  },
  {
    opts: { attributes: { type: "json" } },
    code: '() => import("pkg", { with: { type: "json" } })',
  },
];

describe("genDynamicImport", () => {
  for (const t of genDynamicImportTests) {
    it(genTestTitle(t.code), () => {
      const code = genDynamicImport("pkg", t.opts);
      expect(code).to.equal(t.code);
    });
  }
});

const genDynamicTypeImportTests: Array<{
  name?: string;
  opts?: Parameters<typeof genDynamicTypeImport>[2];
  code: string;
}> = [
  { code: 'typeof import("pkg")' },
  { name: "foo", code: 'typeof import("pkg").foo' },
  { name: "foo-bar", code: 'typeof import("pkg")["foo-bar"]' },
  { name: "default", code: 'typeof import("pkg").default' },
  { name: "1a", code: 'typeof import("pkg")["1a"]' },
  {
    name: "foo",
    opts: { comment: 'webpackChunkName: "chunks/dynamic"' },
    code: 'typeof import("pkg" /* webpackChunkName: "chunks/dynamic" */).foo',
  },
  {
    name: "foo",
    opts: { attributes: { type: "json" } },
    code: 'typeof import("pkg", { with: { type: "json" } }).foo',
  },
];

describe("genDynamicTypeImport", () => {
  for (const t of genDynamicTypeImportTests) {
    it(genTestTitle(t.code), () => {
      expect(genDynamicTypeImport("pkg", t.name, t.opts)).to.equal(t.code);
    });
  }
});

const genSafeVariableNameTests = [
  { key: "valid_import", code: "valid_import" },
  { key: "for", code: "_for" },
  { key: "with space", code: "with_32space" },
  { key: "123 numbers", code: "_123_32numbers" },
];

describe("genSafeVariableName", () => {
  for (const t of genSafeVariableNameTests) {
    it(genTestTitle(t.code), () => {
      const code = genSafeVariableName(t.key);
      expect(code).to.equal(t.code);
    });
  }
});
