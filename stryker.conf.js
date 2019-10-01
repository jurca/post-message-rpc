module.exports = config => {
  config.set({
    mutator: 'typescript',
    packageManager: 'npm',
    reporters: ['html', 'progress'],
    testRunner: 'jest',
    transpilers: ['typescript'],
    coverageAnalysis: 'off',
    tsconfigFile: 'tsconfig.json',
    mutate: ['*.ts'],
    thresholds: {high: 95, low: 91, break: 90},
  })
}
