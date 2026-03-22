import * as assert from 'assert';
import {
    compress,
    compressObject,
    compressedPath,
    compressQuerySelector,
    compressQuery,
    MangoQuery
} from '../../src/index';
import {
    getDefaultCompressionTable,
    getDefaultObject
} from './test-util';

describe('compress.test.ts', () => {
    describe('.compress()', () => {
        it('should return an object with compressedSchema and compressionMap', () => {
            const table = getDefaultCompressionTable();
            const result = compress(table, getDefaultObject());
            assert.ok(result.compressedSchema);
            assert.ok(result.compressionMap);
            assert.strictEqual(typeof result.compressionMap, 'object');
        });
        it('compressedSchema should match compressObject output', () => {
            const table = getDefaultCompressionTable();
            const obj = getDefaultObject();
            const result = compress(table, obj);
            const directCompressed = compressObject(table, obj);
            assert.deepStrictEqual(result.compressedSchema, directCompressed);
        });
        it('compressionMap should contain mappings from original to compressed keys', () => {
            const table = getDefaultCompressionTable();
            const result = compress(table, getDefaultObject());
            // 'active' should be mapped to '|a' based on the compression table
            assert.ok(result.compressionMap['active']);
            assert.strictEqual(result.compressionMap['active'], '|a');
        });
        it('compressionMap should have all compressed keys from the table', () => {
            const table = getDefaultCompressionTable();
            const result = compress(table, getDefaultObject());
            // All keys in the compression table should be in the compressionMap
            table.compressedToUncompressed.forEach((compressedKey, originalKey) => {
                assert.ok(result.compressionMap[originalKey], `Missing key: ${originalKey}`);
                assert.strictEqual(
                    result.compressionMap[originalKey],
                    table.compressionFlag + compressedKey
                );
            });
        });
    });
    describe('.compressObject()', () => {
        it('should not throw', () => {
            const compressed = compressObject(
                getDefaultCompressionTable(),
                getDefaultObject()
            );
            assert.ok(compressed);
        });
        it('should have a compressed attribute', () => {
            const table = getDefaultCompressionTable();
            const compressed = compressObject(
                table,
                getDefaultObject()
            );
            assert.ok(
                Object.keys(compressed).
                    find(key => key.startsWith(table.compressionFlag))
            );
        });
        it('should not have compressed the attribute thats in not in the schema', () => {
            const compressed = compressObject(
                getDefaultCompressionTable(),
                getDefaultObject()
            );
            assert.ok((compressed as any)['notInSchema']);
        });
        it('should not have compressed the attribute that is too short', () => {
            const compressed = compressObject(
                getDefaultCompressionTable(),
                getDefaultObject()
            );
            assert.ok((compressed as any)['id']);
        });
        it('should throw when the object contains an attribute that starts with the compression-flag', () => {
            const table = getDefaultCompressionTable();
            const obj = getDefaultObject();
            (obj as any)[table.compressionFlag + 'foo'] = 'bar';
            assert.throws(
                () => compressObject(
                    table,
                    obj
                )
            );
        });
    });
    describe('.compressedPath()', () => {
        it('should not throw', () => {
            const compressed = compressedPath(
                getDefaultCompressionTable(),
                'nestedObject.nestedAttribute'
            );
            assert.ok(compressed.length > 3);
        });
        it('should only contain compressed keys', () => {
            const table = getDefaultCompressionTable();
            const compressed = compressedPath(
                table,
                'nestedObject.nestedAttribute'
            );
            const split = compressed.split('.');
            split.forEach(
                k => assert.ok(
                    k.startsWith(
                        table.compressionFlag
                    )
                )
            );
        });
        it('should not loose keys', () => {
            const table = getDefaultCompressionTable();
            const compressed = compressedPath(
                table,
                'nestedObject.nestedAttribute.deepNestedAttribute'
            );
            const split = compressed.split('.');
            assert.equal(split.length, 3);
        });
        it('should not have compressed the attribute thats in not in the schema', () => {
            const compressed = compressedPath(
                getDefaultCompressionTable(),
                'notInSchema.deepNestedAttribute'
            );
            assert.ok(compressed.startsWith('notInSchema.'));
        });
        it('should throw when the object contains an attribute that starts with the compression-flag', () => {
            const table = getDefaultCompressionTable();
            assert.throws(
                () => compressedPath(
                    table,
                    'nestedObject.|foobar'
                )
            );
        });
        it('should be able to compress array-paths', () => {
            const table = getDefaultCompressionTable();
            const compressed = compressedPath(
                table,
                'objectArray[1].deepNested'
            );
            assert.ok(compressed.includes('[1]'));
            assert.ok(compressed.startsWith(table.compressionFlag));
        });
    });
    describe('.compressQuerySelector()', () => {
        it('should compress the selector', () => {
            const selector = {
                'active': {
                    $eq: true
                }
            };
            const table = getDefaultCompressionTable();
            const compressed = compressQuerySelector(
                table,
                selector
            );
            assert.deepEqual(
                compressed,
                { '|a': { $eq: true } }
            );
        });
        it('deeper nested', () => {
            const selector = {
                $and: [
                    {
                        active: true
                    },
                    {
                        'nestedObject.nestedAttribute': {
                            $ne: 'foobar'
                        }
                    }
                ]
            };
            const table = getDefaultCompressionTable();
            const compressed = compressQuerySelector(
                table,
                selector
            );
            assert.deepEqual(
                compressed,
                {
                    $and: [
                        {
                            '|a': true
                        },
                        {
                            '|g.|f': {
                                $ne: 'foobar'
                            }
                        }
                    ]
                }
            );
        });
    });
    describe('.compressQuery()', () => {
        it('should compress all attributes', () => {
            const query: MangoQuery = {
                selector: {
                    $and: [
                        {
                            active: true
                        },
                        {
                            'nestedObject.nestedAttribute': {
                                $ne: 'foobar'
                            }
                        }
                    ]
                },
                skip: 1,
                limit: 1,
                fields: [
                    'id',
                    'name'
                ],
                sort: [
                    'name',
                    '-active'
                ]
            };

            const table = getDefaultCompressionTable();
            const compressed = compressQuery(
                table,
                query
            );
            assert.deepEqual(
                compressed,
                {
                    selector: {
                        $and: [
                            {
                                '|a': true
                            },
                            {
                                '|g.|f': {
                                    $ne: 'foobar'
                                }
                            }
                        ]
                    },
                    skip: 1,
                    limit: 1,
                    fields: [
                        'id',
                        '|e'
                    ],
                    sort: [
                        '|e',
                        '-|a'
                    ]
                }
            );
        });
        it('should work with sort-objects', () => {
            const query: MangoQuery = {
                selector: {},
                sort: [
                    { 'name': 1 },
                    { 'active': -1 }
                ]
            };

            const table = getDefaultCompressionTable();
            const compressed = compressQuery(
                table,
                query
            );
            assert.deepEqual(
                compressed.sort,
                [{ '|e': 1 }, { '|a': -1 }]
            );
        });
        it('should work with sort-object', () => {
            const query: MangoQuery = {
                selector: {},
                sort: {
                    name: 'asc',
                    active: 'desc'
                }
            };

            const table = getDefaultCompressionTable();
            const compressed = compressQuery(
                table,
                query
            );

            assert.deepStrictEqual(
                compressed.sort,
                { '|e': 'asc', '|a': 'desc' }
            );
        });
        it('should work with regex', () => {

            /**
             * stringify filter to print regexes
             * @link https://stackoverflow.com/a/38251445
             */
            function stringifyFilter(_key: string, value: any) {
                if (value instanceof RegExp) {
                    return value.toString();
                }

                return value;
            }


            const query: MangoQuery = {
                selector: {
                    name: {
                        $regex: /foobar/i
                    }
                }
            };
            const table = getDefaultCompressionTable();
            const compressed = compressQuery(
                table,
                query
            );
            const compressedString = JSON.stringify(compressed, stringifyFilter);
            assert.ok(compressedString.includes('foobar'));
        });
    });
});
