import { AutoMapper } from './automapper';

type Unpacked<T> = T extends (infer U)[]
  ? U
  : T extends (...args: any[]) => infer U
  ? U
  : T extends Promise<infer U>
  ? U
  : T;

type TypeOrReturnType<T, U> = U extends undefined
  ? T
  : U extends null
  ? T
  : U extends never
  ? T
  : U extends (...args: any) => infer R
  ? R
  : T;

type SelectorReturn<TSource> = ReturnType<Selector<TSource>>;

export type Dict<T> = { [key in keyof T]?: any };

export interface Converter<TConvertSource, TConvertDestination> {
  convert(source: TConvertSource): TConvertDestination;
}

export interface Resolver<
  TSource extends Dict<TSource> = any,
  TDestination extends Dict<TDestination> = any,
  TReturnType = SelectorReturn<TDestination>
> {
  resolve(
    source: TSource,
    destination: TDestination,
    transformation: MappingTransformation<TSource, TDestination, TReturnType>
  ): TReturnType;
}

export interface MappingProfile {
  profileName: string;
}

export interface NamingConvention {
  splittingExpression: RegExp;
  separatorCharacter: string;
  transformPropertyName: (sourcePropNameParts: string[]) => string;
}

export interface CreateMapOptions<
  TSource extends Dict<TSource> = any,
  TDestination extends Dict<TDestination> = any,
  TBaseSource extends BaseOf<TSource, TBaseSource> = any,
  TBaseDestination extends BaseOf<TDestination, TBaseDestination> = any
> {
  sourceMemberNamingConvention?: NamingConvention;
  destinationMemberNamingConvention?: NamingConvention;
  includeBase?: [Constructible<TBaseSource>, Constructible<TBaseDestination>];
}

export interface MapActionOptions<
  TSource extends Dict<TSource> = any,
  TDestination extends Dict<TDestination> = any
> {
  beforeMap?: BeforeAfterMapAction<TSource, TDestination>;
  afterMap?: BeforeAfterMapAction<TSource, TDestination>;
}

export enum TransformationType {
  /**
   * when `opts.ignore()` is used on `forMember()`
   */
  Ignore = 0,
  /**
   * when `opts.mapFrom()` is used on `forMember()`
   */
  MapFrom = 1,
  /**
   * when `opts.condition()` is used on `forMember()`
   */
  Condition = 2,
  /**
   * when `opts.fromValue()` is used on `forMember()`
   */
  FromValue = 3,
  /**
   * when `opts.mapWith()` is used on `forMember()`
   */
  MapWith = 4,
  /**
   * when `opts.convertUsing()` is used on `forMember()`
   */
  ConvertUsing = 5,
  /**
   * when Mapping is initialized
   */
  MapInitialize = 6,
  /**
   * When `opts.nullSubstitution()` is used on `forMember()`
   */
  NullSubstituion = 7,
}

export interface Constructible<T extends Dict<T> = any> {
  new (...args: any[]): T;

  __NARTC_AUTOMAPPER_METADATA_FACTORY?: () => Dict<T>;
}

export type BaseOf<T extends Dict<T> = any, TBase = any> = [T] extends [TBase]
  ? unknown
  : never;

export interface ConditionPredicate<TSource extends Dict<TSource> = any> {
  (source: TSource): boolean;
}

export interface ConditionTransformation<
  TSource extends Dict<TSource> = any,
  TReturnType = any
> {
  predicate: ConditionPredicate<TSource>;
  defaultValue?: TReturnType;
}

export interface Selector<
  TSource extends Dict<TSource> = any,
  TReturnType = any
> {
  (source: TSource): TReturnType;
}

export interface ValueSelector<
  TSource extends Dict<TSource> = any,
  TDestination extends Dict<TDestination> = any,
  TReturnType = SelectorReturn<TDestination>
> {
  (source: TSource): TReturnType;
}

export type MapFromCallback<
  TSource extends Dict<TSource> = any,
  TDestination extends Dict<TDestination> = any,
  TSelectorReturn = SelectorReturn<TDestination>
