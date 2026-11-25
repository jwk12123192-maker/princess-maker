/* ==========================================================
   잠금 화면 (4자리 PIN)
   - 평문 PIN은 코드에 두지 않고, 솔트 + SHA-256 해시로 비교합니다.
   - crypto.subtle 이 없는 환경에서는 동일 솔트 + FNV-1a 64비트 해시로 대체합니다.
   - 한 번 풀면 sessionStorage 로 새로고침까지 유지됩니다.
   ========================================================== */
(function () {
  'use strict';

  var SALT = 'pm2026-lock-salt-7f3a';
  var HASH_SHA256 = '1f99e3f75d54a9b724b70c2de279d81b69d0f0aa691764d13c3236547359f653';
  var HASH_FALLBACK = '1b946980b2a417fc';
  var SESSION_KEY = 'pm2026.unlocked';

  var layer = document.getElementById('lock-layer');
  if (!layer) return;

  // 이미 이번 세션에서 해제했다면 즉시 숨김
  try {
    if (sessionStorage.getItem(SESSION_KEY) === '1') {
      layer.remove();
      document.body.classList.remove('is-locked');
      return;
    }
  } catch (e) { /* sessionStorage 차단 환경 */ }

  document.body.classList.add('is-locked');

  var dots = Array.prototype.slice.call(document.querySelectorAll('#pin-dots i'));
  var msg = document.getElementById('lock-msg');
  var pad = document.getElementById('pin-pad');
  var input = '';
  var checking = false;

  function render() {
    dots.forEach(function (d, i) {
      d.classList.toggle('is-on', i < input.length);
    });
  }

  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }

  function fnv1a64(str) {
    var h = 0xcbf29ce484222325n;
    var prime = 0x100000001b3n;
    var mask = 0xffffffffffffffffn;
    for (var i = 0; i < str.length; i++) {
      h ^= BigInt(str.charCodeAt(i));
      h = (h * prime) & mask;
    }
    var s = h.toString(16);
    while (s.length < 16) s = '0' + s;
    return s;
  }

  function verify(pin) {
    var payload = SALT + ':' + pin;
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))
        .then(function (buf) { return hex(buf); })
        .then(function (h) { return h === HASH_SHA256; })
        .catch(function () { return fnv1a64(payload) === HASH_FALLBACK; });
    }
    return Promise.resolve(fnv1a64(payload) === HASH_FALLBACK);
  }

  function shake(text) {
    msg.textContent = text;
    var card = layer.querySelector('.lock-card');
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
    input = '';
    render();
    setTimeout(function () { if (msg.textContent === text) msg.textContent = ''; }, 2200);
  }

  function push(ch) {
    if (checking || input.length >= 4) return;
    input += ch;
    msg.textContent = '';
    render();
    if (input.length === 4) {
      checking = true;
      setTimeout(function () {
        verify(input).then(function (ok) {
          checking = false;
          if (ok) {
            try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) { /* ignore */ }
            layer.classList.add('is-opening');
            document.body.classList.remove('is-locked');
            setTimeout(function () { layer.remove(); }, 420);
            document.dispatchEvent(new CustomEvent('pm-unlocked'));
          } else {
            shake('비밀번호가 맞지 않아요. 다시 입력해 주세요');
          }
        });
      }, 140);
    }
  }

  function backspace() {
    if (checking) return;
    input = input.slice(0, -1);
    render();
  }

  pad.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-key]');
    if (!btn) return;
    var key = btn.getAttribute('data-key');
    if (key === 'del') backspace();
    else push(key);
  });

  document.addEventListener('keydown', function (e) {
    if (!document.getElementById('lock-layer')) return;
    if (/^[0-9]$/.test(e.key)) push(e.key);
    else if (e.key === 'Backspace') { e.preventDefault(); backspace(); }
  });

  render();
})();
