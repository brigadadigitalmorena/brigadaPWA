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
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (node) {
      node.remove();
    });
    var meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', color);
    document.head.appendChild(meta);
    try {
      document.cookie =
        'brigada-pwa-chrome=' + color + ';path=/;max-age=31536000;samesite=lax';
    } catch (cookieError) {}
    var manifestHref =
      '/manifest.json?theme_color=' + encodeURIComponent(color) + '&v=' + Date.now();
    var manifest = document.querySelector('link[rel="manifest"]');
    if (manifest) {
      var next = document.createElement('link');
      next.setAttribute('rel', 'manifest');
      next.setAttribute('href', manifestHref);
      manifest.replaceWith(next);
    }
  } catch (error) {
    // FOUC fallback: data-color-scheme="pink" on <html>
  }
})();
