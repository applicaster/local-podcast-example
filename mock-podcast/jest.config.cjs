module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@lib/feed-decorators$': '<rootDir>/../feed-decorators/src/index.ts',
    '^@lib/utils$': '<rootDir>/src/utils/index.ts',
  },
};
