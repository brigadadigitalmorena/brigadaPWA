(function () {
  try {
    var path = location.pathname;
    var token = localStorage.getItem('brigada_access_token');
    var seen = localStorage.getItem('brigada_welcome_seen') === '1';
    var guest = seen ? '/login' : '/welcome';
    if (path === '/' || path === '') {
      location.replace(token ? '/home' : guest);
      return;
    }
    if (path === '/home' && !token) location.replace(guest);
  } catch (error) {
    // Keep the requested route if storage is unavailable.
  }
})();
