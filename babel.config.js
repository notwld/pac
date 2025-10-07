module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        safe: false,
        allowUndefined: true,
        blocklist: null,
        allowlist: null,
        blacklist: null,
        whitelist: null,
        packageName: 'react-native-dotenv',
      },
    ],
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@': './'
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      },
    ],
  ],
};
