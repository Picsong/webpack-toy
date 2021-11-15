const fs = require('fs')
const path = require('path')
const babel = require('@babel/core')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default

// 获取模块信息
function getModuleInfo(file) {
    // 读取文件
    const body = fs.readFileSync(file, 'utf-8');
    // console.log(body)
    // 转化AST
    const ast = parser.parse(body, {
        sourceType: 'module'
    })
    // console.log(ast)
    // 收集依赖
    const deps = {}
    traverse(ast, {
        ImportDeclaration({node}) {
            // console.log(node)
            const dirname = path.dirname(file)
            const abspath = './' + path.join(dirname, node.source.value)
            deps[node.source.value] = abspath
        }
    })
    // es6==>es5
    const {code} = babel.transformFromAst(ast, null, {
        presets: ['@babel/preset-env']
    })

    const moduleInfo = {file, deps, code}
    return moduleInfo
}


// 模块解析，构建依赖图
function parseModules(file) {
    const entry = getModuleInfo(file)
    const temp = [entry]
    const depsGraph = {}

    getDeps(temp, entry)

    temp.forEach((moduleInfo) => {
        depsGraph[moduleInfo.file] = {
            deps: moduleInfo.deps,
            code: moduleInfo.code,
        };
    });
    return depsGraph;
}

// 获取依赖的模块信息
function getDeps(temp, {deps}) {
    Object.keys(deps).forEach(key => {
        const child = getModuleInfo(deps[key])//这里使用abspath去获取对应文件
        temp.push(child)
        getDeps(temp, child)
    })
}

// 打包
function bundle(file) {
    const depsGraph = JSON.stringify(parseModules(file));
    return `(function (graph) {
                 function require(file) {
                     function absRequire(relPath) {
                        return require(graph[file].deps[relPath])
                     }
                     var exports = {};
                     
                     (function (require,exports,code) {
                        eval(code)
                     })(absRequire,exports,graph[file].code)
                     
                     return exports
                 }
                 require('${file}')
             })(${depsGraph})`;
}

!fs.existsSync("./dist") && fs.mkdirSync("./dist");
fs.writeFileSync("./dist/bundle.js", bundle('./src/index.js'));