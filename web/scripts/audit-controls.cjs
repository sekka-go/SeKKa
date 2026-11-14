const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const directory = path.resolve(__dirname, '../src/v2');
const rows = [];
for (const file of fs.readdirSync(directory).filter(name => name.endsWith('.tsx')).sort()) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(directory, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      const props = Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map(p => [p.name.getText(source), p.initializer?.getText(source) || 'true']));
      const action = ['onClick','onSubmit','href','onChange'].find(p => p in props);
      if (action || ['button','a','form','Action','Primary'].includes(tag)) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        rows.push({file,line,tag,action:action||'implicit or inherited',handler:action?props[action]:'',disabled:props.disabled||'',label:props['aria-label']||props.label||''});
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
fs.writeFileSync(path.resolve(directory,'../../../docs/CONTROL_INVENTORY.json'),JSON.stringify(rows,null,2)+'\n');
console.log(rows.length+' source control declarations inventoried');
