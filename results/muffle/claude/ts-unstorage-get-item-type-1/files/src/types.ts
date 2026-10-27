export type StorageValue = null | string | number | boolean | object;
export type WatchEvent = "update" | "remove";
export type WatchCallback = (event: WatchEvent, key: string) => any;

type MaybePromise<T> = T | Promise<T>;

type MaybeDefined<T> = T extends any ? T : any;

export type Unwatch = () => MaybePromise<void>;

export interface StorageMeta {
  atime?: Date;
  mtime?: Date;
  ttl?: number;
  [key: string]: StorageValue | Date | undefined;
}

// TODO: type ttl
export type TransactionOptions = Record<string, any>;

export type GetKeysOptions = TransactionOptions & {
  maxDepth?: number;
};

export type JSONValue = null | string | number | boolean | JSONObject | JSONArray;
export interface JSONObject {
  [key: string]: JSONValue;
}
export interface JSONArray extends Array<JSONValue> {}

/** Formats a stored value can be read in with the `type` option. */
export interface GetItemTypeMap {
  text: string;
  json: JSONValue;
  bytes: Uint8Array;
  blob: Blob;
  stream: ReadableStream<Uint8Array>;
}

export type GetItemType = keyof GetItemTypeMap;

/** Options of `getItem()`. `type` is reserved and not forwarded to the driver. */
export type GetItemOptions<Ty extends GetItemType = GetItemType> = TransactionOptions & {
  type?: Ty;
};

/** Options of reads without a `type`. */
type UntypedGetOptions = TransactionOptions & { type?: undefined };

/** An entry of `getItems()`: a key or a key with per-item options. */
export type GetItemsInput = string | { key: string; options?: GetItemOptions };

type GetItemsEntryType<I, C> = I extends { options: { type: infer Ty extends GetItemType } }
  ? Ty
  : C extends { type: infer Ty extends GetItemType }
    ? Ty
    : undefined;

type GetItemsValue<I, C, T> =
  GetItemsEntryType<I, C> extends infer Ty
    ? Ty extends GetItemType
      ? GetItemTypeMap[Ty] | null
      : T
    : never;

export interface DriverFlags {
  maxDepth?: boolean;
  ttl?: boolean;
}

export interface DriverDependency {
  /**
   * Name of the npm package to install.
   *
   * Can differ from the import specifier used by the driver (e.g. `uploadthing` for `uploadthing/server`).
   */
  name: string;

  /**
   * Import specifier the driver uses, when it differs from `name` (e.g. `uploadthing/server`).
   *
   * Defaults to `name` when not set.
   */
  import?: string;

  /**
   * Supported version range of the package.
   */
  version: string;

  /**
   * The dependency is only needed for some driver features or configurations.
   */
  optional?: boolean;
}

/**
 * Third-party packages a driver dynamically imports, keyed by the driver option
 * that can be used to provide them (usually `lib`).
 *
 * Drivers expose this as a `DRIVER_DEPENDENCIES` export so that consumer frameworks
 * can check or install what a configured driver needs.
 */
export type DriverDependencies = Record<string, DriverDependency>;

export interface Driver<OptionsT = any, InstanceT = any> {
  name?: string;
  flags?: DriverFlags;
  options?: OptionsT;
  getInstance?: () => InstanceT;
  hasItem: (key: string, opts: TransactionOptions) => MaybePromise<boolean>;
  getItem: (key: string, opts?: TransactionOptions) => MaybePromise<StorageValue>;
  /** @experimental */
  getItems?: (
    items: { key: string; options?: TransactionOptions }[],
    commonOptions?: TransactionOptions,
  ) => MaybePromise<{ key: string; value: StorageValue }[]>;
  /** @experimental */
  getItemRaw?: (key: string, opts: TransactionOptions) => MaybePromise<unknown>;
  setItem?: (key: string, value: string, opts: TransactionOptions) => MaybePromise<void>;
  /** @experimental */
  setItems?: (
    items: { key: string; value: string; options?: TransactionOptions }[],
    commonOptions?: TransactionOptions,
  ) => MaybePromise<void>;
  /** @experimental */
  setItemRaw?: (key: string, value: any, opts: TransactionOptions) => MaybePromise<void>;
  removeItem?: (key: string, opts: TransactionOptions) => MaybePromise<void>;
  getMeta?: (key: string, opts: TransactionOptions) => MaybePromise<StorageMeta | null>;
  getKeys: (base: string, opts: GetKeysOptions) => MaybePromise<string[]>;
  clear?: (base: string, opts: TransactionOptions) => MaybePromise<void>;
  dispose?: () => MaybePromise<void>;
  watch?: (callback: WatchCallback) => MaybePromise<Unwatch>;
}