> =
  | ValueSelector<TSource, TDestination, TSelectorReturn>
  | Resolver<TSource, TDestination, TSelectorReturn>;

export interface DestinationMemberExpressionOptions<
  TSource extends Dict<TSource> = any,
  TDestination extends Dict<TDestination> = any,
  TSelectorReturn = SelectorReturn<TDestination>
> {
  preCondition(
    predicate: ConditionPredicate<TSource>,
    defaultValue?: TSelectorReturn
  ): DestinationMemberExpressionOptions<TSource, TDestination, TSelectorReturn>;

  mapFrom(cb: MapFromCallback<TSource, TDestination, TSelectorReturn>): void;

  mapWith(
    destination: Constructible<Unpacked<TSelectorReturn>>,
    fromValue: ValueSelector<TSource>
  ): void;

  condition(
    predicate: ConditionPredicate<TSource>,
    defaultValue?: TSelectorReturn
  ): void;

  fromValue(value: TSelectorReturn): void;

  convertUsing<TConvertSource = TSource>(
    converter: Converter<TConvertSource, TSelectorReturn>,
    value: Selector<TSource, TConvertSource>
  ): void;

  nullSubstitution(value: TSelectorReturn): void;

  ignore(): void;
}

export interface ForMemberExpression<
  TSource extends Dict<TSource> = any,
  TDestination extends Dict<TDestination> = any,
  TSelectorReturn = any
> {
  (
    opts: DestinationMemberExpressionOptions<
      TSource,
      TDestination,
      TSelectorReturn
    >
  ): void;
}

export interface BeforeAfterMapAction<
  TSource extends Dict<TSource> = any,
  TDestination extends Dict<TDestination> = any
> {
  (
    source: TSource,
    destination: TDestination,
    mapping?: Mapping<TSource, TDestination>
  ): void;
}

export interface CreateMapFluentFunctions<
  TSource extends Dict<TSource> = any,
  TDestination extends Dict<TDestination> = any,
  TBaseSource extends BaseOf<TSource, TBaseSource> = any,
  TBaseDestination extends BaseOf<TDestination, TBaseDestination> = any
> {
  forMember<TMemberType = SelectorReturn<TDestination>>(
    selector: Selector<TDestination, TMemberType>,
    expression: ForMemberExpression<TSource, TDestination, TMemberType>
  ): CreateMapFluentFunctions<
    TSource,
    TDestination,
    TBaseSource,
    TBaseDestination
  >;

  beforeMap(
    action: BeforeAfterMapAction<TSource, TDestination>
  ): CreateMapFluentFunctions<
    TSource,
    TDestination,
    TBaseSource,
    TBaseDestination
  >;

  afterMap(
    action: BeforeAfterMapAction<TSource, TDestination>
  ): CreateMapFluentFunctions<
    TSource,
    TDestination,
    TBaseSource,
    TBaseDestination
  >;

  reverseMap(): CreateReversedMapFluentFunctions<TDestination, TSource>;
}

export interface CreateReversedMapFluentFunctions<
  TSource extends Dict<TSource> = any,
  TDestination extends Dict<TDestination> = any
> {
  forPath<TMemberType = SelectorReturn<TDestination>>(
    selector: Selector<TDestination, TMemberType>,
    expression: ForMemberExpression<TSource, TDestination, TMemberType>
  ): CreateReversedMapFluentFunctions<TSource, TDestination>;

  beforeMap(
    action: BeforeAfterMapAction<TSource, TDestination>
  ): CreateReversedMapFluentFunctions<TSource, TDestination>;

  afterMap(
    action: BeforeAfterMapAction<TSource, TDestination>
  ): CreateReversedMapFluentFunctions<TSource, TDestination>;
}

export interface AutoMapperGlobalSettings {
  sourceNamingConvention?: Constructible<NamingConvention>;
  destinationNamingConvention?: Constructible<NamingConvention>;
}

export interface AutoMapperConfiguration {
  withGlobalSettings(settings: AutoMapperGlobalSettings): void;

