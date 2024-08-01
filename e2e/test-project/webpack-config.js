module.exports = {
  module: {
    rules: [
      {
        test: /tsAction\/index.ts$/,
        use: 'ts-loader'
      },
      {
        test: /syntaxidermist\/index.js$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '__index.js',
              emitFile: true
            }
          }
        ]
      }
    ]
  }
}
