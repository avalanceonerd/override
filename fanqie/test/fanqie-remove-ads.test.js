const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const pluginPath = path.join(__dirname, '..', 'Fanqie_remove_ads.lpx');

test('packages a conservative Fanqie and Hongguo Loon plugin', () => {
  const plugin = fs.readFileSync(pluginPath, 'utf8');

  assert.match(plugin, /^#!name=番茄小说 \+ 红果短剧 去广告（保守版）$/m);
  assert.match(plugin, /^\[Rule\]$/m);
  assert.match(plugin, /^\[Rewrite\]$/m);
  assert.match(plugin, /^\[MitM\]$/m);
});

test('limits blocking to explicit ad endpoints and signature hosts', () => {
  const plugin = fs.readFileSync(pluginPath, 'utf8');
  const expectedRules = [
    'DOMAIN,p6-ad-sign.byteimg.com,REJECT',
    'DOMAIN,p9-ad-sign.byteimg.com,REJECT',
  ];

  for (const rule of expectedRules) assert.match(plugin, new RegExp(`^${rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));

  assert.ok(plugin.includes('pangolin-sdk-toutiao\\.com\\/api\\/ad\\/union\\/sdk'));
  assert.ok(plugin.includes('snssdk\\.com\\/api\\/ad\\/'));
  assert.ok(plugin.includes('ad-app-package'));
  assert.ok(plugin.includes('web\\.business\\.image'));
  assert.match(plugin, /hostname = %APPEND% .*\*\.pangolin-sdk-toutiao\.com/);

  for (const unsafeRule of [
    'DOMAIN-SUFFIX,bytedance.com,REJECT',
    'DOMAIN-KEYWORD,zijieapi,REJECT',
    'DOMAIN,i.snssdk.com,REJECT',
    'DOMAIN-SUFFIX,novelapp.ixigua.com,REJECT',
    '/mp4 - reject',
  ]) {
    assert.doesNotMatch(plugin, new RegExp(`^${unsafeRule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
});
