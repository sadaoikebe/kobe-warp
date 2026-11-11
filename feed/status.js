// JR神戸線 運行情報パーサ（純粋関数。ブラウザ・Node 共用）
// 正: ~/workspace/commute/commute.py の _fetch_official_status / _yahoo_status
//
// 第一ソース: JR西日本公式 trafficinfo.json
//   近畿エリア(id=2) > 当日 > 京阪神(id=1) > lineName に「神戸線」
//   無掲載 = 平常。iconType 0001=見合わせ / 0003=遅延 / 0000・0999=お知らせ
// フィード形式（status.json）:
//   { v:1, source:'official'|'yahoo', state, createdAt, fetchedAt, details:[...], text }
var WarpStatus = (function () {
  'use strict';
  var OFFICIAL_URL = 'https://trafficinfo.westjr.co.jp/api/v1/trafficinfo.json';
  var OFFICIAL_PAGE = 'https://trafficinfo.westjr.co.jp/kinki.html';
  var YAHOO_URL = 'https://transit.yahoo.co.jp/diainfo/273/0';

  function todayJST(now) {
    var d = new Date((now || new Date()).getTime() + 9 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }

  function findById(arr, id) {
    if (!Array.isArray(arr)) return undefined;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].id === id) return arr[i];
    }
    return undefined;
  }

  // 戻り値: フィード形式（fetchedAt は呼び出し側で付ける）。構造が想定外なら null。
  function parseOfficial(data, today) {
    try {
      if (!data || typeof data !== 'object') return null;
      var area = findById(data.areaTrafficInfos, 2);
      if (!area || !Array.isArray(area.dailyData)) return null;
      var day = null;
      for (var i = 0; i < area.dailyData.length; i++) {
        if (area.dailyData[i] && area.dailyData[i].date === today) day = area.dailyData[i];
      }
      if (!day) return null;
      var place = findById(day.placeTrafficInfos, 1);
      if (!place) return null;
      var lines = place.conventionalLineTrafficInfos;
      if (lines == null) lines = [];
      if (!Array.isArray(lines)) return null;
      var kobe = null;
      for (var j = 0; j < lines.length; j++) {
        if (lines[j] && String(lines[j].lineName || '').indexOf('神戸線') >= 0) { kobe = lines[j]; break; }
      }
      var out = { v: 1, source: 'official', state: 'normal', createdAt: data.createdAt || null, details: [], text: '' };
      if (!kobe) return out;
      var details = Array.isArray(kobe.conventionalLineTrafficInfoDetails) ? kobe.conventionalLineTrafficInfoDetails : [];
      var conds = details.map(function (x) { return String((x && x.conditionName) || ''); });
      var icon = String(kobe.iconType || '');
      var has = function (w) { return conds.some(function (c) { return c.indexOf(w) >= 0; }); };
      if (icon === '0001' || has('見合わせ')) out.state = 'suspended';
      else if (has('運休')) out.state = 'partial';
      else if (icon === '0003' || has('遅')) out.state = 'delay';
      else out.state = 'notice';
      out.details = details.map(function (x) {
        var vd = (Array.isArray(x.versionDetail) && x.versionDetail[0]) || {};
        var body = String(vd.body || '');
        return {
          condition: String(x.conditionName || ''),
          icon: String(x.iconType || ''),
          sections: (x.sections || []).map(function (s) {
            return s.endStation ? (s.startStation || '') + '〜' + s.endStation : (s.startStation || '');
          }).filter(Boolean),
          cause: String(x.cause || ''),
          title: String(vd.title || ''),
          updatedAt: vd.updatedAt || null,
          body: body,
          furikae: body.indexOf('振替輸送') >= 0
        };
      });
      return out;
    } catch (e) {
      return null;
    }
  }

  // Yahoo!路線情報（公式が取れないときのフォールバック専用）
  function parseYahoo(html) {
    var m = /id="mdServiceStatus"([\s\S]*?)<\/dl>/.exec(html || '');
    if (!m) return null;
    var text = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace('運転状況', '').trim().replace(/^>\s*/, '').trim();
    if (!text) return null;
    var state = 'normal';
    if (text.indexOf('見合わせ') >= 0 || text.indexOf('運休') >= 0) state = 'suspended';
    else if (text.indexOf('遅れ') >= 0) state = 'delay';
    return { v: 1, source: 'yahoo', state: state, createdAt: null, details: [], text: text };
  }

  var HEADS = {
    normal: '平常運転', delay: '遅延', partial: '一部運休・遅延',
    suspended: '運転見合わせ', notice: 'お知らせ', unknown: '運行情報 未確認'
  };

  return {
    OFFICIAL_URL: OFFICIAL_URL, OFFICIAL_PAGE: OFFICIAL_PAGE, YAHOO_URL: YAHOO_URL,
    todayJST: todayJST, parseOfficial: parseOfficial, parseYahoo: parseYahoo, HEADS: HEADS
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = WarpStatus;
