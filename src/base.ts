import set from 'lodash.set';
import { defaultMapActionOptions } from './constants';
import { instantiate } from './metadata-explorer';
import {
  BaseOf,
  Constructible,
  ConvertUsingTransformOptions,
  CreateMapOptions,
  Dict,
  MapActionOptions,
  MapFromCallback,
  Mapping,
  MappingTransformation,
  MapWithTransformOptions,
  NamingConvention,
  Resolver,
  TransformationType,
  ValueSelector,
} from './types';
import {
  _assertMappingErrors,
  _get,
  _getMappingKey,
  _getSourcePropertyKey,
  _inheritBaseMapping,
  _initializeReversedMappingProperties,
  _isClass,
  _isDate,
  _isEmpty,
  _isObjectLike,
  _isResolver,
  _setMappingPropertyForMapFromMember,
} from './utils';

/**
 * Internal base class for AutoMapper
 *
 * @private
 */
export abstract class AutoMapperBase {
  protected readonly _mappings!: { [key: string]: Mapping };

  protected constructor() {
    this._mappings = {};
  }

  protected _mapArrayAsync<
    TSource extends Dict<TSource> = any,
    TDestination extends Dict<TDestination> = any
  >(
    sourceArray: TSource[],
    mapping: Mapping<TSource, TDestination>,
    option: MapActionOptions<
      TSource[],
      TDestination[]
    > = defaultMapActionOptions
  ): Promise<TDestination[]> {
    return Promise.resolve().then(() =>
      this._mapArray(sourceArray, mapping, option)
    );
  }

  protected _mapArray<
    TSource extends Dict<TSource> = any,
    TDestination extends Dict<TDestination> = any
  >(
    sourceArray: TSource[],
    mapping: Mapping<TSource, TDestination>,
    option: MapActionOptions<
      TSource[],
      TDestination[]
    > = defaultMapActionOptions
  ): TDestination[] {
    let destination: TDestination[] = [];
    const { beforeMap, afterMap } = option;

    if (beforeMap) {
      beforeMap(sourceArray, destination, { ...mapping } as any);
    }

    destination = sourceArray.map(s => this._map(s, mapping, {}, true));

    if (afterMap) {
      afterMap(sourceArray, destination, { ...mapping } as any);
    }

    return destination;
  }

  protected _mapAsync<
    TSource extends Dict<TSource> = any,
    TDestination extends Dict<TDestination> = any
  >(
    sourceObj: TSource,
    mapping: Mapping<TSource, TDestination>,
    option: MapActionOptions<TSource, TDestination> = defaultMapActionOptions,
    isArrayMap: boolean = false
  ): Promise<TDestination> {
    return Promise.resolve().then(() =>
      this._map(sourceObj, mapping, option, isArrayMap)
    );
  }

  protected _map<
    TSource extends Dict<TSource> = any,
    TDestination extends Dict<TDestination> = any
  >(
    sourceObj: TSource,
    mapping: Mapping<TSource, TDestination>,
    option: MapActionOptions<TSource, TDestination> = defaultMapActionOptions,
    isArrayMap: boolean = false
  ): TDestination {
    !(sourceObj instanceof mapping.source) &&
      (sourceObj = instantiate(mapping.source, sourceObj));
    const { afterMap, beforeMap } = option;
    const {
      destination,
      properties,
      afterMapAction,
      beforeMapAction,
      sourceMemberNamingConvention,
      destinationMemberNamingConvention,
    } = mapping;
    const configKeys = [];

    let destinationObj = instantiate(destination);

    if (!isArrayMap) {
      if (beforeMap) {
        beforeMap(sourceObj, destinationObj, { ...mapping });
      } else if (beforeMapAction) {
        beforeMapAction(sourceObj, destinationObj, { ...mapping });
      }
    }

    const props = Array.from(properties.values());
    for (let i = 0, len = props.length; i < len; i++) {
      const { transformation, destinationMemberPath } = props[i];
      configKeys.push(destinationMemberPath);
      const propSourceMemberPath = _getSourcePropertyKey(
        destinationMemberNamingConvention,
        sourceMemberNamingConvention,
        destinationMemberPath
      );

      if (
        transformation.transformationType.preCondition &&
        !transformation.transformationType.preCondition.predicate(sourceObj)
      ) {
        set(
          destinationObj,
          destinationMemberPath,
          transformation.transformationType.preCondition.defaultValue || null
        );
        continue;
      }

      this._mapMember(
        destinationObj,
        destinationMemberPath,
        sourceObj,
        propSourceMemberPath,
        mapping,
        transformation
      );
    }

    _assertMappingErrors(destinationObj, configKeys);

    if (!isArrayMap) {
      if (afterMap) {
        afterMap(sourceObj, destinationObj, { ...mapping });
      } else if (afterMapAction) {
        afterMapAction(sourceObj, destinationObj, { ...mapping });
      }
    }

    return destinationObj;
  }

