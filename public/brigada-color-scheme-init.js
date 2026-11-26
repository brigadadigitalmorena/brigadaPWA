(function () {
  try {
    var key = 'brigada-pwa-color-scheme';
    var value = localStorage.getItem(key);
    var ids = [
      'pink',
      'blue',
      'purple',
      'green',
      'orange',
      'red',
      'darkElegant',
      'indigo',
      'teal',
    ];
    if (value && ids.indexOf(value) !== -1) {
      document.documentElement.setAttribute('data-color-scheme', value);
    }
    var light = {
      pink: '#FF1B8D',
      blue: '#0284C7',
      purple: '#7C3AED',
      green: '#16A34A',
      orange: '#EA580C',
      red: '#DC2626',
      darkElegant: '#111827',
      indigo: '#4F46E5',
      teal: '#14B8A6',
    };
    var dark = {
      pink: '#FF4DA6',
      blue: '#38BDF8',
      purple: '#A78BFA',
      green: '#4ADE80',
      orange: '#FB923C',
      red: '#F87171',
      darkElegant: '#F3F4F6',
      indigo: '#818CF8',
      teal: '#2DD4BF',
    };
    var theme = localStorage.getItem('brigada-pwa-theme');
    var isDark =
      theme === 'dark' ||
      (theme !== 'light' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', !!isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    var scheme = value && ids.indexOf(value) !== -1 ? value : 'pink';
    var color = (isDark ? dark : light)[scheme] || '#FF1B8D';
    document.documentElement.style.setProperty('--system-chrome', color);
    document.documentElement.style.backgroundColor = color;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    if (meta.getAttribute('content') !== color) {
      meta.setAttribute('content', color);
    }
    try {
      var secure = location.protocol === 'https:' ? ';secure' : '';
      document.cookie =
        'brigada-pwa-chrome=' +
        color.replace('#', '') +
        ';path=/;max-age=31536000;samesite=lax' +
        secure;
    } catch {
      /* private mode */
    }
    var manifest = document.querySelector('link[rel="manifest"]');
    if (manifest && manifest.getAttribute('href') !== '/manifest.json') {
      manifest.setAttribute('href', '/manifest.json');
    }
    try {
      var current = new URL(location.href);
      if (current.searchParams.has('_chrome')) {
        current.searchParams.delete('_chrome');
        history.replaceState(
          history.state,
          '',
          current.pathname + current.search + current.hash
        );
      }
    } catch {
      /* ignore malformed URL */
    }
  } catch {
    // FOUC fallback: data-color-scheme="pink" on <html>
  }
})();
