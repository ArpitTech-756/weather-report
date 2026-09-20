(function () {
  'use strict';


  const CONFIG = {
    USE_LIVE_API: false,        
    DEFAULT_CITY: 'Lucknow',
    UNIT: 'C'                  
  };


  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

 
  const COND = {
    sunny:  { label: 'Sunny',         short: 'Clear',         precip: 5,  adj: 2,  radar: .06, cover: 10 },
    partly: { label: 'Partly Cloudy', short: 'Partly Cloudy', precip: 12, adj: 0,  radar: .25, cover: 45 },
    cloudy: { label: 'Cloudy',        short: 'Cloudy',        precip: 28, adj: -2, radar: .40, cover: 85 },
    rain:   { label: 'Rain',          short: 'Rain',          precip: 75, adj: -4, radar: .85, cover: 90 },
    storm:  { label: 'Thunderstorm',  short: 'Thunderstorm',  precip: 85, adj: -5, radar: 1,   cover: 96 },
    snow:   { label: 'Snow',          short: 'Snow',          precip: 68, adj: -6, radar: .70, cover: 92 },
    fog:    { label: 'Fog',           short: 'Fog',           precip: 12, adj: -3, radar: .20, cover: 80 }
  };

  const PATTERN = {
    sunny:  ['sunny', 'sunny', 'partly', 'sunny', 'sunny', 'partly', 'sunny'],
    partly: ['partly', 'sunny', 'partly', 'cloudy', 'rain', 'partly', 'sunny'],
    cloudy: ['cloudy', 'cloudy', 'rain', 'cloudy', 'partly', 'sunny', 'partly'],
    rain:   ['rain', 'rain', 'cloudy', 'rain', 'partly', 'cloudy', 'sunny'],
    storm:  ['storm', 'rain', 'rain', 'cloudy', 'partly', 'sunny', 'sunny'],
    snow:   ['snow', 'snow', 'cloudy', 'snow', 'cloudy', 'partly', 'sunny'],
    fog:    ['fog', 'fog', 'cloudy', 'partly', 'sunny', 'sunny', 'partly']
  };

 
  const SAMPLE = {
    'Lucknow':  { country: 'India',   tz: 'Asia/Kolkata',        temp: 28, feels: 30, cond: 'partly', high: 31, low: 24, humidity: 68, wind: 14, gust: 22, dir: 'NW', uv: 6,  aqi: 72,  vis: 8.4, pressure: 1013, dew: 21, sunrise: '6:02 AM', sunset: '6:21 PM' },
    'Delhi':    { country: 'India',   tz: 'Asia/Kolkata',        temp: 33, feels: 37, cond: 'sunny',  high: 35, low: 26, humidity: 48, wind: 12, gust: 20, dir: 'W',  uv: 8,  aqi: 158, vis: 5.2, pressure: 1008, dew: 20, sunrise: '6:06 AM', sunset: '6:26 PM' },
    'Mumbai':   { country: 'India',   tz: 'Asia/Kolkata',        temp: 30, feels: 35, cond: 'rain',   high: 31, low: 26, humidity: 84, wind: 19, gust: 31, dir: 'SW', uv: 3,  aqi: 61,  vis: 4.1, pressure: 1007, dew: 27, sunrise: '6:24 AM', sunset: '6:38 PM' },
    'London':   { country: 'UK',      tz: 'Europe/London',       temp: 17, feels: 16, cond: 'cloudy', high: 19, low: 11, humidity: 72, wind: 16, gust: 27, dir: 'SW', uv: 2,  aqi: 38,  vis: 9.6, pressure: 1016, dew: 12, sunrise: '6:53 AM', sunset: '7:13 PM' },
    'New York': { country: 'USA',     tz: 'America/New_York',    temp: 20, feels: 19, cond: 'fog',    high: 24, low: 16, humidity: 88, wind: 8,  gust: 13, dir: 'NE', uv: 3,  aqi: 46,  vis: 1.6, pressure: 1018, dew: 18, sunrise: '6:37 AM', sunset: '6:50 PM' },
    'Dubai':    { country: 'UAE',     tz: 'Asia/Dubai',          temp: 39, feels: 44, cond: 'sunny',  high: 41, low: 31, humidity: 42, wind: 17, gust: 26, dir: 'NW', uv: 10, aqi: 96,  vis: 7.4, pressure: 1004, dew: 24, sunrise: '5:52 AM', sunset: '6:05 PM' },
    'Tokyo':    { country: 'Japan',   tz: 'Asia/Tokyo',          temp: 26, feels: 29, cond: 'storm',  high: 28, low: 22, humidity: 79, wind: 24, gust: 41, dir: 'NE', uv: 4,  aqi: 52,  vis: 5.8, pressure: 1002, dew: 22, sunrise: '5:28 AM', sunset: '5:37 PM' },
    'Paris':    { country: 'France',  tz: 'Europe/Paris',        temp: 19, feels: 18, cond: 'partly', high: 22, low: 12, humidity: 63, wind: 13, gust: 22, dir: 'W',  uv: 4,  aqi: 44,  vis: 10.5, pressure: 1015, dew: 12, sunrise: '7:22 AM', sunset: '7:39 PM' }
  };

 
  const cityHour = tz => {
    const h = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date()), 10);
    return h === 24 ? 0 : h;
  };
  const isNight = h => h < 6 || h >= 19;
  const fmtHour = h => ((h % 12) || 12) + ' ' + (h < 12 ? 'AM' : 'PM');
  const fmtMinutes = m => {
    m = ((m % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0');
    return ((h % 12) || 12) + ':' + mm + ' ' + (h < 12 ? 'AM' : 'PM');
  };
  const parseTime = s => {
    const m = /(\d+):(\d+)\s*(AM|PM)/i.exec(s || '');
    if (!m) return NaN;
    let h = (+m[1]) % 12;
    if (m[3].toUpperCase() === 'PM') h += 12;
    return h * 60 + (+m[2]);
  };
  const weekday = (date, tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date);

  /* ---------- sample series (hourly + daily) ---------- */
  function buildSeries(b) {
    const h0 = cityHour(b.tz);
    const diurnal = h => 3.2 * Math.cos((h - 15) * Math.PI / 12);
    const hourly = Array.from({ length: 7 }, (_, i) => {
      const h = (h0 + i) % 24;
      const temp = i === 0 ? b.temp : Math.round(b.temp + diurnal(h) - diurnal(h0) + Math.sin(i * 1.3 + b.temp) * .6);
      const precip = clamp(Math.round(COND[b.cond].precip + 6 * Math.sin(i * 1.9 + b.humidity)), 0, 100);
      return { label: i === 0 ? 'Now' : fmtHour(h), temp, cond: b.cond, precip, night: isNight(h) };
    });

    const spread = Math.max(4, b.high - b.low);
    const daily = PATTERN[b.cond].map((c, i) => {
      const date = new Date(Date.now() + i * 864e5);
      const hi = i === 0 ? b.high : Math.round(b.high + COND[c].adj - COND[b.cond].adj + Math.sin(i * 1.7 + b.temp) * 1.2);
      const lo = i === 0 ? b.low : Math.round(hi - spread + Math.cos(i * 1.3) * .8);
      const precip = clamp(COND[c].precip + Math.round(7 * Math.sin(i * 2.3 + b.humidity)), 0, 100);
      return { day: i === 0 ? 'Today' : weekday(date, b.tz), cond: c, hi, lo, precip };
    });
    return { hourly, daily };
  }

  function findCity(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) return null;
    const keys = Object.keys(SAMPLE);
    return keys.find(k => k.toLowerCase() === q)
        || keys.find(k => k.toLowerCase().startsWith(q))
        || keys.find(k => k.toLowerCase().includes(q))
        || null;
  }

  function sampleFor(key, condOverride) {
    const base = Object.assign({ city: key }, SAMPLE[key]);
    if (condOverride) base.cond = condOverride;
    return Object.assign(base, buildSeries(base));
  }

  const SampleProvider = {
    async get(query) {
      await sleep(260);                         
      const key = findCity(query);
      if (!key) throw new Error('NOT_FOUND');
      return sampleFor(key);
    }
  };


  const wmo = c => {
    if (c === 0) return 'sunny';
    if (c <= 2) return 'partly';
    if (c === 3) return 'cloudy';
    if (c === 45 || c === 48) return 'fog';
    if (c >= 95) return 'storm';
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
    return 'rain';
  };
  const compass = deg => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
  const fmtIso = s => {
    const h = +s.slice(11, 13), m = s.slice(14, 16);
    return ((h % 12) || 12) + ':' + m + ' ' + (h < 12 ? 'AM' : 'PM');
  };

  const LiveProvider = {
    async get(query) {
      const geo = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=' + encodeURIComponent(query)).then(r => r.json());
      if (!geo.results || !geo.results.length) throw new Error('NOT_FOUND');
      const g = geo.results[0];

      const wxUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + g.latitude + '&longitude=' + g.longitude +
        '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,dew_point_2m' +
        '&hourly=temperature_2m,precipitation_probability,weather_code,visibility' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max' +
        '&timezone=auto&forecast_days=7';
      const aqUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + g.latitude + '&longitude=' + g.longitude + '&current=us_aqi';

      const [wx, aq] = await Promise.all([
        fetch(wxUrl).then(r => r.json()),
        fetch(aqUrl).then(r => r.json()).catch(() => null)
      ]);

      const cur = wx.current, H = wx.hourly, D = wx.daily;
      let i0 = H.time.indexOf(cur.time.slice(0, 13) + ':00');
      if (i0 < 0) i0 = 0;

      const hourly = Array.from({ length: 7 }, (_, k) => {
        const idx = i0 + k, hh = +H.time[idx].slice(11, 13);
        return { label: k === 0 ? 'Now' : fmtHour(hh), temp: Math.round(H.temperature_2m[idx]), cond: wmo(H.weather_code[idx]), precip: H.precipitation_probability[idx] || 0, night: isNight(hh) };
      });
      const daily = D.time.map((t, i) => ({
        day: i === 0 ? 'Today' : new Date(t + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
        cond: wmo(D.weather_code[i]),
        hi: Math.round(D.temperature_2m_max[i]),
        lo: Math.round(D.temperature_2m_min[i]),
        precip: D.precipitation_probability_max[i] || 0
      }));

      return {
        city: g.name, country: g.country || '', tz: wx.timezone || g.timezone || 'UTC',
        temp: Math.round(cur.temperature_2m), feels: Math.round(cur.apparent_temperature),
        cond: wmo(cur.weather_code), high: daily[0].hi, low: daily[0].lo,
        humidity: Math.round(cur.relative_humidity_2m), wind: Math.round(cur.wind_speed_10m),
        gust: Math.round(cur.wind_gusts_10m), dir: compass(cur.wind_direction_10m),
        uv: Math.round(D.uv_index_max[0]),
        aqi: aq && aq.current && aq.current.us_aqi != null ? Math.round(aq.current.us_aqi) : null,
        vis: +(H.visibility[i0] / 1000).toFixed(1), pressure: Math.round(cur.surface_pressure),
        dew: Math.round(cur.dew_point_2m),
        sunrise: fmtIso(D.sunrise[0]), sunset: fmtIso(D.sunset[0]),
        hourly, daily
      };
    }
  };

  const Provider = CONFIG.USE_LIVE_API ? LiveProvider : SampleProvider;


  const rays = (cx, cy, r1, r2) => {
    let s = '';
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      s += '<line x1="' + (cx + Math.cos(a) * r1).toFixed(1) + '" y1="' + (cy + Math.sin(a) * r1).toFixed(1) +
           '" x2="' + (cx + Math.cos(a) * r2).toFixed(1) + '" y2="' + (cy + Math.sin(a) * r2).toFixed(1) + '"/>';
    }
    return '<g class="i-rays">' + s + '</g>';
  };
  const sun = (cx, cy, r, r1, r2) => '<circle class="i-sun" cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>' + rays(cx, cy, r1, r2);
  const cloud = (tx, ty, s, cls) =>
    '<g class="' + (cls || 'i-cloud') + '" transform="translate(' + tx + ' ' + ty + ') scale(' + s + ')">' +
    '<circle cx="22" cy="40" r="8"/><circle cx="33" cy="32" r="11"/><circle cx="45" cy="38" r="9"/><rect x="22" y="38" width="23" height="10"/></g>';
  const MOON_D = 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z';

  function icon(type, night) {
    let g;
    switch (type) {
      case 'sunny':
        g = night ? '<path class="i-moon" transform="translate(11 11) scale(1.75)" d="' + MOON_D + '"/>' : sun(32, 32, 10, 15, 22);
        break;
      case 'partly':
        g = (night ? '<path class="i-moon" transform="translate(3 1) scale(1.15)" d="' + MOON_D + '"/>' : sun(24, 23, 8, 12, 17)) + cloud(6, 8, 1);
        break;
      case 'cloudy':
        g = cloud(-6, -6, .85, 'i-cloud2') + cloud(4, 4, 1);
        break;
      case 'rain':
        g = cloud(-2, -6, 1) +
            '<g class="i-drop"><path d="M23 46l-3 9"/><path d="M32 46l-3 9"/><path d="M41 46l-3 9"/></g>';
        break;
      case 'storm':
        g = cloud(-2, -8, 1, 'i-cloud2') +
            '<polygon class="i-bolt" points="35,36 26,51 32,51 29,62 42,45 35,45 39,36"/>';
        break;
      case 'snow':
        g = cloud(-2, -6, 1) +
            '<circle class="i-flake" cx="23" cy="50" r="2.6"/><circle class="i-flake" cx="32" cy="56" r="2.6"/><circle class="i-flake" cx="41" cy="50" r="2.6"/>';
        break;
      case 'fog':
        g = cloud(-2, -8, 1) +
            '<g class="i-fogl"><path d="M14 46h34"/><path d="M20 52h34"/><path d="M14 58h28"/></g>';
        break;
      default:
        g = cloud(0, 0, 1);
    }
    return '<svg class="ic" viewBox="0 0 64 64" aria-hidden="true">' + g + '</svg>';
  }
  const DROP = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5s6.5 6.8 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 9.300 12 2.500 12 2.500z"/></svg>';

  const humInfo = h => h < 30 ? 'Dry' : h <= 70 ? 'Comfortable' : h <= 85 ? 'Humid' : 'Very humid';
  const uvInfo  = u => u <= 2 ? 'Low' : u <= 5 ? 'Moderate' : u <= 7 ? 'High' : u <= 10 ? 'Very High' : 'Extreme';
  const aqiInfo = a => a == null ? ['—', 'Unavailable']
    : a <= 50  ? ['Good', 'Air is clean and fresh']
    : a <= 100 ? ['Moderate', 'Acceptable for most people']
    : a <= 150 ? ['Sensitive groups', 'Limit long outdoor effort']
    : a <= 200 ? ['Unhealthy', 'Reduce prolonged exertion']
    : ['Very unhealthy', 'Avoid outdoor activity'];
  const visInfo  = v => v >= 10 ? 'Excellent' : v >= 5 ? 'Good' : v >= 2 ? 'Reduced' : 'Poor';
  const presInfo = p => p < 1005 ? 'Low pressure' : p > 1020 ? 'High pressure' : 'Normal';

  
  const state = { data: null, unit: CONFIG.UNIT, updated: Date.now(), token: 0 };
  const T = c => (state.unit === 'F' ? Math.round(c * 9 / 5 + 32) : Math.round(c)) + '°';

  const shell = $('#shell');

  function buildBars(el, lit, total) {
    el.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const b = document.createElement('i');
      b.style.height = (34 + (Math.sin(i * .9) * .5 + .5) * 46 + ((i * 37) % 17)) + '%';
      b.style.animationDelay = (i * 18) + 'ms';
      if (i < lit) b.className = 'on';
      el.appendChild(b);
    }
  }
  function buildUv(el, uv) {
    el.innerHTML = '';
    for (let i = 0; i < 11; i++) {
      const b = document.createElement('i');
      b.style.setProperty('--i', i);
      b.style.animationDelay = (i * 30) + 'ms';
      if (i < uv) b.className = 'on';
      el.appendChild(b);
    }
  }

  function render() {
    const d = state.data;
    if (!d) return;
    const C = COND[d.cond];
    const night = isNight(cityHour(d.tz));
    const place = d.country ? d.city + ', ' + d.country : d.city;

  
    shell.dataset.weather = d.cond;
    shell.dataset.time = night ? 'night' : 'day';
    shell.style.setProperty('--wind-dur', clamp(7 - d.wind / 5, 1.4, 6).toFixed(2) + 's');

    $('#nowIcon').innerHTML = icon(d.cond, night);
    $('#tempVal').textContent = T(d.temp);
    $('#condText').textContent = d.cond === 'sunny' && night ? 'Clear' : C.label;
    $('#nowLoc').textContent = place;
    $('#metaLoc').textContent = place;
    $('#feelsVal').textContent = T(d.feels);
    $('#hiLo').textContent = 'H ' + T(d.high) + ' · L ' + T(d.low);
    $('#forecastNote').textContent = 'Daily highs, lows and chance of rain for ' + d.city + '.';


    $('#humVal').textContent = d.humidity + '%';
    $('#humState').textContent = humInfo(d.humidity);
    $('#humDew').textContent = 'Dew ' + T(d.dew);
    buildBars($('#humBars'), Math.round(d.humidity / 100 * 26), 26);

    $('#windVal').textContent = d.wind + ' km/h';
    $('#windDir').textContent = d.dir;
    $('#windGust').textContent = 'Gusts ' + d.gust + ' km/h';

    $('#uvVal').textContent = d.uv;
    $('#uvState').textContent = uvInfo(d.uv);
    buildUv($('#uvBar'), d.uv);

    
    $('#dailyGrid').innerHTML = d.daily.map((x, i) =>
      '<article class="glass day' + (i === 0 ? ' today' : '') + '">' +
        '<span class="dname">' + x.day + '</span>' + icon(x.cond) +
        '<div class="temps"><b class="hi">' + T(x.hi) + '</b><span class="lo">' + T(x.lo) + '</span></div>' +
        '<span class="dcond">' + COND[x.cond].short + '</span>' +
        '<span class="prec">' + DROP + x.precip + '%</span>' +
      '</article>').join('');

   
    $('#hourlyRow').innerHTML = d.hourly.map((h, i) =>
      '<article class="glass hour' + (i === 0 ? ' is-now' : '') + '">' +
        '<span class="hl">' + h.label + '</span>' + icon(h.cond, h.night) +
        '<b class="ht">' + T(h.temp) + '</b>' +
        '<span class="hp">' + DROP + h.precip + '%</span>' +
        '<span class="pbar"><u style="width:' + h.precip + '%"></u></span>' +
      '</article>').join('');

  
    const [aqiCat, aqiNote] = aqiInfo(d.aqi);
    $('#aqiVal').textContent = d.aqi == null ? '—' : d.aqi;
    $('#aqiCat').textContent = aqiCat;
    $('#aqiNote').textContent = aqiNote;
    $('#aqiMarker').style.left = clamp((d.aqi == null ? 0 : d.aqi) / 300 * 100, 3, 97) + '%';

    $('#visVal').textContent = d.vis;
    $('#visNote').textContent = visInfo(d.vis);
    $('#visFill').style.width = clamp(d.vis / 12 * 100, 6, 100) + '%';

    $('#presVal').textContent = d.pressure;
    $('#presNote').textContent = presInfo(d.pressure);
    $('#presNeedle').style.transform = 'rotate(' + clamp((d.pressure - 1013) / 25 * 60, -70, 70).toFixed(1) + 'deg)';

    $('#riseVal').textContent = d.sunrise;
    $('#setVal').textContent = d.sunset;
    const rise = parseTime(d.sunrise), set = parseTime(d.sunset);
    if (!isNaN(rise) && !isNaN(set)) {
      const len = set - rise;
      $('#riseNote').textContent = 'Day length ' + Math.floor(len / 60) + 'h ' + (len % 60) + 'm';
      $('#setNote').textContent = 'Golden hour ' + fmtMinutes(set - 60);
    }

  
    const radar = $('#radarCard');
    radar.style.setProperty('--precip', C.radar);
    $('#radarCity').textContent = d.city;
    $('#radarRain').textContent = d.daily[0].precip + '%';
    $('#radarCover').textContent = C.cover + '%';
    $('#radarWind').textContent = d.wind + ' km/h';
    buildStreaks(d.wind);

    renderCities();
    renderPreviewChips();
    tickClock();
  }

  function renderCities() {
    const current = state.data ? state.data.city : '';
    $('#cityGrid').innerHTML = Object.keys(SAMPLE).map(name => {
      const c = SAMPLE[name];
      return '<button type="button" class="glass city' + (name === current ? ' active' : '') + '" data-city="' + name + '">' +
        '<span class="cname">' + name + '</span>' + icon(c.cond, isNight(cityHour(c.tz))) +
        '<span class="ccountry">' + c.country + '</span>' +
        '<span class="ctemp">' + T(c.temp) + '</span>' +
        '<span class="ccond">' + COND[c.cond].short + '</span></button>';
    }).join('');
  }

  function renderPreviewChips() {
    $('#previewChips').innerHTML = Object.keys(COND).map(k =>
      '<button type="button" class="chip' + (state.data && state.data.cond === k ? ' active' : '') + '" data-cond="' + k + '">' + COND[k].label + '</button>').join('');
  }

  function tickClock() {
    const d = state.data;
    if (!d) return;
    const now = new Date();
    $('#clock').textContent = new Intl.DateTimeFormat('en-US', {
      timeZone: d.tz, weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'
    }).format(now);
    const mins = Math.floor((now - state.updated) / 60000);
    $('#updated').textContent = mins < 1 ? 'Updated just now' : 'Updated ' + mins + ' min ago';
  }


  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3800);
  }

  function swapAnimate() {
    const now = $('#now');
    now.classList.remove('swap');
    void now.offsetWidth;
    now.classList.add('swap');
  }

  async function loadCity(query) {
    const my = ++state.token;
    const now = $('#now');
    now.classList.add('is-loading');
    try {
      const data = await Provider.get(query);
      if (my !== state.token) return;
      state.data = data;
      state.updated = Date.now();
      render();
      swapAnimate();
      $('#searchInput').value = '';
    } catch (err) {
      if (my !== state.token) return;
      if (err && err.message === 'NOT_FOUND') {
        toast('“' + query + '” was not found. Try ' + Object.keys(SAMPLE).slice(0, 4).join(', ') + '.');
      } else {
        console.error(err);
        const key = findCity(query);
        if (key) {
          state.data = sampleFor(key); state.updated = Date.now(); render(); swapAnimate();
          toast('Live data is unavailable. Showing sample data.');
        } else {
          toast('Could not load weather. Check your connection and try again.');
        }
      }
    } finally {
      if (my === state.token) now.classList.remove('is-loading');
    }
  }

  function previewCondition(cond) {
    if (!state.data || !COND[cond]) return;
    const b = Object.assign({}, state.data, { cond });
    state.data = Object.assign(b, buildSeries(b));
    state.updated = Date.now();
    render();
    swapAnimate();
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function buildSkyline() {
    const svg = $('#skyline');
    const rnd = mulberry32(11);
    const layer = (fill, minH, maxH, minW, maxW, spires) => {
      let x = -10, s = '';
      while (x < 1450) {
        const w = minW + rnd() * (maxW - minW);
        const env = .45 + .95 * Math.exp(-Math.pow((x - 720) / 430, 2));   // taller downtown in the middle
        const h = (minH + rnd() * (maxH - minH)) * env;
        s += '<rect x="' + x.toFixed(1) + '" y="' + (260 - h).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '"/>';
        if (spires && h > 110 && rnd() > .55) s += '<rect x="' + (x + w / 2 - 1.5).toFixed(1) + '" y="' + (260 - h - 30).toFixed(1) + '" width="3" height="30"/>';
        x += w + rnd() * 4;
      }
      return '<g fill="' + fill + '">' + s + '</g>';
    };
    svg.innerHTML = layer('url(#skyfar)', 50, 170, 16, 42, true) + layer('url(#skynear)', 26, 96, 20, 54, false);
  }

  function buildFx() {
    const rain = $('#fxRain'), snow = $('#fxSnow');
    for (let i = 0; i < 70; i++) {
      const d = document.createElement('i');
      d.style.cssText = 'left:' + (Math.random() * 110 - 5).toFixed(1) + '%;height:' + (40 + Math.random() * 50).toFixed(0) +
        'px;animation-duration:' + (.7 + Math.random() * .6).toFixed(2) + 's;animation-delay:-' + (Math.random() * 2).toFixed(2) +
        's;opacity:' + (.25 + Math.random() * .5).toFixed(2);
      rain.appendChild(d);
    }
    for (let i = 0; i < 46; i++) {
      const f = document.createElement('i'), s = 3 + Math.random() * 4;
      f.style.cssText = 'left:' + (Math.random() * 100).toFixed(1) + '%;width:' + s.toFixed(1) + 'px;height:' + s.toFixed(1) +
        'px;animation-duration:' + (8 + Math.random() * 9).toFixed(1) + 's;animation-delay:-' + (Math.random() * 14).toFixed(1) +
        's;opacity:' + (.5 + Math.random() * .5).toFixed(2);
      snow.appendChild(f);
    }
  }

  function buildStreaks(wind) {
    const box = $('#rStreaks');
    const dur = clamp(9 - wind / 4, 2.5, 8);
    box.innerHTML = '';
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('i');
      s.style.cssText = 'top:' + (6 + i * 5.8).toFixed(1) + '%;width:' + (70 + ((i * 53) % 110)) + 'px;animation-duration:' +
        (dur + (i % 4) * .8).toFixed(2) + 's;animation-delay:-' + ((i * 0.9) % dur).toFixed(2) + 's;opacity:' + (.35 + (i % 3) * .2);
      box.appendChild(s);
    }
  }


  function bindEvents() {
    $('#cityList').innerHTML = Object.keys(SAMPLE).map(n => '<option value="' + n + '"></option>').join('');
    $('#searchForm').addEventListener('submit', e => {
      e.preventDefault();
      const q = $('#searchInput').value.trim();
      if (q) loadCity(q);
    });

    $$('.unit button').forEach(btn => btn.addEventListener('click', () => {
      state.unit = btn.dataset.unit;
      $$('.unit button').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      render();
    }));


    $('#cityGrid').addEventListener('click', e => {
      const btn = e.target.closest('.city');
      if (!btn) return;
      loadCity(btn.dataset.city);
      $('#today').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('#previewChips').addEventListener('click', e => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      previewCondition(btn.dataset.cond);
      $('#today').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    $$('.r-chip').forEach(btn => btn.addEventListener('click', () => {
      $('#radarCard').dataset.layer = btn.dataset.layer;
      $$('.r-chip').forEach(b => b.classList.toggle('active', b === btn));
    }));

 
    const nav = $('#nav'), menuBtn = $('#menuBtn');
    menuBtn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    $$('#pillNav a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    }));
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const links = $$('#pillNav a');
    const setActive = id => links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
    if ('IntersectionObserver' in window) {
      const spy = new IntersectionObserver(entries => {
        entries.forEach(en => { if (en.isIntersecting) setActive(en.target.id); });
      }, { rootMargin: '-35% 0px -60% 0px' });
      ['today', 'forecast', 'air', 'radar', 'cities'].forEach(id => { const el = document.getElementById(id); if (el) spy.observe(el); });

      const rev = new IntersectionObserver(entries => {
        entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); rev.unobserve(en.target); } });
      }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
      $$('.reveal').forEach(el => rev.observe(el));
    } else {
      $$('.reveal').forEach(el => el.classList.add('in'));
    }

    /* clock */
    setInterval(tickClock, 20000);
  }

 
  function init() {
    buildSkyline();
    buildFx();
    bindEvents();
    $$('.unit button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.unit === state.unit)));

    state.data = sampleFor(CONFIG.DEFAULT_CITY);
    state.updated = Date.now();
    render();
    if (CONFIG.USE_LIVE_API) loadCity(CONFIG.DEFAULT_CITY);
  }

  init();
})();