  private _mapMember<
    TSource extends Dict<TSource> = any,
    TDestination extends Dict<TDestination> = any
  >(
    destinationObj: TDestination,
    destinationMemberPath: string,
    sourceObj: TSource,
    propSourceMemberPath: string,
    mapping: Mapping<TSource, TDestination>,
    transformation: MappingTransformation<TSource, TDestination>
  ) {
    const {
      transformationType: { type },
      mapFrom,
      fromValue,
      convertUsing,
      mapWith,
      condition,
      nullSubstitution,
    } = transformation;

    if (type === TransformationType.Ignore) {
      set(destinationObj, destinationMemberPath, null);
      return;
    }

    if (type === TransformationType.ConvertUsing) {
      const { converter, value } = convertUsing as ConvertUsingTransformOptions;
      set(
        destinationObj,
        destinationMemberPath,
        converter.convert(value(sourceObj))
      );
      return;
    }

    if (type === TransformationType.MapWith) {
      const _source = mapWith?.fromValue(sourceObj);

      if (_isEmpty(_source)) {
        console.warn(`${propSourceMemberPath} does not exist`);
        set(destinationObj, destinationMemberPath, null);
        return;
      }

      if (!_isClass(_source)) {
        console.warn(
          `${destinationMemberPath} is type ${mapWith?.destination.name} but ${_source} is a primitive. No mapping was executed`
        );
        set(destinationObj, destinationMemberPath, null);
        return;
      }

      const _mapping = this._getMappingForDestination(
        (mapWith as MapWithTransformOptions).destination,
        _source
      );

      if (Array.isArray(_source)) {
        set(
          destinationObj,
          destinationMemberPath,
          _isEmpty(_source[0])
            ? []
            : this._mapArray(_source, _mapping as Mapping)
        );
        return;
      }

      set(destinationObj, destinationMemberPath, this._map(_source, _mapping));
      return;
    }

    if (type === TransformationType.FromValue) {
      set(destinationObj, destinationMemberPath, fromValue);
      return;
    }

    if (type === TransformationType.Condition) {
      if (condition && condition.predicate(sourceObj)) {
        set(
          destinationObj,
          destinationMemberPath,
          _get(sourceObj, null, propSourceMemberPath)
        );
        return;
      }

      set(
        destinationObj,
        destinationMemberPath,
        condition?.defaultValue || null
      );
      return;
    }

    if (type === TransformationType.NullSubstituion) {
      set(
        destinationObj,
        destinationMemberPath,
        _get(sourceObj, nullSubstitution, propSourceMemberPath)
      );
      return;
    }

    if (type === TransformationType.MapFrom) {
      if (_isResolver(mapFrom as MapFromCallback)) {
        set(
          destinationObj,
          destinationMemberPath,
          (mapFrom as Resolver).resolve(
            sourceObj,
            destinationObj,
            transformation
          )
        );
        return;
      }

      const mapFromValue = (mapFrom as ValueSelector)(sourceObj);
      set(destinationObj, destinationMemberPath, mapFromValue);
      _setMappingPropertyForMapFromMember(
        destinationMemberPath,
        propSourceMemberPath,
        mapping,
        mapFrom as ValueSelector
      );
      return;
    }

    const sourceVal = (mapFrom as ValueSelector)(sourceObj);
    if (sourceVal === undefined || sourceVal === null) {
      set(destinationObj, destinationMemberPath, null);
      return;
    }

    if (_isObjectLike(sourceVal)) {
      if (_isDate(sourceVal)) {
        set(destinationObj, destinationMemberPath, new Date(sourceVal));
        return;
      }

      if (Array.isArray(sourceVal)) {
        const _first = sourceVal[0];
        if (_isEmpty(_first)) {
          set(destinationObj, destinationMemberPath, []);
          return;
        }

        if (!_isObjectLike(_first)) {
          set(destinationObj, destinationMemberPath, sourceVal.slice());
          return;
        }

        const nestedMapping = this._getMappingForNestedKey(_first);
        set(
          destinationObj,
          destinationMemberPath,
          this._mapArray(sourceVal, nestedMapping)
        );
        return;
      }
    }

    if (
      (typeof sourceVal === 'object' || typeof sourceVal === 'function') &&
      _isClass(sourceVal)
    ) {
      const nestedMapping = this._getMappingForNestedKey(sourceVal);
      set(
        destinationObj,
        destinationMemberPath,
        this._map(sourceVal, nestedMapping)
      );
      return;
    }

    set(destinationObj, destinationMemberPath, sourceVal);
    return;
  }

