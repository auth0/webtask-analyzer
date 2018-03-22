# Analyze webtask code

## Usage

```js
const Analyzer = require('webtask-analyzer');

const analyzer = new Analyzer({
    clusterUrl: '...',
    containerName: '...',
    token: '...',
});

const results = await analyzer.findDependenciesInCode('module.exports = ...');
```

## API

```typescript
export interface AnalyzerOptions {
    clusterUrl: string;
    containerName: string;
    token: string;
}

export interface RequireNode {
    type: 'dynamic_require' | 'global' | 'require';
    spec: string;
    start: number;
    end: number;
    resolved?: any;
}

export class Analyzer {
    constructor(options: AnalyzerOptions) {}

    findDependenciesInCode(code: string): Promise<RequireNode[]> {}
}
```
