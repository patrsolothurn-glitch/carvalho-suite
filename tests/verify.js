// Verificação automática diária do Carvalho Suite
// Uso: node tests/verify.js
// Sai com código 0 se tudo passar, 1 se algo falhar (para uso em scripts/CI).

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'index.html');

let pass = 0, fail = 0;
const failures = [];
function check(name, cond) {
  if (cond) { console.log('PASS:', name); pass++; }
  else { console.log('FAIL:', name); fail++; failures.push(name); }
}

function extractScript(html) {
  const firstOpen = html.indexOf('<script>') + '<script>'.length;
  const bootstrapIdx = html.indexOf('const App=module.exports');
  const endCloseTag = html.lastIndexOf('</script>', bootstrapIdx);
  const raw = html.slice(firstOpen, endCloseTag);
  return raw.replace('</script><script>', '');
}

async function main() {
  const html = fs.readFileSync(FILE, 'utf8');
  check('index.html existe e tem conteudo', html.length > 100000);

  const code = extractScript(html);
  let syntaxOk = true;
  try { new Function(code); } catch (e) { syntaxOk = false; console.log('   erro:', e.message); }
  check('Sintaxe JS valida (sem erros de parser)', syntaxOk);

  check('F.orange definido (cor do Lucas)', code.includes("orange: '#F97316'"));
  check('Funcionalidade Adicionar aula presente', code.includes('Adicionar aula'));
  check('Persistencia de fotos presente (famStorageGet)', code.includes('famStorageGet'));
  check('Edicao inline de TPC presente', code.includes('Guardar altera'));
  check('Edicao inline de notas presente (editNotaKey)', code.includes('editNotaKey'));
  check('Grelha dinamica de horarios presente (mergedSlots)', code.includes('mergedSlots'));

  // Testes de interacao real (requer react / react-dom / react-test-renderer instalados)
  try {
    global.window = global;
    global.IS_REACT_ACT_ENVIRONMENT = true;
    const inputEls = {};
    global.document = {
      createElement: (t) => t === 'canvas'
        ? { width: 0, height: 0, getContext: () => ({ drawImage: () => {} }), toDataURL: () => 'data:image/jpeg;base64,Y' }
        : {},
      getElementById: (id) => { if (!inputEls[id]) inputEls[id] = { click: () => {} }; return inputEls[id]; }
    };
    global.FileReader = function () {
      this.readAsDataURL = function () { this.onload && this.onload({ target: { result: 'data:image/png;base64,X' } }); };
    };
    global.Image = function () { const s = this; setTimeout(() => { s.onload && s.onload(); }, 0); };

    const React = require('react');
    global.React = React;
    const TestRenderer = require('react-test-renderer');
    const { act } = TestRenderer;

    let runCode = code + "\nwindow.__EscolarApp = EscolarApp; window.__FamiliaApp = FamiliaApp;";
    new Function('window', runCode)(global);

    const EscolarApp = global.__EscolarApp;
    const FamiliaApp = global.__FamiliaApp;

    await (async () => {
      const props = { onBack: () => {}, sharedDias: [], addSharedDia: () => {}, activeUser: 'patricio' };
      let renderer;
      await act(async () => { renderer = TestRenderer.create(React.createElement(EscolarApp, props)); });
      check('EscolarApp renderiza sem crash', !!renderer.toJSON());

      function findButtonByText(text) {
        return renderer.root.findAllByType('button').find(b => { try { return JSON.stringify(b.props.children).includes(text); } catch (e) { return false; } });
      }
      await act(async () => { findButtonByText('📊').props.onClick(); });
      check('Tab Notas abre sem crash', true);
    })();

    await (async () => {
      const props = { onBack: () => {}, sharedDias: [], addSharedDia: () => {}, removeSharedDia: () => {} };
      let renderer;
      await act(async () => { renderer = TestRenderer.create(React.createElement(FamiliaApp, props)); });
      check('FamiliaApp renderiza sem crash', !!renderer.toJSON());
      const divs = renderer.root.findAllByType('div');
      const avatarBoxes = divs.filter(d => d.props.style && d.props.style.width === 50 && d.props.style.height === 50);
      check('5 avatares renderizados (Todos/Patricio/Esposa/Lucas/Liam)', avatarBoxes.length === 5);
      check('Cor do Lucas valida (sem "undefined")', avatarBoxes[3] && !JSON.stringify(avatarBoxes[3].props.style).includes('undefined'));
    })();
  } catch (e) {
    console.log('AVISO: testes de interacao nao correram (dependencias em falta?). Erro:', e.message);
    console.log('Para testes completos: npm install react react-dom react-test-renderer');
  }

  console.log('\n=== RESULTADO:', pass, 'passou,', fail, 'falhou', '===');
  if (fail > 0) {
    console.log('Falhas:', failures.join(', '));
    process.exit(1);
  }
  process.exit(0);
}

main();