  protected _createMappingObject<
    TSource extends Dict<TSource> = any,
    TDestination extends Dict<TDestination> = any,
    TBaseSource extends BaseOf<TSource, TBaseSource> = any,
    TBaseDestination extends BaseOf<TDestination, TBaseDestination> = any
  >(
    source: Constructible<TSource>,
    destination: Constructible<TDestination>,
    options: CreateMapOptions
  ): Mapping<TSource, TDestination, TBaseSource, TBaseDestination> {
    const _key = this._hasMapping(source, destination);
    const _mapping: Mapping<
      TSource,
      TDestination,
      TBaseSource,
      TBaseDestination
    > = Object.seal({
      source,
      sourceKey: source.prototype.constructor.name,
      destination,
      destinationKey: destination.prototype.constructor.name,
      properties: new Map(),
      sourceMemberNamingConvention: options.sourceMemberNamingConvention as NamingConvention,
      destinationMemberNamingConvention: options.destinationMemberNamingConvention as NamingConvention,
      beforeMapAction: undefined,
      afterMapAction: undefined,
      baseSource: undefined,
      baseDestination: undefined,
    });

    this._mappings[_key] = _mapping;
    return _mapping;
  }

  protected _createReversedMappingObject<
    TSource extends Dict<TSource> = any,
    TDestination extends Dict<TDestination> = any,
    TBaseSource extends BaseOf<TSource, TBaseSource> = any,
    TBaseDestination extends BaseOf<TDestination, TBaseDestination> = any
  >(
    mapping: Mapping<TSource, TDestination, TBaseSource, TBaseDestination>
  ): Mapping<TDestination, TSource, TBaseDestination, TBaseSource> {
    const _reversedKey = this._hasMapping(mapping.destination, mapping.source);
    const _reversedMapping: Mapping<
      TDestination,
      TSource,
      TBaseDestination,
      TBaseSource
    > = Object.seal({
      source: mapping.destination,
      sourceKey: mapping.destination.prototype
        ? mapping.destination.prototype.constructor.name
        : mapping.destination.constructor.name,
      destination: mapping.source,
      destinationKey: mapping.source.prototype
        ? mapping.source.prototype.constructor.name
        : mapping.source.constructor.name,
      sourceMemberNamingConvention: mapping.destinationMemberNamingConvention,
      destinationMemberNamingConvention: mapping.sourceMemberNamingConvention,
      properties: _initializeReversedMappingProperties(mapping),
      beforeMapAction: undefined,
      afterMapAction: undefined,
      baseSource: mapping.baseDestination,
      baseDestination: mapping.baseSource,
    });

    if (
      _reversedMapping.baseSource != null &&
      _reversedMapping.baseDestination != null
    ) {
      const reversedBaseMapping = this._getMappingForDestination(
        _reversedMapping.baseDestination,
        _reversedMapping.baseSource,
        true
      );
      if (reversedBaseMapping != null) {
        _inheritBaseMapping(_reversedMapping, reversedBaseMapping);
      }
    }

    this._mappings[_reversedKey] = _reversedMapping;
    return _reversedMapping;
  }

