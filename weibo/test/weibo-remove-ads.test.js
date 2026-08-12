const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scriptPath = path.join(__dirname, '..', 'js', 'weibo-remove-ads.js');
const lpxPath = path.join(__dirname, '..', 'Weibo_remove_ads.lpx');
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
      { type: 0, data: { id: 'normal', user: { screen_name: '微博爱好者' } } },
      { type: 6, data: { id: 'ui-item' } },
    ],
  };

  const result = JSON.parse(runScript(JSON.stringify(body)).body);

  assert.deepEqual(result.datas, [body.datas[0]]);
});

test('removes a timeline feed item marked adMblog', () => {
  const body = {
    items: [
      { category: 'feed', data: { id: 'ad', readtimetype: 'adMblog' } },
      { category: 'feed', data: { id: 'post' } },
    ],
  };

  const result = JSON.parse(runScript(JSON.stringify(body), '/2/statuses/container_timeline?since_id=1').body);

  assert.deepEqual(result.items, [body.items[1]]);
});

test('passes malformed comment JSON through unchanged', () => {
  const body = '{not valid JSON';

  assert.equal(runScript(body).body, body);
});

test('removes UI records from root comments while retaining genuine comments', () => {
  const body = {
    root_comments: [
      { type: 0, id: 'comment', user: { screen_name: 'reader' } },
      { type: 6, id: 'recommendation' },
      { type: 15, id: 'filter-tip' },
      { type: 41, id: 'survey' },
    ],
  };

  const result = JSON.parse(runScript(JSON.stringify(body)).body);

  assert.deepEqual(result.root_comments, [body.root_comments[0]]);
});

test('normalizes app icon cards on the Kelee appicon route', () => {
  const body = { data: { list: [{ id: 'theme', cardType: 9 }, { id: 'plain' }] } };

  const result = JSON.parse(runScript(JSON.stringify(body), '/aj/appicon/list').body);

  assert.equal(result.data.list[0].cardType, 2);
  assert.equal(result.data.list[1].cardType, undefined);
});

test('packages all required Weibo endpoints against the local script', () => {
  const lpx = fs.readFileSync(lpxPath, 'utf8');
  const localScriptUrl = 'https://raw.githubusercontent.com/avalanceonerd/override/main/weibo/js/weibo-remove-ads.js';

  assert.match(lpx, /comments\\\/build_comments/);
  assert.match(lpx, /statuses\\\/.*container_timeline/);
  assert.match(lpx, /bootpreload\\\.uve\\\.weibo\\\.com/);
  assert.doesNotMatch(lpx, /kelee\\.one/);

  const responseEntries = lpx.match(/^http-response .*$/gm) ?? [];
  assert.ok(responseEntries.length > 0);
  for (const entry of responseEntries) {
    assert.match(entry, new RegExp(`script-path=${localScriptUrl.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`));
    assert.match(entry, /requires-body=true/);
  }
});