type StorageDefinition = {
  items: unknown;
  [key: string]: unknown;
};

type StorageItemMap<T> = T extends StorageDefinition ? T["items"] : T;
type StorageItemType<T, K> = K extends keyof StorageItemMap<T>
  ? StorageItemMap<T>[K]
  : T extends StorageDefinition
    ? StorageValue
    : T;

export interface Storage<T extends StorageValue = StorageValue> {
  // Item
  hasItem<U extends Extract<T, StorageDefinition>, K extends keyof StorageItemMap<U>>(
    key: K,
    opts?: TransactionOptions,
  ): Promise<boolean>;
  hasItem(key: string, opts?: TransactionOptions): Promise<boolean>;

  getItem<Ty extends GetItemType>(
    key: string,
    opts: TransactionOptions & { type: Ty },
  ): Promise<GetItemTypeMap[Ty] | null>;
  getItem<U extends Extract<T, StorageDefinition>, K extends string & keyof StorageItemMap<U>>(
    key: K,
    ops?: UntypedGetOptions,
  ): Promise<StorageItemType<T, K> | null>;
  getItem<R = StorageItemType<T, string>>(key: string, opts?: UntypedGetOptions): Promise<R | null>;
  getItem(
    key: string,
    opts: GetItemOptions,
  ): Promise<GetItemTypeMap[GetItemType] | StorageItemType<T, string> | null>;

  /** @experimental */
  getItems<const Items extends readonly GetItemsInput[], C extends GetItemOptions = {}>(
    items: Items,
    commonOptions?: C,
  ): Promise<{ key: string; value: GetItemsValue<Items[number], C, T> }[]>;
  getItems<U extends T>(
    items: (string | { key: string; options?: UntypedGetOptions })[],
    commonOptions?: UntypedGetOptions,
  ): Promise<{ key: string; value: U }[]>;
  /** @experimental See https://github.com/unjs/unstorage/issues/142 */
  getItemRaw: <T = any>(key: string, opts?: TransactionOptions) => Promise<MaybeDefined<T> | null>;

  setItem<U extends Extract<T, StorageDefinition>, K extends keyof StorageItemMap<U>>(
    key: K,
    value: StorageItemType<T, K>,
    opts?: TransactionOptions,
  ): Promise<void>;
  setItem<U extends T>(key: string, value: U, opts?: TransactionOptions): Promise<void>;

  /** @experimental */
  setItems: <U extends T>(
    items: { key: string; value: U; options?: TransactionOptions }[],
    commonOptions?: TransactionOptions,
  ) => Promise<void>;
  /** @experimental See https://github.com/unjs/unstorage/issues/142 */
  setItemRaw: <T = any>(
    key: string,
    value: MaybeDefined<T>,
    opts?: TransactionOptions,
  ) => Promise<void>;

  removeItem<U extends Extract<T, StorageDefinition>, K extends keyof StorageItemMap<U>>(
    key: K,
    opts?: (TransactionOptions & { removeMeta?: boolean }) | boolean /* legacy: removeMeta */,
  ): Promise<void>;
  removeItem(
    key: string,
    opts?: (TransactionOptions & { removeMeta?: boolean }) | boolean /* legacy: removeMeta */,
  ): Promise<void>;

  // Meta
  getMeta: (
    key: string,
    opts?: (TransactionOptions & { nativeOnly?: boolean }) | boolean /* legacy: nativeOnly */,
  ) => MaybePromise<StorageMeta>;
  setMeta: (key: string, value: StorageMeta, opts?: TransactionOptions) => Promise<void>;
  removeMeta: (key: string, opts?: TransactionOptions) => Promise<void>;
  // Keys
  getKeys: (base?: string, opts?: GetKeysOptions) => Promise<string[]>;
  // Utils
  clear: (base?: string, opts?: TransactionOptions) => Promise<void>;
  dispose: () => Promise<void>;
  watch: (callback: WatchCallback) => Promise<Unwatch>;
  unwatch: () => Promise<void>;
  // Mount
  mount: (base: string, driver: Driver) => Storage;
  unmount: (base: string, dispose?: boolean) => Promise<void>;
  getMount: (key?: string) => { base: string; driver: Driver };
  getMounts: (base?: string, options?: { parents?: boolean }) => { base: string; driver: Driver }[];
  // Aliases
  keys: Storage["getKeys"];
  get: Storage<T>["getItem"];
  set: Storage<T>["setItem"];
  has: Storage<T>["hasItem"];
  del: Storage<T>["removeItem"];
  remove: Storage<T>["removeItem"];
}