  protected _dispose() {
    Object.keys(this._mappings).forEach(key => {
      delete this._mappings[key];
    });
  }

  protected _getMappingForDestination<
    TSource extends Dict<TSource> = any,
    TDestination extends Dict<TDestination> = any
  >(
    destination: Constructible<TDestination>,
    sourceObj: TSource | Constructible<TSource>,
    isInherit: boolean = false
  ): Mapping<TSource, TDestination> {
    const destinationName = destination.prototype.constructor.name;
    const sourceName = _isClass(sourceObj)
      ? (sourceObj as any).prototype
        ? (sourceObj as any).prototype.constructor.name
        : sourceObj.constructor.name
      : (sourceObj as Constructible<TSource>).prototype.constructor.name;

    const mapping = this._mappings[_getMappingKey(sourceName, destinationName)];

    if (!mapping && !isInherit) {
      throw new Error(
        `Mapping not found for source ${sourceName} and destination ${destinationName}`
      );
    }

    return mapping;
  }

  /**
   * Private Functions
   */

  private _hasMapping<
    TSource extends Dict<TSource> = any,
    TDestination extends Dict<TDestination> = any
  >(
    source: Constructible<TSource>,
    destination: Constructible<TDestination>
  ): string {
    const key = _getMappingKey(source.name, destination.name);
    if (this._mappings[key]) {
      throw new Error(
        `Mapping for source ${source.name} and destination ${destination.name} is already existed`
      );
    }

    return key;
  }

  private _getMapping<
    TSource extends Dict<TSource> = any,
    TDestination extends Dict<TDestination> = any
  >(
    source: Constructible<TSource>,
    destination: Constructible<TDestination>
  ): Mapping<TSource, TDestination> {
    const sourceName = source.prototype
      ? source.prototype.constructor.name
      : source.constructor.name;
    const destinationName = destination.prototype
      ? destination.prototype.constructor.name
      : destination.constructor.name;
    const mapping = this._mappings[_getMappingKey(sourceName, destinationName)];

    if (!mapping) {
      throw new Error(
        `Mapping not found for source ${sourceName} and destination ${destinationName}`
      );
    }

    return mapping;
  }

  private _getMappingForNestedKey<
    TSource extends Dict<TSource> = any,
    TDestination extends Dict<TDestination> = any
  >(val: Constructible<TSource>): Mapping<TSource, TDestination> {
    const mappingName = val.constructor.name;
    const destinationEntry = Object.entries(this._mappings)
      .filter(([key, _]) => key.includes(mappingName))
      .find(([key, _]) => this._mappings[key].sourceKey === mappingName);

    if (!destinationEntry) {
      throw new Error(`Mapping not found for source ${mappingName}`);
    }

    const destination = destinationEntry[1].destination as Constructible<
      TDestination
    >;

    if (!destination) {
      throw new Error(`Mapping not found for source ${mappingName}`);
    }

    const mapping = this._getMapping(val, destination);

    if (!mapping) {
      throw new Error(
        `Mapping not found for source ${mappingName} and destination ${destination.name ||
          destination.constructor.name}`
      );
    }

    return mapping;
  }
}