  addProfile(profile: new (mapper: AutoMapper) => MappingProfile): AutoMapper;

  createMap<
    TSource extends Dict<TSource> = any,
    TDestination extends Dict<TDestination> = any,
    TBaseSource extends BaseOf<TSource, TBaseSource> = any,
    TBaseDestination extends BaseOf<TDestination, TBaseDestination> = any
  >(
    source: Constructible<TSource>,
    destination: Constructible<TDestination>
  ): CreateMapFluentFunctions<
    TSource,
    TDestination,
    TBaseSource,
    TBaseDestination
  >;
}

export interface MapWithTransformOptions<
  TSource extends Dict<TSource> = any,
  TDestination extends Dict<TDestination> = any,
  TSelectorReturn = SelectorReturn<TDestination>
> {
  destination: Constructible<Unpacked<TSelectorReturn>>;
  fromValue: ValueSelector<TSource>;
}

export interface ConvertUsingTransformOptions<
  TSource extends Dict<TSource> = any,
  TDestination extends Dict<TDestination> = any,
  TSelectorReturn = SelectorReturn<TDestination>
> {
  converter: Converter<
    TypeOrReturnType<TSource, ConvertUsingTransformOptions['value']>,
    TSelectorReturn
  >;
  value: Selector<TSource, TSelectorReturn>;
}

export interface MappingTransformationType<
  TSource extends Dict<TSource> = any,
  TReturnType = any
> {
  type: TransformationType;
  preCondition: ConditionTransformation<TSource, TReturnType> | null;
}

export interface MappingTransformation<
  TSource extends Dict<TSource> = any,
  TDestination extends Dict<TDestination> = any,
  TSelectorReturn = SelectorReturn<TDestination>
> {
  transformationType: MappingTransformationType<TSource, TSelectorReturn>;
  mapFrom?: MapFromCallback<TSource, TDestination, TSelectorReturn>;
  mapWith?: MapWithTransformOptions<TSource, TDestination, TSelectorReturn>;
  condition?: ConditionTransformation<TSource, TSelectorReturn>;
  fromValue?: TSelectorReturn;
  convertUsing?: ConvertUsingTransformOptions<
    TSource,
    TDestination,
    TSelectorReturn
  >;
  nullSubstitution?: TSelectorReturn;
}

export interface MappingProperty<
  TSource extends Dict<TSource> = any,
  TDestination extends Dict<TDestination> = any,
  TSelector extends Selector<TDestination> = Selector<TDestination>
> {
  destinationMemberPath: string;
  destinationMemberSelector: TSelector;
  transformation: MappingTransformation<
    TSource,
    TDestination,
    ReturnType<TSelector>
  >;
  sourceMemberPath?: string;
  transformedValue?: ReturnType<TSelector>;
}

export interface Mapping<
  TSource extends Dict<TSource> = any,
  TDestination extends Dict<TDestination> = any,
  TBaseSource extends BaseOf<TSource, TBaseSource> = any,
  TBaseDestination extends BaseOf<TDestination, TBaseDestination> = any
> {
  source: Constructible<TSource>;
  sourceKey: string;
  destination: Constructible<TDestination>;
  destinationKey: string;
  properties: Map<
    string,
    MappingProperty<TSource, TDestination, Selector<TDestination>>
  >;
  sourceMemberNamingConvention: NamingConvention;
  destinationMemberNamingConvention: NamingConvention;
  beforeMapAction?: BeforeAfterMapAction<TSource, TDestination>;
  afterMapAction?: BeforeAfterMapAction<TSource, TDestination>;
  baseSource?: Constructible<TBaseSource>;
  baseDestination?: Constructible<TBaseDestination>;
}

export type MetadataFunction = () => false | [] | Constructible;
export type MetadataMap<
  TModel extends Dict<TModel> = any,
  TKey extends keyof TModel = any
> = [TKey, MetadataFunction];
export type MetadataMapList<TModel extends Dict<TModel> = any> = Array<
  MetadataMap<TModel>
>;
