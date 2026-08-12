const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scriptPath = path.join(__dirname, '..', 'js', 'weibo-remove-ads.js');
const fixturePath = path.join(__dirname, 'fixtures', 'build-comments.json');

function runScript(body, requestPath = '/2/comments/build_comments?x=1') {
  const source = fs.readFileSync(scriptPath, 'utf8');
  let result;

  vm.runInNewContext(source, {
    $done(value) {
      result = value;
    },
    $request: { url: `https://api.weibo.com${requestPath}` },
    $response: { body },
  });

  return result;
}

function runFixture(name) {
  const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const result = runScript(JSON.stringify(fixtures[name]));
  return JSON.parse(result.body);
}

test('retains all 76 normal build-comments entries', () => {
  assert.equal(runFixture('normal').datas.length, 76);
});

test('retains seven normal comments on a sponsored parent post', () => {
  assert.equal(runFixture('sponsoredParent').datas.length, 7);
});

test('removes explicit ads while retaining 13 comments', () => {
  assert.equal(runFixture('explicitAds').datas.length, 13);
});

test('retains a normal nickname while removing type 6 UI items', () => {
  const body = {
    datas: [
      { type: 0, data: { id: 'normal', user: { screen_name: '寰崥鐖卞ソ鑰卄' } } },
      { type: 6, data: { id: 'ui-item' } },
    ],
  };

  const result = JSON.parse(runScript(JSON.stringify(body)).body);

  assert.deepEqual(result.datas, [body.datas[0]]);
});
